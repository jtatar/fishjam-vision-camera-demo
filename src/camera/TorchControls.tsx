import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { CameraControlButton } from './CameraControlButton';
import { CameraValueLabel } from './CameraValueLabel';
import { colors } from '../ui';
import type { CameraControls } from './core';

type TorchControlsState = Pick<
  CameraControls,
  | 'desiredTorchStrength'
  | 'confirmedTorchEnabled'
  | 'confirmedTorchStrength'
  | 'torchLevels'
  | 'requestTorchOnUI'
  | 'toggleTorchOnUI'
  | 'ready'
>;

type TorchStep = { strength: number; label: string };
type TorchControlsProps = { controls: TorchControlsState };
type TorchLevelButtonProps = TorchControlsProps & { step: TorchStep };
type TorchBrightnessSliderProps = TorchControlsProps & { steps: TorchStep[] };

const TRACK_HEIGHT = 220;
const THUMB_SIZE = 26;
const THUMB_TRAVEL = TRACK_HEIGHT - THUMB_SIZE;

export function TorchControls({ controls }: TorchControlsProps) {
  const { desiredTorchStrength, confirmedTorchEnabled, torchLevels, toggleTorchOnUI, ready } =
    controls;
  const steps = useMemo(() => [{ strength: 0, label: 'Off' }, ...torchLevels], [torchLevels]);
  const isOn = useDerivedValue(() => desiredTorchStrength.get() > 0);
  const brightnessLabel = useDerivedValue(() => {
    const strength = desiredTorchStrength.get();
    return steps[findStepIndex(strength, steps)].label;
  });

  return (
    <View style={local.panel} testID="inline-light-control">
      <View style={local.heading}>
        <CameraControlButton
          icon="power"
          label={confirmedTorchEnabled ? 'Torch on' : 'Torch off'}
          testID="torch-power"
          selected={isOn}
          ready={ready}
          onPressOnUI={toggleTorchOnUI}
        />
        <CameraValueLabel
          testID="torch-value"
          accessibilityLabel="Flashlight brightness"
          value={brightnessLabel}
          style={local.value}
        />
      </View>
      <View style={local.levels}>
        <TorchBrightnessSlider controls={controls} steps={steps} />
        <View style={local.stops}>
          {steps
            .map((step) => <TorchLevelButton key={step.strength} step={step} controls={controls} />)
            .reverse()}
        </View>
      </View>
    </View>
  );
}

function TorchLevelButton({ step, controls }: TorchLevelButtonProps) {
  const { desiredTorchStrength, requestTorchOnUI, ready } = controls;
  const { strength, label } = step;
  const selected = useDerivedValue(() => desiredTorchStrength.get() === strength);
  const selectOnUI = useCallback(() => {
    'worklet';
    requestTorchOnUI(strength);
  }, [requestTorchOnUI, strength]);

  return (
    <CameraControlButton
      testID={strength ? `torch-level-${label}` : 'torch-level-off'}
      label={strength ? `Brightness ${label}` : 'Turn flashlight off'}
      text={label}
      variant="preset"
      ready={ready}
      selected={selected}
      onPressOnUI={selectOnUI}
      style={local.stop}
    />
  );
}

function TorchBrightnessSlider({ controls, steps }: TorchBrightnessSliderProps) {
  const {
    desiredTorchStrength,
    confirmedTorchEnabled,
    confirmedTorchStrength,
    requestTorchOnUI,
    ready,
  } = controls;
  const maxStepIndex = steps.length - 1;
  const selectedStepIndex = useDerivedValue(() => findStepIndex(desiredTorchStrength.get(), steps));
  const confirmedStepIndex = findStepIndex(
    confirmedTorchEnabled ? confirmedTorchStrength : 0,
    steps,
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - selectedStepIndex.get() / maxStepIndex) * THUMB_TRAVEL }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    height: (selectedStepIndex.get() / maxStepIndex) * THUMB_TRAVEL,
  }));

  const selectAtY = useCallback(
    (y: number) => {
      'worklet';
      const progress = Math.max(0, Math.min(1, 1 - (y - THUMB_SIZE / 2) / THUMB_TRAVEL));
      const stepIndex = Math.round(progress * maxStepIndex);
      requestTorchOnUI(steps[stepIndex].strength);
    },
    [maxStepIndex, steps, requestTorchOnUI],
  );
  const gesture = useMemo(
    () =>
      Gesture.Race(
        Gesture.Pan()
          .enabled(ready)
          .minDistance(0)
          .withTestId('torch-slider-pan')
          .onStart(({ y }) => selectAtY(y))
          .onUpdate(({ y }) => selectAtY(y)),
        Gesture.Tap()
          .enabled(ready)
          .withTestId('torch-slider-tap')
          .onEnd(({ y }, success) => {
            if (success) selectAtY(y);
          }),
      ),
    [ready, selectAtY],
  );
  const stepAccessibly = (direction: number) => {
    scheduleOnUI(() => {
      if (!ready) return;
      const nextStepIndex = Math.max(
        0,
        Math.min(maxStepIndex, selectedStepIndex.get() + direction),
      );
      requestTorchOnUI(steps[nextStepIndex].strength);
    });
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID="torch-slider"
        collapsable={false}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Flashlight brightness"
        accessibilityState={{ disabled: !ready }}
        accessibilityValue={{
          min: 0,
          max: maxStepIndex,
          now: confirmedStepIndex,
          text: steps[confirmedStepIndex].label,
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'increment') stepAccessibly(1);
          if (nativeEvent.actionName === 'decrement') stepAccessibly(-1);
        }}
        style={local.track}
      >
        <View pointerEvents="none" style={local.rail}>
          <Animated.View testID="torch-slider-fill" style={[local.fill, fillStyle]} />
        </View>
        <Animated.View
          testID="torch-slider-thumb"
          pointerEvents="none"
          style={[local.thumb, thumbStyle]}
        />
      </View>
    </GestureDetector>
  );
}

function findStepIndex(strength: number, steps: TorchStep[]) {
  'worklet';
  return Math.max(
    0,
    steps.findIndex((step) => step.strength === strength),
  );
}

const local = StyleSheet.create({
  panel: {
    backgroundColor: '#121C22F2',
    borderWidth: 1,
    borderColor: '#FFFFFF26',
    borderRadius: 22,
    padding: 10,
    gap: 8,
    boxShadow: '0 8px 24px #00000033',
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: {
    color: colors.accent,
    padding: 0,
    minWidth: 34,
    fontWeight: '700',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  levels: { flexDirection: 'row' },
  track: { width: 44, height: TRACK_HEIGHT },
  rail: {
    position: 'absolute',
    width: 4,
    left: 20,
    top: THUMB_SIZE / 2,
    height: THUMB_TRAVEL,
    borderRadius: 2,
    backgroundColor: '#FFFFFF38',
    overflow: 'hidden',
  },
  fill: { position: 'absolute', bottom: 0, width: 4, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    top: 0,
    left: (44 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.accent,
  },
  stops: { flex: 1, height: TRACK_HEIGHT },
  stop: { flex: 1, minHeight: 44 },
});
