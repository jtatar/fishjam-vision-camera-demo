import type { CameraController } from 'react-native-vision-camera';
import type { TorchDevice } from './torch';
import { useCameraZoom } from './useCameraZoom';
import { useCameraTorch } from './useCameraTorch';

/** Compose zoom and torch controls for the same running camera session. */
export function useCameraControls(
  camera: CameraController | undefined,
  active: boolean,
  device: TorchDevice,
) {
  const zoom = useCameraZoom(camera, active);
  const torch = useCameraTorch(camera, active, device);

  return {
    ...zoom,
    ...torch,
    ready: !!camera && active,
    error: torch.error ?? zoom.error,
  };
}

export type CameraControls = ReturnType<typeof useCameraControls>;
