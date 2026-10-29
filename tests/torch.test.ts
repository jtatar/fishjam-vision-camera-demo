import { torchLevels } from '../src/camera/core/torch';

const device = {
  hasTorch: true,
  supportsTorchStrength: true,
  minTorchStrength: 0.001,
  maxTorchStrength: 1,
};

test('iOS presets use positive fractional strengths', () => {
  expect(torchLevels(device, false)).toEqual([
    { strength: 0.25, label: '25%' },
    { strength: 0.5, label: '50%' },
    { strength: 0.75, label: '75%' },
    { strength: 1, label: '100%' },
  ]);
});

test('Android presets round to native integer steps and remove duplicates', () => {
  expect(torchLevels({ ...device, minTorchStrength: 1, maxTorchStrength: 3 }, true)).toEqual([
    { strength: 1, label: '33%' },
    { strength: 2, label: '67%' },
    { strength: 3, label: '100%' },
  ]);
});

test('presets respect a higher minimum strength', () => {
  expect(torchLevels({ ...device, minTorchStrength: 0.5 }, false)).toEqual([
    { strength: 0.5, label: '50%' },
    { strength: 0.75, label: '75%' },
    { strength: 1, label: '100%' },
  ]);
});

test('cameras without dimming or a torch have no brightness controls', () => {
  expect(torchLevels({ ...device, supportsTorchStrength: false }, false)).toEqual([]);
  expect(torchLevels({ ...device, hasTorch: false }, false)).toEqual([]);
});

test('a single native brightness level uses on/off controls', () => {
  expect(torchLevels({ ...device, minTorchStrength: 1, maxTorchStrength: 1 }, true)).toEqual([]);
});
