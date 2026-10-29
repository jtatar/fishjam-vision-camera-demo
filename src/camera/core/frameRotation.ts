import type { CameraOrientation } from 'react-native-vision-camera';

export function frameRotation(orientation: CameraOrientation): 0 | 90 | 180 | 270 {
  'worklet';
  // Frame.orientation describes the pixels relative to upright; WebRTC needs
  // the clockwise correction. A left-rotated frame needs 90° clockwise.
  // VisionCamera 5.0.10's Android CameraX labels use this same mapping.
  if (orientation === 'down') return 180;
  if (orientation === 'left') return 90;
  if (orientation === 'right') return 270;
  return 0;
}
