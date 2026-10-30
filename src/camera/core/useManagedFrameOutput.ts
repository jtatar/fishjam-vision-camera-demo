import { useEffect, useMemo } from 'react';
import {
  VisionCamera,
  type CameraFrameOutput,
  type RuntimeThread,
  type UseFrameOutputProps,
} from 'react-native-vision-camera';
import { provider } from 'react-native-vision-camera-worklets';

// VisionCamera 5.0.10's useFrameOutput does not detach its callback on unmount.
// A camera can still deliver frames while its session stops asynchronously.
// Worklets 0.10.1 queued jobs retain their runtime weakly, so keep it alive here
// until the native callback has been cleared and queued frames have drained.
const drainingRuntimes = new Set<{ runtime: RuntimeThread }>();
const DEFAULT_RESOLUTION = { width: 1280, height: 720 };

type ManagedFrameOutputOptions = Pick<
  UseFrameOutputProps,
  | 'targetResolution'
  | 'pixelFormat'
  | 'dropFramesWhileBusy'
  | 'enablePhysicalBufferRotation'
  | 'onFrame'
>;

export function useManagedFrameOutput({
  targetResolution = DEFAULT_RESOLUTION,
  pixelFormat = 'native',
  dropFramesWhileBusy = true,
  enablePhysicalBufferRotation = false,
  onFrame,
}: ManagedFrameOutputOptions) {
  const { width, height } = targetResolution;
  const frameOutput = useMemo(
    () =>
      VisionCamera.createFrameOutput({
        targetResolution: { width, height },
        pixelFormat,
        dropFramesWhileBusy,
        enableCameraMatrixDelivery: false,
        enablePhysicalBufferRotation,
        enablePreviewSizedOutputBuffers: false,
        allowDeferredStart: true,
      }),
    [width, height, pixelFormat, dropFramesWhileBusy, enablePhysicalBufferRotation],
  );
  const runtime = useMemo(() => provider.createRuntimeForThread(frameOutput.thread), [frameOutput]);

  useEffect(() => () => detachAndDrainFrames(frameOutput, runtime), [frameOutput, runtime]);

  useEffect(() => {
    runtime.setOnFrameCallback(frameOutput, onFrame);
  }, [frameOutput, runtime, onFrame]);

  return frameOutput;
}

function detachAndDrainFrames(frameOutput: CameraFrameOutput, runtime: RuntimeThread) {
  // Use a separate lease for each cleanup, including Strict Mode replays.
  const lease = { runtime };
  drainingRuntimes.add(lease);
  runtime.setOnFrameCallback(frameOutput, undefined);

  frameOutput.thread.runOnThread(() => {
    // In CameraX 1.7.0-alpha01, image acquisition and analysis both use this
    // serial executor. An acquisition queued before the clear can append
    // its analyzer after this first barrier. The second barrier drains it.
    frameOutput.thread.runOnThread(() => drainingRuntimes.delete(lease));
  });
}
