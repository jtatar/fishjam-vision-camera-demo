import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useManagedForwardTrack } from '@fishjam-cloud/react-native-custom-video-source';
import { forwardFrame, type ForwardTrack } from '@fishjam-cloud/react-native-webrtc';
import type { Frame } from 'react-native-vision-camera';
import { useManagedFrameOutput } from './useManagedFrameOutput';
import { frameRotation } from './frameRotation';

const TARGET_RESOLUTION = { width: 1280, height: 720 };

/**
 * Own the managed stream for livestream inputs.video.
 * Keep this hook above keyed camera captures so switching cameras preserves the track.
 * Pass false to release the forwarding track.
 */
export function useCameraSource(enabled: boolean) {
  const { track, stream, error } = useManagedForwardTrack(enabled);
  return { track, stream, error: error?.message ?? null };
}

/** Each native camera session needs its own output, targeting the shared publishing track. */
export function useCameraFrameOutput(track: ForwardTrack | null) {
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

  return useManagedFrameOutput({
    targetResolution: TARGET_RESOLUTION,
    pixelFormat: 'native',
    dropFramesWhileBusy: true,
    // WHIP applies rotation in WebRTC on iOS. Its I420 rotation path retains
    // full frames in this SDK version; orient buffers in AVFoundation instead.
    enablePhysicalBufferRotation: Platform.OS === 'ios',
    onFrame,
  });
}

export type CameraSource = ReturnType<typeof useCameraSource>;
