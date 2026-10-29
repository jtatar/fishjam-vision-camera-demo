import { useCallback, useEffect, useState } from 'react';
import { useCustomSource } from '@fishjam-cloud/react-native-client';
import { useManagedForwardTrack } from '@fishjam-cloud/react-native-custom-video-source';
import { forwardFrame } from '@fishjam-cloud/react-native-webrtc';
import type { Frame } from 'react-native-vision-camera';
import { useManagedFrameOutput } from './useManagedFrameOutput';
import { frameRotation } from './frameRotation';
import { errorMessage } from './errors';

const TARGET_RESOLUTION = { width: 1280, height: 720 };

/**
 * Register VisionCamera frames as a Fishjam custom video source.
 * Mount inside FishjamProvider and keep sourceId unique and stable per capture.
 * Pass false when capture is paused; this releases the forwarding track.
 */
export function useCameraSource(sourceId: string, enabled: boolean) {
  const { track, stream, error } = useManagedForwardTrack(enabled);
  const { setStream } = useCustomSource(sourceId);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (!stream) return;
    let disposed = false;
    setPublishError(null);
    void setStream(stream).catch((cause) => {
      if (!disposed) setPublishError(errorMessage(cause));
    });
    return () => {
      disposed = true;
      void setStream(null).catch((cause) => console.warn('Camera source cleanup failed', cause));
    };
  }, [stream, setStream]);

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      try {
        if (!track) return;
        const buffer = frame.getNativeBuffer();
        try {
          forwardFrame(track, {
            nativeBuffer: buffer.pointer,
            rotation: frameRotation(frame.orientation),
          });
        } finally {
          buffer.release();
        }
      } catch (cause) {
        console.warn('Camera frame forwarding failed', cause);
      } finally {
        frame.dispose();
      }
    },
    [track],
  );

  const frameOutput = useManagedFrameOutput({
    targetResolution: TARGET_RESOLUTION,
    pixelFormat: 'native',
    dropFramesWhileBusy: true,
    onFrame,
  });

  return { frameOutput, stream, error: error?.message ?? publishError };
}

export type CameraSource = ReturnType<typeof useCameraSource>;
