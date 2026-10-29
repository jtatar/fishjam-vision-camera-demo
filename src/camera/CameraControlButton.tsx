import { useCallback, useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import type { IconName } from '../studio/controls';
import { colors } from '../ui';

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

type SharedFlag = Pick<SharedValue<boolean>, 'get'>;

type CameraControlButtonProps = {
  label: string;
  text?: string;
  icon?: IconName;
  caption?: string;
  ready?: boolean;
  selected?: SharedFlag;
  disabled?: SharedFlag;
  onPressOnUI: () => void;
  variant?: 'circle' | 'preset';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Touch and accessibility activate the same guarded UI worklet. */
export function CameraControlButton({
  label,
  text,
  icon,
  caption,
  ready = true,
  selected,
  disabled,
  onPressOnUI,
  variant = 'circle',
  style,
  testID = label,
}: CameraControlButtonProps) {
  const pressed = useSharedValue(false);
  const activateOnUI = useCallback(() => {
    'worklet';
    if (!ready || disabled?.get()) return;
    onPressOnUI();
  }, [ready, disabled, onPressOnUI]);
  const activateAccessibly = useCallback(() => scheduleOnUI(activateOnUI), [activateOnUI]);

  const tap = useMemo(
    () =>
      Gesture.Tap()
        // Read the live limit inside the worklet so a pinch can enable a step
        // without waiting for a React render.
        .enabled(ready)
        .withTestId(testID)
        .onBegin(() => {
          pressed.set(ready && !disabled?.get());
        })
        .onEnd((_, success) => {
          if (success) activateOnUI();
        })
        .onFinalize(() => {
          pressed.set(false);
        }),
    [ready, testID, disabled, pressed, activateOnUI],
  );

  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: !ready || disabled?.get() ? 0.4 : pressed.get() ? 0.65 : 1,
  }));
  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: selected?.get()
      ? colors.accent
      : variant === 'circle'
        ? '#14191FD9'
        : 'transparent',
    borderColor: selected?.get() ? colors.accent : '#FFFFFF20',
  }));
  const foregroundStyle = useAnimatedStyle(() => ({
    color: selected?.get() ? colors.background : colors.text,
  }));
  const accessibilityProps = useAnimatedProps<ViewProps>(() => ({
    accessibilityState: {
      selected: selected?.get() ?? false,
      disabled: !ready || (disabled?.get() ?? false),
    },
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        testID={testID}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        animatedProps={accessibilityProps}
        // Android maps activate to ACTION_CLICK; iOS uses accessibilityActivate.
        // Register just one platform-specific entry point to avoid double toggles.
        accessibilityActions={Platform.OS === 'android' ? [{ name: 'activate' }] : undefined}
        onAccessibilityAction={
          Platform.OS === 'android'
            ? ({ nativeEvent }) => {
                if (nativeEvent.actionName === 'activate') activateAccessibly();
              }
            : undefined
        }
        onAccessibilityTap={Platform.OS === 'ios' ? activateAccessibly : undefined}
        style={[variant === 'circle' ? local.tool : local.preset, feedbackStyle, style]}
      >
        <Animated.View
          testID={`${testID}-surface`}
          style={[variant === 'circle' ? local.circle : local.preset, surfaceStyle]}
        >
          {icon ? (
            <AnimatedIcon name={icon} size={22} accessible={false} style={foregroundStyle} />
          ) : (
            <Animated.Text
              testID={`${testID}-text`}
              accessible={false}
              style={[local.text, foregroundStyle]}
            >
              {text}
            </Animated.Text>
          )}
        </Animated.View>
        {caption && <Text style={local.caption}>{caption}</Text>}
      </Animated.View>
    </GestureDetector>
  );
}

const local = StyleSheet.create({
  tool: { alignItems: 'center', gap: 5, minWidth: 48, minHeight: 48 },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preset: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 14, fontWeight: '700' },
  caption: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: '#0009',
    textShadowRadius: 5,
  },
});
