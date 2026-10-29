import { act, fireEvent, render } from '@testing-library/react-native';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { makeMutable } from 'react-native-reanimated';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import type { CameraController } from 'react-native-vision-camera';
import { ZoomControls } from '../src/camera/ZoomControls';
import { CameraControlButton } from '../src/camera/CameraControlButton';
import { CameraValueLabel } from '../src/camera/CameraValueLabel';
import { useCameraZoom } from '../src/camera/core/useCameraZoom';
import { colors } from '../src/ui';
import { flushUI } from './flushUI';

function camera(initial = 1) {
  return {
    zoom: initial,
    minZoom: 1,
    maxZoom: 8,
    setZoom: jest.fn().mockResolvedValue(undefined),
  };
}

function setup(native = camera()) {
  let current!: ReturnType<typeof useCameraZoom>;
  let renders = 0;
  function Example() {
    current = useCameraZoom(native as unknown as CameraController, true);
    renders += 1;
    return (
      <GestureHandlerRootView>
        <ZoomControls controls={{ ...current, ready: true }} />
      </GestureHandlerRootView>
    );
  }
  const view = render(<Example />);
  return {
    view,
    native,
    current: () => current,
    renders: () => renders,
    renderParent: () => view.rerender(<Example />),
  };
}

test('successful zoom updates and parent renders do not render over the live zoom label', async () => {
  const example = setup();
  await flushUI();
  const originalInputProps = example.view.getByTestId('zoom-value').props;
  await act(async () => {
    example.current().pinch.handlers.onStart?.({} as never);
    example.current().pinch.handlers.onUpdate?.({ scale: 2 } as never);
  });
  await flushUI();
  expect(example.current().liveZoom.get()).toBe(2);
  example.renderParent();
  expect(example.view.getByTestId('zoom-value').props).toBe(originalInputProps);
  expect(example.view.getByTestId('zoom-value')).toHaveAnimatedProps({ text: '2.0×' });
});

test('a remounted value label initializes native text from its current shared value', async () => {
  const value = makeMutable('3.0×');
  const style = { fontSize: 12 };
  const view = render(
    <View>
      <CameraValueLabel
        key="first"
        testID="value"
        accessibilityLabel="Camera zoom"
        value={value}
        style={style}
      />
    </View>,
  );
  await flushUI();
  expect(view.getByTestId('value').props.defaultValue).toBe('3.0×');
  act(() => value.set('4.0×'));
  await flushUI();
  view.rerender(
    <View>
      <CameraValueLabel
        key="second"
        testID="value"
        accessibilityLabel="Camera zoom"
        value={value}
        style={style}
      />
    </View>,
  );
  expect(view.getByTestId('value').props.defaultValue).toBe('4.0×');
  expect(view.getByTestId('value')).toHaveAnimatedProps({ text: '4.0×' });
});

test('pinching changes preset fill, text and step availability before React renders', async () => {
  const example = setup();
  await flushUI();
  const before = example.renders();
  expect(example.view.getByTestId('1×-surface')).toHaveAnimatedStyle({
    backgroundColor: colors.accent,
  });
  expect(example.view.getByTestId('Zoom out')).toHaveAnimatedStyle({ opacity: 0.4 });

  await act(async () => {
    example.current().pinch.handlers.onStart?.({} as never);
    example.current().pinch.handlers.onUpdate?.({ scale: 2 } as never);
  });
  await flushUI();

  expect(example.current().liveZoom.get()).toBe(2);
  expect(example.renders()).toBe(before);
  expect(example.view.getByTestId('1×-surface')).toHaveAnimatedStyle({
    backgroundColor: 'transparent',
  });
  expect(example.view.getByTestId('1×-text')).toHaveAnimatedStyle({ color: colors.text });
  expect(example.view.getByTestId('2×-surface')).toHaveAnimatedStyle({
    backgroundColor: colors.accent,
  });
  expect(example.view.getByTestId('2×-text')).toHaveAnimatedStyle({
    color: colors.background,
  });
  expect(example.view.getByTestId('Zoom out')).toHaveAnimatedStyle({ opacity: 1 });
  expect(example.view.getByTestId('Zoom out')).toHaveAnimatedProps({
    accessibilityState: { selected: false, disabled: false },
  });
});

