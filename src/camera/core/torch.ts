import type { CameraDevice } from 'react-native-vision-camera';

export type TorchDevice = Pick<
  CameraDevice,
  'hasTorch' | 'supportsTorchStrength' | 'minTorchStrength' | 'maxTorchStrength'
>;

export type TorchLevel = {
  strength: number;
  label: string;
};

export function torchLevels(device: TorchDevice, integerStrength: boolean): TorchLevel[] {
  if (!device.hasTorch || !device.supportsTorchStrength) return [];
  const { minTorchStrength: min, maxTorchStrength: max } = device;
  const strengths = [0.25, 0.5, 0.75, 1].map((fraction) => {
    const value = max * fraction;
    return Math.min(max, Math.max(min, integerStrength ? Math.round(value) : value));
  });
  const distinctStrengths = [...new Set(strengths)];
  if (distinctStrengths.length < 2) return [];

  return distinctStrengths.map((strength) => ({
    strength,
    label: `${Math.round((strength / max) * 100)}%`,
  }));
}
