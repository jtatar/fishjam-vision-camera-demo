import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePeers } from '@fishjam-cloud/react-native-client';
import { useFocusEffect } from 'expo-router';
import { CameraPublisher } from '../camera/CameraPublisher';
import { type RoomConfig } from '../config';
import { Button, Card, Notice, colors, styles } from '../ui';
import { Icon, IconButton } from '../studio/controls';
import { StreamSettings } from '../studio/StreamSettings';
import { useRoomSession } from './useRoomSession';
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
  const session = useRoomSession(config);
  const { remotePeers } = usePeers();
  const [settings, setSettings] = useState(false);
  const [ready, setReady] = useState(false);
  const connected = session.peerStatus === 'connected';
  const reconnecting = session.reconnectionStatus === 'reconnecting';
  const joining = session.busy || session.peerStatus === 'connecting';
  const configured = !!config.fishjamId.trim() && !!config.sandboxUrl.trim();
  const error =
    session.error ??
    (session.reconnectionStatus === 'error'
      ? 'Connection lost. End this stream and try again.'
      : session.peerStatus === 'error'
        ? 'Couldn’t connect. Check your stream details and try again.'
        : null);
  const leave = session.leave;
  const close = useCallback(() => {
    if (mode === 'camera' && (connected || reconnecting))
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
  }, [connected, reconnecting, leave, onBack, mode]);
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
    if (connected || reconnecting) {
      Alert.alert('End your live stream?', 'You can start another stream from the preview.', [
        { text: 'Keep streaming', style: 'cancel' },
        { text: 'End stream', style: 'destructive', onPress: leave },
      ]);
    } else if (joining) leave();
    else if (!configured) setSettings(true);
    else void session.join();
  }
  const buttonLabel =
    connected || reconnecting
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
        <View style={[local.status, connected && !reconnecting && local.live]}>
          <View
            style={[local.statusDot, connected && !reconnecting && { backgroundColor: '#FFF' }]}
          />
          <Text testID="stream-status" style={local.statusText}>
            {reconnecting
              ? 'RECONNECTING'
              : connected
                ? 'LIVE'
                : joining
                  ? 'CONNECTING'
                  : 'PREVIEW'}
          </Text>
        </View>
        {(connected || reconnecting) && <LiveTimer />}
      </View>
      <IconButton
        icon="options-outline"
        label="Stream details"
        disabled={connected || joining || reconnecting}
        onPress={() => setSettings(true)}
      />
    </View>
  );
  const footer = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit stream details"
        disabled={connected || joining || reconnecting}
        onPress={() => setSettings(true)}
        style={local.streamTitle}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={local.eyebrow}>{connected ? 'YOU’RE LIVE' : 'READY WHEN YOU ARE'}</Text>
          <Text style={local.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {!connected && !joining && !reconnecting && (
          <Icon name="create-outline" size={19} color="#C8D0D4" />
        )}
      </Pressable>
      {error && <Notice error>{error}</Notice>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        accessibilityState={{
          disabled: configured && !ready && !connected && !joining && !reconnecting,
        }}
        disabled={configured && !ready && !connected && !joining && !reconnecting}
        onPress={primaryAction}
        style={({ pressed }) => [
          local.goLive,
          (connected || reconnecting) && local.endLive,
          configured && !ready && !connected && !joining && !reconnecting && styles.disabled,
          pressed && { opacity: 0.75 },
        ]}
      >
        <Icon
          name={connected || reconnecting ? 'stop-circle-outline' : joining ? 'close' : 'radio'}
          color="#FFF"
          size={22}
        />
        <Text style={local.goLiveText}>{buttonLabel}</Text>
      </Pressable>
      <Text style={local.footerHint}>
        {reconnecting
          ? 'Trying to restore your connection…'
          : connected
            ? `${remotePeers.length} ${remotePeers.length === 1 ? 'participant' : 'participants'} connected · You control your mic`
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
                ? 'Connected to the room'
                : 'Join the same room as your host to watch their stream.'}
            </Notice>
            {!configured && <Notice>Add a Fishjam connection in stream details to watch.</Notice>}
            <Button
              primary
              label={connected ? 'Leave room' : joining ? 'Cancel joining' : 'Join as viewer'}
              disabled={!configured}
              onPress={() => {
                if (connected || joining) leave();
                else void session.join();
              }}
            />
            {error && <Notice error>{error}</Notice>}
          </Card>
          <RemoteStreams />
        </ScrollView>
        {settings && <StreamSettings onClose={() => setSettings(false)} />}
      </SafeAreaView>
    );

  return (
    <>
      <CameraPublisher
        header={header}
        footer={footer}
        microphone={<MicrophoneButton connected={connected} compact />}
        onReadyChange={setReady}
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
