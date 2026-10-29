import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import type { CameraController } from 'react-native-vision-camera';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { clampZoom, zoomForPinch } from './zoom';

/**
 * UI-runtime zoom actions and pinch gesture for one camera session.
 * Set active only while the camera is running. Bind UI directly to liveZoom;
 * call actions ending in OnUI from worklets or through scheduleOnUI.
 */
export function useCameraZoom(camera: CameraController | undefined, active: boolean) {
  const [error, setError] = useState<string | null>(null);

  // Continuous gesture feedback stays on the UI runtime.
  const liveZoom = useSharedValue(1);
  const pinchStartZoom = useSharedValue(1);
  const isZoomEnabled = useSharedValue(false);
  const requestId = useSharedValue(0);
  const liveZoomError = useSharedValue<string | null>(null);

  const min = camera?.minZoom ?? 1;
  const max = Math.min(camera?.maxZoom ?? 1, Math.max(min, 10));
  const ready = !!camera && active;

  // The controls read liveZoom directly. Only error messages need React state.
  useAnimatedReaction(
    () => liveZoomError.get(),
    (message, previousMessage) => {
      if (message !== previousMessage) scheduleOnRN(setError, message);
    },
  );

  useEffect(() => {
    const initial = clampZoom(camera?.zoom ?? 1, min, max);
    setError(null);

    scheduleOnUI(() => {
      requestId.set((id) => id + 1);
      liveZoom.set(initial);
      liveZoomError.set(null);
      isZoomEnabled.set(ready);
    });
    return function stopZoomSession() {
      scheduleOnUI(() => {
        isZoomEnabled.set(false);
        requestId.set((id) => id + 1);
      });
    };
  }, [camera, ready, min, max, isZoomEnabled, requestId, liveZoom, liveZoomError]);

  const changeZoomOnUI = useCallback(
    (value: number) => {
      'worklet';
      if (!camera || !isZoomEnabled.get()) return;

      const nextZoom = clampZoom(value, min, max);
      if (nextZoom === liveZoom.get()) return;

      liveZoom.set(nextZoom);
      liveZoomError.set(null);
      const currentRequestId = requestId.get() + 1;
      requestId.set(currentRequestId);

      function restoreZoomAfterFailure(cause: unknown) {
        if (!isZoomEnabled.get() || requestId.get() !== currentRequestId) return;

        const actualZoom = clampZoom(camera!.zoom, min, max);
        const message = cause instanceof Error ? cause.message : 'Could not change camera zoom.';
        liveZoom.set(actualZoom);
        liveZoomError.set(message);
      }

      try {
        camera.setZoom(nextZoom).catch(restoreZoomAfterFailure);
      } catch (cause) {
        restoreZoomAfterFailure(cause);
      }
    },
    [camera, isZoomEnabled, min, max, liveZoom, liveZoomError, requestId],
  );

  const stepZoomOnUI = useCallback(
    (factor: number) => {
      'worklet';
      changeZoomOnUI(liveZoom.get() * factor);
    },
    [changeZoomOnUI, liveZoom],
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(ready && max > min)
        .onStart(() => {
          pinchStartZoom.set(liveZoom.get());
        })
        .onUpdate(({ scale }) =>
          changeZoomOnUI(zoomForPinch(pinchStartZoom.get(), scale, min, max)),
        ),
    [ready, min, max, pinchStartZoom, liveZoom, changeZoomOnUI],
  );

  return {
    liveZoom,
    min,
    max,
    pinch,
    changeZoomOnUI,
    stepZoomOnUI,
    error,
  };
}

export type CameraZoom = ReturnType<typeof useCameraZoom>;
