import { useEffect, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export function Collapsible({ expanded, children }: PropsWithChildren<{ expanded: boolean }>) {
  const height = useSharedValue(0);
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: 240 });
  }, [expanded, progress]);

  const style = useAnimatedStyle(() => ({
    height: height.value * progress.value,
    opacity: progress.value,
  }));

  return (
    <Animated.View
      style={[{ overflow: 'hidden' }, style]}
      pointerEvents={expanded ? 'auto' : 'none'}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
    >
      <View
        style={{ position: 'absolute', left: 0, right: 0 }}
        onLayout={({ nativeEvent }) => {
          height.value = nativeEvent.layout.height;
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}
