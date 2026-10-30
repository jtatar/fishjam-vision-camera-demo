import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type MediaStream } from '@fishjam-cloud/react-native-client';
import { useFocusEffect } from 'expo-router';
import { CameraPublisher } from '../camera/CameraPublisher';
import { type RoomConfig } from '../config';
import { Button, Card, Notice, colors, styles } from '../ui';
import { Icon, IconButton } from '../studio/controls';
import { StreamSettings } from '../studio/StreamSettings';
import { useLivestreamSession } from './useLivestreamSession';
import { RemoteStreams } from './RemoteStreams';
import { MicrophoneButton } from './MicrophoneButton';

export function RoomScreen({
  config,
  title,
  mode,
  onBack,
}: {
  config: RoomConfig;
  title: string;
  mode: 'camera' | 'viewer';
  onBack: () => void;
}) {
  const [video, setVideo] = useState<MediaStream | null>(null);
  const session = useLivestreamSession(config, mode, video);
  const [settings, setSettings] = useState(false);
  const [ready, setReady] = useState(false);
  const connected = session.connected;
  const joining = session.busy;
  const configured = !!config.fishjamId.trim() && !!config.sandboxUrl.trim();
  const error = session.error;
  const leave = session.leave;
  const close = useCallback(() => {
    if (mode === 'camera' && connected)
      Alert.alert(
        'End your live stream?',
        'Your audience will no longer receive your camera or microphone.',
        [
          { text: 'Keep streaming', style: 'cancel' },
          {
            text: 'End stream',
            style: 'destructive',
            onPress: () => {
              leave();
              onBack();
            },
          },
        ],
      );
    else {
      leave();
      onBack();
    }
  }, [connected, leave, onBack, mode]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => subscription.remove();
    }, [close]),
  );

  function primaryAction() {
    if (connected) {
      Alert.alert('End your live stream?', 'You can start another stream from the preview.', [
        { text: 'Keep streaming', style: 'cancel' },
        { text: 'End stream', style: 'destructive', onPress: leave },
      ]);
    } else if (joining) leave();
    else if (!configured) setSettings(true);
    else void session.join();
  }
  const buttonLabel = connected
    ? 'End live'
    : joining
      ? 'Cancel connecting'
      : !configured
        ? 'Set up stream'
        : 'Go live';
  const header = (
    <View style={local.header}>
      <IconButton icon="close" label="Back" onPress={close} />
      <View style={local.statusGroup}>
        <View style={[local.status, connected && local.live]}>
          <View style={[local.statusDot, connected && { backgroundColor: '#FFF' }]} />
          <Text testID="stream-status" style={local.statusText}>
            {connected ? 'LIVE' : joining ? 'CONNECTING' : 'PREVIEW'}
          </Text>
        </View>
        {connected && <LiveTimer />}
      </View>
      <IconButton
        icon="options-outline"
        label="Stream details"
        disabled={connected || joining}
        onPress={() => setSettings(true)}
      />
    </View>
  );
  const footer = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit stream details"
        disabled={connected || joining}
        onPress={() => setSettings(true)}
        style={local.streamTitle}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={local.eyebrow}>{connected ? 'YOU’RE LIVE' : 'READY WHEN YOU ARE'}</Text>
          <Text style={local.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {!connected && !joining && <Icon name="create-outline" size={19} color="#C8D0D4" />}
      </Pressable>
      {error && <Notice error>{error}</Notice>}
      {session.microphone.warning && <Notice>{session.microphone.warning}</Notice>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        accessibilityState={{
          disabled: configured && !ready && !connected && !joining,
        }}
        disabled={configured && !ready && !connected && !joining}
        onPress={primaryAction}
        style={({ pressed }) => [
          local.goLive,
          connected && local.endLive,
          configured && !ready && !connected && !joining && styles.disabled,
          pressed && { opacity: 0.75 },
        ]}
      >
        <Icon
          name={connected ? 'stop-circle-outline' : joining ? 'close' : 'radio'}
          color="#FFF"
          size={22}
        />
        <Text style={local.goLiveText}>{buttonLabel}</Text>
      </Pressable>
      <Text style={local.footerHint}>
        {connected
          ? 'Broadcasting live · You control your mic'
          : configured
            ? 'Your mic starts muted. Enable it when you’re live.'
            : 'Only you can see this preview'}
      </Text>
    </>
  );

  if (mode === 'viewer')
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={local.header}>
            <IconButton icon="arrow-back" label="Back" onPress={close} />
            <Text style={styles.eyebrow}>WATCH LIVE</Text>
            <IconButton
              icon="options-outline"
              label="Stream details"
              disabled={connected || joining}
              onPress={() => setSettings(true)}
            />
          </View>
          <Text style={styles.title}>Watch the stream.</Text>
          <Card>
            <Text style={styles.heading}>{config.roomName}</Text>
            <Notice>
              {connected
                ? 'Connected to the livestream'
                : 'Use the same room name as your host. Start watching after they go live.'}
            </Notice>
            {!configured && <Notice>Add a Fishjam connection in stream details to watch.</Notice>}
            <Button
              primary
              label={
                connected ? 'Stop watching' : joining ? 'Cancel connecting' : 'Watch livestream'
              }
              disabled={!configured}
              onPress={() => {
                if (connected || joining) leave();
                else void session.join();
              }}
            />
            {error && <Notice error>{error}</Notice>}
          </Card>
          <RemoteStreams stream={session.stream} name={config.roomName} />
        </ScrollView>
        {settings && <StreamSettings onClose={() => setSettings(false)} />}
      </SafeAreaView>
    );

  return (
    <>
      <CameraPublisher
        header={header}
        footer={footer}
        microphone={
          <MicrophoneButton connected={connected} microphone={session.microphone} compact />
        }
        onReadyChange={setReady}
        onStreamChange={setVideo}
      />
      {settings && <StreamSettings onClose={() => setSettings(false)} />}
    </>
  );
}

function LiveTimer() {
  const [started] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [started]);
  return (
    <Text accessibilityLabel="Stream duration" style={local.timer}>
      {Math.floor(elapsed / 60)
        .toString()
        .padStart(2, '0')}
      :{(elapsed % 60).toString().padStart(2, '0')}
    </Text>
  );
}

const local = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  statusGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: {
    backgroundColor: '#151A20CC',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  live: { backgroundColor: '#EC425C' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#BBC6CB' },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  timer: { color: '#FFF', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  streamTitle: { flexDirection: 'row', gap: 16, alignItems: 'center', minHeight: 48 },
  eyebrow: { color: '#C8D0D4', fontSize: 9, fontWeight: '700', letterSpacing: 1.8 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  goLive: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#EC425C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  endLive: { backgroundColor: '#381C25', borderWidth: 1, borderColor: '#EC425C' },
  goLiveText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  footerHint: { color: '#BCC5C9', fontSize: 11, textAlign: 'center' },
});
