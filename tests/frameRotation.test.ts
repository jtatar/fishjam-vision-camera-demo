import { frameRotation } from '../src/camera/core/frameRotation';

// VisionCamera's Frame contract: these are pixel rotations, not corrections.
test.each([
  ['up', 0],
  ['right', 90],
  ['down', 180],
  ['left', 270],
] as const)('makes an iOS %s frame upright', (orientation, pixelRotation) => {
  const deliveredRotation = (pixelRotation + frameRotation(orientation)) % 360;
  expect(deliveredRotation).toBe(0);
});

// Fixtures from VisionCamera 5.0.10's CameraOrientation.fromDegrees on Android.
test.each([
  [0, 'up'],
  [90, 'left'],
  [180, 'down'],
  [270, 'right'],
] as const)('preserves CameraX correction %s°', (cameraXCorrection, orientation) => {
  expect(frameRotation(orientation)).toBe(cameraXCorrection);
});