test.each([
  { initial: 1, scale: 2, label: 'Zoom out', expected: 1.6 },
  { initial: 8, scale: 0.5, label: 'Zoom in', expected: 5 },
])('a live pinch enables $label without a React render', async (scenario) => {
  const example = setup(camera(scenario.initial));
  await flushUI();
  const rendersBeforePinch = example.renders();
  await act(async () => {
    example.current().pinch.handlers.onStart?.({} as never);
    example.current().pinch.handlers.onUpdate?.({ scale: scenario.scale } as never);
  });
  await flushUI();
  expect(example.current().liveZoom.get()).toBe(scenario.initial * scenario.scale);
  expect(example.renders()).toBe(rendersBeforePinch);
  const tap = getByGestureTestId(scenario.label);
  expect(tap.config.runOnJS).not.toBe(true);
  expect(tap.handlers.isWorklet.filter((value) => value !== undefined)).toEqual([true, true, true]);
  await act(async () => fireGestureHandler(tap));
  expect(example.native.setZoom).toHaveBeenLastCalledWith(scenario.expected);
});

test('a live pinch disables a limit step and a preset still activates on UI', async () => {
  const example = setup(camera(2));
  await flushUI();
  await act(async () => {
    example.current().pinch.handlers.onStart?.({} as never);
    example.current().pinch.handlers.onUpdate?.({ scale: 4 } as never);
  });
  await flushUI();
  expect(example.view.getByTestId('Zoom in')).toHaveAnimatedStyle({ opacity: 0.4 });
  const calls = example.native.setZoom.mock.calls.length;
  await act(async () => fireGestureHandler(getByGestureTestId('Zoom in')));
  expect(example.native.setZoom).toHaveBeenCalledTimes(calls);
  await act(async () => fireGestureHandler(getByGestureTestId('3×')));
  expect(example.native.setZoom).toHaveBeenLastCalledWith(3);
});

test.each(['ios', 'android'] as const)(
  '%s accessible activation reaches the same zoom operation as touch',
  async (platform) => {
    const platformOverride = jest.replaceProperty(Platform, 'OS', platform);
    try {
      const example = setup();
      await flushUI();
      const preset = example.view.getByLabelText('2×');
      expect(preset.props.onPress).toBeUndefined();
      if (platform === 'ios') fireEvent(preset, 'accessibilityTap');
      else fireEvent(preset, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
      await flushUI();
      expect(example.native.setZoom.mock.calls).toEqual([[2]]);

      await act(async () => fireGestureHandler(getByGestureTestId('3×')));
      await flushUI();
      expect(example.native.setZoom.mock.calls).toEqual([[2], [3]]);
    } finally {
      platformOverride.restore();
    }
  },
);

test.each(['ios', 'android'] as const)(
  '%s touch and accessibility obey live disabled state and camera readiness',
  async (platform) => {
    const platformOverride = jest.replaceProperty(Platform, 'OS', platform);
    const disabled = makeMutable(false);
    const activations = makeMutable(0);
    const onPressOnUI = () => {
      'worklet';
      activations.set(activations.get() + 1);
    };
    const button = (ready: boolean) => (
      <GestureHandlerRootView>
        <CameraControlButton
          label="Guarded action"
          ready={ready}
          disabled={disabled}
          onPressOnUI={onPressOnUI}
        />
      </GestureHandlerRootView>
    );

    try {
      const view = render(button(true));
      await flushUI();
      const props = view.getByTestId('Guarded action').props;
      const activateAccessibly =
        platform === 'ios'
          ? props.onAccessibilityTap
          : () => props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });

      await act(async () => fireGestureHandler(getByGestureTestId('Guarded action')));
      await flushUI();
      expect(activations.get()).toBe(1);

      act(() => disabled.set(true));
      // Deliver an already queued accessibility event after the UI flag changes.
      await act(async () => activateAccessibly());
      await act(async () => fireGestureHandler(getByGestureTestId('Guarded action')));
      await flushUI();
      expect(activations.get()).toBe(1);

      act(() => disabled.set(false));
      await act(async () => activateAccessibly());
      await flushUI();
      expect(activations.get()).toBe(2);

      view.rerender(button(false));
      await flushUI();
      const pausedProps = view.getByTestId('Guarded action').props;
      await act(async () => {
        if (platform === 'ios') pausedProps.onAccessibilityTap();
        else pausedProps.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
        fireGestureHandler(getByGestureTestId('Guarded action'));
      });
      await flushUI();
      expect(activations.get()).toBe(2);
    } finally {
      platformOverride.restore();
    }
  },
);
