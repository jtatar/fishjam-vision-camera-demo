import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StudioProvider } from '../studio/StudioContext';
import { colors, styles } from '../ui';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.screen}>
      <SafeAreaProvider>
        <StudioProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: false,
              animation: 'fade',
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </StudioProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
