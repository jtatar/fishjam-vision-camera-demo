import { useEffect, useRef, useState } from 'react';
import {
  VisionCamera,
  type CameraController,
  type CameraDevice,
  type CameraFrameOutput,
  type CameraPreviewOutput,
  type CameraSession,
  type ListenerSubscription,
} from 'react-native-vision-camera';
import { errorMessage } from './errors';

// Camera sessions cannot overlap during a lens switch. Drain the previous
// session before configuring its replacement, including late async creation.
let handoff: Promise<void> = Promise.resolve();

type Lease = {
  cancelled: boolean;
  configured: boolean;
  session?: CameraSession;
  listeners: ListenerSubscription[];
  operation: Promise<void>;
};

/** A portrait capture session whose resolution is chosen for streaming. */
export function useCaptureSession(
  device: CameraDevice,
  preview: CameraPreviewOutput,
  frames: CameraFrameOutput,
  active: boolean,
) {
  const current = useRef<Lease | null>(null);
  const [camera, setCamera] = useState<CameraController>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lease: Lease = { cancelled: false, configured: false, listeners: [], operation: handoff };
    current.current = lease;
    const fail = (cause: unknown) => {
      if (lease.cancelled) return;
      setRunning(false);
      setError(errorMessage(cause));
    };
    lease.operation = lease.operation
      .then(async () => {
        if (lease.cancelled) return;
        const session = await VisionCamera.createCameraSession(false);
        lease.session = session;
        if (lease.cancelled) return;
        const updateRunning = (value: boolean) => {
          if (!lease.cancelled) setRunning(value);
        };
        lease.listeners = [
          session.addOnStartedListener(() => {
            updateRunning(true);
            if (!lease.cancelled) setError(null);
          }),
          session.addOnStoppedListener(() => updateRunning(false)),
          session.addOnInterruptionStartedListener(() => updateRunning(false)),
          session.addOnInterruptionEndedListener(() => updateRunning(session.isRunning)),
          session.addOnErrorListener(fail),
        ];
        // The app is locked to portrait. iOS physically orients the frame buffers;
        // Android reports the corresponding rotation metadata.
        preview.outputOrientation = 'up';
        frames.outputOrientation = 'up';
        const [controller] = await session.configure([
          {
            input: device,
            outputs: [
              { output: preview, mirrorMode: 'off' },
              { output: frames, mirrorMode: 'off' },
            ],
            // useCamera adds a screen-sized preview constraint, which can select
            // 4K on an iPhone even when the frame output requests 720p.
            constraints: [{ resolutionBias: frames }, { fps: 30 }],
          },
        ]);
        lease.configured = true;
        if (!lease.cancelled) setCamera(controller);
      })
      .catch(fail);

    return () => {
      lease.cancelled = true;
      if (current.current === lease) current.current = null;
      lease.listeners.forEach((listener) => listener.remove());
      handoff = lease.operation
        .then(async () => {
          if (!lease.session) return;
          try {
            await lease.session.stop();
            await lease.session.configure([]);
          } finally {
            lease.session.dispose();
          }
        })
        .catch((cause) => console.warn('Camera session cleanup failed', cause));
    };
  }, [device, preview, frames]);

  useEffect(() => {
    const lease = current.current;
    if (!lease) return;
    lease.operation = lease.operation
      .then(async () => {
        if (lease.cancelled || !lease.configured || !lease.session) return;
        if (active) await lease.session.start();
        else await lease.session.stop();
      })
      .catch((cause) => {
        if (!lease.cancelled) {
          setRunning(false);
          setError(errorMessage(cause));
        }
      });
  }, [active, device, preview, frames]);

  return { camera, running, error };
}
