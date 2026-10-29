import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { CameraController } from 'react-native-vision-camera';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { createCameraCommandQueue, type CameraCommandQueue } from './cameraCommandQueue';
import { torchLevels, type TorchDevice } from './torch';
import { errorMessage } from './errors';

// A resumed session must wait for the previous session's final torch-off, including
// an in-flight enable. Keeping this per controller also covers unmount/remount.
const pendingTorchCleanup = new WeakMap<CameraController, Promise<void>>();

type TorchSession = {
  queue: CameraCommandQueue;
  sessionId: number;
  latestRequestId: number;
};

/**
 * UI-runtime torch feedback with serialized, capability-aware native commands.
 * Set active only while the camera is running. Render desiredTorchStrength;
 * use confirmed values for hardware status. Cleanup turns the torch off.
 */
export function useCameraTorch(
  camera: CameraController | undefined,
  active: boolean,
  device: TorchDevice,
) {
  const levels = useMemo(() => torchLevels(device, Platform.OS === 'android'), [device]);
  const supportsLevels = levels.length > 0;
  const defaultStrength = levels.at(-1)?.strength ?? 1;
  const hasTorch = device.hasTorch;

  const [confirmedTorchEnabled, setConfirmedTorchEnabled] = useState(false);
  const [confirmedTorchStrength, setConfirmedTorchStrength] = useState(defaultStrength);
  const [error, setError] = useState<string | null>(null);
  const activeSession = useRef<TorchSession | null>(null);
  const sessionSequence = useRef(0);

  // The UI owns the requested level (0 means off), independently of native latency.
  const desiredTorchStrength = useSharedValue(0);
  const rememberedOnStrength = useSharedValue(defaultStrength);
  const canRequestTorch = useSharedValue(false);
  const uiSessionId = useSharedValue(0);
  const uiRequestId = useSharedValue(0);

  const reportConfirmation = useCallback(
    (
      sessionId: number,
      requestId: number,
      appliedStrength: number,
      lastSuccessfulOnStrength: number,
      message: string | null,
    ) => {
      const session = activeSession.current;
      if (session?.sessionId !== sessionId || session.latestRequestId !== requestId) return;

      setConfirmedTorchEnabled(appliedStrength > 0);
      setConfirmedTorchStrength(lastSuccessfulOnStrength);
      setError(message);
    },
    [],
  );

  useEffect(() => {
    const sessionId = ++sessionSequence.current;
    const isTorchAvailable = !!camera && active && hasTorch;

    setConfirmedTorchEnabled(false);
    setConfirmedTorchStrength(defaultStrength);
    setError(null);

    scheduleOnUI(() => {
      uiSessionId.set(sessionId);
      canRequestTorch.set(isTorchAvailable);
      desiredTorchStrength.set(0);
      rememberedOnStrength.set(defaultStrength);
    });

    let commandQueue: CameraCommandQueue | undefined;

    if (camera && isTorchAvailable) {
      let hardwareStrength = 0;
      let lastSuccessfulOnStrength = defaultStrength;

      function reconcileLatestRequest(requestId: number | undefined, message: string | null) {
        if (requestId === undefined) return;
        const appliedStrength = hardwareStrength;
        const confirmedOnStrength = lastSuccessfulOnStrength;

        scheduleOnUI(() => {
          if (
            !canRequestTorch.get() ||
            uiSessionId.get() !== sessionId ||
            uiRequestId.get() !== requestId
          ) {
            return;
          }

          // A completion can arrive after another gesture. Only the latest request
          // may confirm the selection or restore it after a native failure.
          desiredTorchStrength.set(appliedStrength);
          rememberedOnStrength.set(confirmedOnStrength);
          scheduleOnRN(
            reportConfirmation,
            sessionId,
            requestId,
            appliedStrength,
            confirmedOnStrength,
            message,
          );
        });
      }

      commandQueue = createCameraCommandQueue({
        after: pendingTorchCleanup.get(camera),
        apply: (strength) => {
          if (strength > 0 && supportsLevels) return camera.enableTorchWithStrength(strength);
          return camera.setTorchMode(strength > 0 ? 'on' : 'off');
        },
        onApplied(strength, requestId) {
          // Remember intermediate successes for rollback, without replacing a newer
          // UI selection while its hardware operation is still pending.
          hardwareStrength = strength;
          if (strength > 0) lastSuccessfulOnStrength = strength;
          reconcileLatestRequest(requestId, null);
        },
        onError: (cause, requestId) => reconcileLatestRequest(requestId, errorMessage(cause)),
      });
      activeSession.current = { queue: commandQueue, sessionId, latestRequestId: 0 };
    }

    return function stopTorchSession() {
      activeSession.current = null;

      scheduleOnUI(() => {
        if (uiSessionId.get() !== sessionId) return;
        canRequestTorch.set(false);
        desiredTorchStrength.set(0);
      });

      if (camera && commandQueue) {
        pendingTorchCleanup.set(camera, commandQueue.close({ value: 0 }));
      }
    };
  }, [
    camera,
    active,
    hasTorch,
    supportsLevels,
    defaultStrength,
    uiSessionId,
    canRequestTorch,
    desiredTorchStrength,
    rememberedOnStrength,
    uiRequestId,
    reportConfirmation,
  ]);

  const enqueueTorchRequest = useCallback(
    (strength: number, sessionId: number, requestId: number) => {
      const session = activeSession.current;
      if (!session || session.sessionId !== sessionId || requestId <= session.latestRequestId) {
        return;
      }

      session.latestRequestId = requestId;
      setError(null);
      session.queue.submit(strength, requestId);
    },
    [],
  );

  const requestTorchOnUI = useCallback(
    (strength: number) => {
      'worklet';
      if (!canRequestTorch.get()) return;

      const isSupportedStrength =
        strength === 0 ||
        (supportsLevels ? levels.some((level) => level.strength === strength) : strength === 1);
      if (!isSupportedStrength || desiredTorchStrength.get() === strength) return;

      desiredTorchStrength.set(strength);
      if (strength > 0) rememberedOnStrength.set(strength);

      // Feedback stays on UI; only discrete hardware requests cross to RN.
      const requestId = uiRequestId.get() + 1;
      uiRequestId.set(requestId);
      scheduleOnRN(enqueueTorchRequest, strength, uiSessionId.get(), requestId);
    },
    [
      canRequestTorch,
      supportsLevels,
      levels,
      desiredTorchStrength,
      rememberedOnStrength,
      uiRequestId,
      enqueueTorchRequest,
      uiSessionId,
    ],
  );

  const toggleTorchOnUI = useCallback(() => {
    'worklet';
    requestTorchOnUI(desiredTorchStrength.get() > 0 ? 0 : rememberedOnStrength.get());
  }, [requestTorchOnUI, desiredTorchStrength, rememberedOnStrength]);

  return {
    confirmedTorchEnabled,
    confirmedTorchStrength,
    desiredTorchStrength,
    torchLevels: levels,
    requestTorchOnUI,
    toggleTorchOnUI,
    error,
  };
}

export type CameraTorch = ReturnType<typeof useCameraTorch>;
