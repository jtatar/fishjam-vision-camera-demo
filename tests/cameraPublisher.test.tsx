import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { CameraPublisher } from '../src/camera/CameraPublisher';
import { colors } from '../src/ui';
import { flushUI } from './flushUI';

const mockDevice = {
  id: 'back',
  position: 'back',
  hasTorch: true,
  supportsTorchStrength: true,
  minTorchStrength: 0.001,
  maxTorchStrength: 1,
};
function camera() {
  return {
    zoom: 1,
    minZoom: 1,
    maxZoom: 8,
    setZoom: jest.fn().mockResolvedValue(undefined),
    setTorchMode: jest.fn().mockResolvedValue(undefined),
    enableTorchWithStrength: jest.fn().mockResolvedValue(undefined),
  };
}
let mockCamera = camera();
beforeEach(() => {
  mockCamera = camera();
  mockDevice.hasTorch = true;
  mockDevice.supportsTorchStrength = true;
});
const mockPreviewOutput = {};
const mockSource = { frameOutput: {}, stream: {}, error: null };
const mockPreview = jest.fn(() => null);
const mockReady = jest.fn();

jest.mock('react-native-vision-camera', () => ({
  useCameraDevice: () => mockDevice,
  useCameraPermission: () => ({ hasPermission: true }),
  usePreviewOutput: () => mockPreviewOutput,
  useCamera: ({ onStarted }: any) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const [start] = React.useState(() => onStarted);
    React.useEffect(start, [start]);
    return mockCamera;
  },
  NativePreviewView: () => mockPreview(),
}));
jest.mock('../src/camera/core/useCameraSource', () => ({ useCameraSource: () => mockSource }));
jest.mock('../src/useForeground', () => ({ useForeground: () => true }));
jest.mock('../src/diagnostics/LocalReceiver', () => ({ LocalReceiver: () => null }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

async function settleControls() {
  await flushUI();
  await flushUI();
}

async function openCamera() {
  render(
    <CameraPublisher header={null} footer={null} microphone={null} onReadyChange={mockReady} />,
  );
  await settleControls();
}

async function openLight() {
  await openCamera();
  await act(async () => fireGestureHandler(getByGestureTestId('Lighting')));
  await settleControls();
}

test('torch and zoom updates do not render or remount the native preview', async () => {
  await openLight();
  const renders = mockPreview.mock.calls.length;
  mockReady.mockClear();
  await act(async () => fireGestureHandler(getByGestureTestId('torch-level-25%')));
  await settleControls();
  await act(async () => fireGestureHandler(getByGestureTestId('torch-level-75%')));
  await settleControls();
  await act(async () => fireGestureHandler(getByGestureTestId('2×')));
  await settleControls();
  expect(mockPreview).toHaveBeenCalledTimes(renders);
  expect(mockReady).not.toHaveBeenCalled();
  expect(screen.getByTestId('torch-value')).toHaveAnimatedProps({ text: '75%' });
  expect(screen.getByTestId('zoom-value')).toHaveAnimatedProps({ text: '2.0×' });
});

test('a camera without brightness levels toggles directly from the toolbar on UI', async () => {
  mockDevice.supportsTorchStrength = false;
  let finish!: () => void;
  mockCamera.setTorchMode.mockImplementationOnce(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  await openCamera();
  const renders = mockPreview.mock.calls.length;
  const toggle = screen.getByRole('button', { name: 'Flashlight' });
  expect(screen.queryByTestId('Lighting')).toBeNull();
  expect(screen.queryByTestId('torch-slider')).toBeNull();

  const tap = getByGestureTestId('torch-toggle');
  expect(tap.config.runOnJS).not.toBe(true);
  expect(tap.handlers.isWorklet.filter((value) => value !== undefined)).toEqual([true, true, true]);
  await act(async () => fireGestureHandler(tap));
  await settleControls();
  expect(mockCamera.setTorchMode).toHaveBeenLastCalledWith('on');
  expect(toggle).toHaveAnimatedProps({ accessibilityState: { selected: true, disabled: false } });
  expect(screen.getByTestId('torch-toggle-surface')).toHaveAnimatedStyle({
    backgroundColor: colors.accent,
  });
  expect(screen.queryByTestId('inline-light-control')).toBeNull();
  expect(mockPreview).toHaveBeenCalledTimes(renders);

  await act(async () => finish());
  await settleControls();
  await act(async () => fireGestureHandler(tap));
  await settleControls();
  expect(mockCamera.setTorchMode.mock.calls).toEqual([['on'], ['off']]);
  expect(toggle).toHaveAnimatedProps({ accessibilityState: { selected: false, disabled: false } });
  expect(mockCamera.enableTorchWithStrength).not.toHaveBeenCalled();
});

test.each(['ios', 'android'] as const)(
  '%s accessible torch toggle rolls back after a hardware failure',
  async (platform) => {
    const platformOverride = jest.replaceProperty(Platform, 'OS', platform);
    try {
      mockDevice.supportsTorchStrength = false;
      mockCamera.setTorchMode.mockRejectedValueOnce(new Error('Camera busy'));
      await openCamera();
      const toggle = screen.getByRole('button', { name: 'Flashlight' });
      if (platform === 'ios') fireEvent(toggle, 'accessibilityTap');
      else fireEvent(toggle, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
      await settleControls();
      expect(mockCamera.setTorchMode.mock.calls).toEqual([['on']]);
      expect(toggle).toHaveAnimatedProps({
        accessibilityState: { selected: false, disabled: false },
      });
      expect(screen.getByText('Camera busy')).toBeOnTheScreen();
    } finally {
      platformOverride.restore();
    }
  },
);

test('a camera without a torch keeps the unavailable control disabled', async () => {
  mockDevice.hasTorch = false;
  await openCamera();
  expect(screen.queryByTestId('torch-toggle')).toBeNull();
  expect(screen.getByLabelText('Torch unavailable')).toBeDisabled();
  expect(screen.queryByTestId('inline-light-control')).toBeNull();
});

test('brightness commands keep toolbar controls enabled without a busy-state fade', async () => {
  let finish!: () => void;
  mockCamera.enableTorchWithStrength.mockImplementationOnce(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  await openLight();
  await act(async () => fireGestureHandler(getByGestureTestId('torch-level-50%')));
  await settleControls();
  expect(screen.getByRole('button', { name: 'Switch camera' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Torch off' })).toBeEnabled();
  await act(async () => finish());
  await settleControls();
  expect(screen.getByRole('button', { name: 'Torch on' })).toBeEnabled();
});

test('dragging within the same brightness stop does not repeat the hardware command', async () => {
  await openLight();
  await settleControls();
  await act(async () => {
    fireGestureHandler(getByGestureTestId('torch-slider-pan'), [
      { y: 158.5 },
      { y: 156 },
      { y: 155 },
    ]);
  });
  await settleControls();
  expect(mockCamera.enableTorchWithStrength.mock.calls).toEqual([[0.25]]);
});

test('a rejected drag rolls the label, selected stop and thumb back together', async () => {
  let reject!: (cause: Error) => void;
  mockCamera.enableTorchWithStrength.mockImplementationOnce(
    () => new Promise<void>((_, fail) => (reject = fail)),
  );
  await openLight();
  await settleControls();
  await act(async () => fireGestureHandler(getByGestureTestId('torch-slider-pan'), [{ y: 13 }]));
  await settleControls();
  expect(screen.getByTestId('torch-value')).toHaveAnimatedProps({ text: '100%' });
  expect(screen.getByTestId('torch-slider-thumb')).toHaveAnimatedStyle({
    transform: [{ translateY: 0 }],
  });
  await act(async () => reject(new Error('Camera busy')));
  await settleControls();
  expect(screen.getByTestId('torch-value')).toHaveAnimatedProps({ text: 'Off' });
  expect(screen.getByTestId('torch-slider-thumb')).toHaveAnimatedStyle({
    transform: [{ translateY: 194 }],
  });
  expect(screen.getByTestId('torch-level-off-surface')).toHaveAnimatedStyle({
    backgroundColor: colors.accent,
  });
});

test('brightness is adjustable through assistive technology', async () => {
  await openLight();
  await settleControls();
  await act(async () =>
    fireEvent(screen.getByTestId('torch-slider'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    }),
  );
  await settleControls();
  expect(mockCamera.enableTorchWithStrength).toHaveBeenLastCalledWith(0.25);
  await act(async () =>
    fireEvent(screen.getByTestId('torch-slider'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    }),
  );
  await settleControls();
  expect(mockCamera.setTorchMode).toHaveBeenLastCalledWith('off');
});
