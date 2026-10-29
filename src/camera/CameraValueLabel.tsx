import { memo } from 'react';
import { TextInput, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type CameraValueLabelProps = {
  value: SharedValue<string>;
  accessibilityLabel: string;
  testID: string;
  style: StyleProp<TextStyle>;
};

// TextInput derives its native text from value/defaultValue whenever React renders
// it. Keep this leaf isolated from hardware confirmations and other parent state.
export const CameraValueLabel = memo(function CameraValueLabel({
  value,
  accessibilityLabel,
  testID,
  style,
}: CameraValueLabelProps) {
  const animatedProps = useAnimatedProps<TextInputProps & { text: string }>(() => {
    const text = value.get();
    // Reanimated's initial props give a remounted label its current value; later
    // changes update native text directly without a React render.
    return { text, defaultValue: text };
  });

  return (
    <AnimatedTextInput
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      editable={false}
      caretHidden
      pointerEvents="none"
      animatedProps={animatedProps}
      style={style}
    />
  );
});
