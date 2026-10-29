import { Component, type PropsWithChildren } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FishjamProvider } from '@fishjam-cloud/react-native-client';
import { RoomScreen } from '../room/RoomScreen';
import { Button, Notice, styles } from '../ui';
import { useStudio } from './StudioContext';

function backToStudio() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

class CameraBoundary extends Component<PropsWithChildren, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <SafeAreaView style={[styles.screen, styles.content]}>
        <Text style={styles.title}>Unable to open studio</Text>
        <Notice error>{this.state.error.message}</Notice>
        <Button label="Back to studio" onPress={backToStudio} />
      </SafeAreaView>
    );
  }
}

export function SessionScreen({ mode }: { mode: 'camera' | 'viewer' }) {
  const { draft } = useStudio();
  const fishjamId = draft.connection.fishjamId.trim() || 'local-preview';
  return (
    <CameraBoundary>
      <FishjamProvider key={fishjamId} fishjamId={fishjamId}>
        <RoomScreen
          config={draft.connection}
          title={draft.title}
          mode={mode}
          onBack={backToStudio}
        />
      </FishjamProvider>
    </CameraBoundary>
  );
}
