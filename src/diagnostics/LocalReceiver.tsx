import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RTCView, type MediaStream } from '@fishjam-cloud/react-native-client';
import { createLoopback } from './loopback';
import { Notice, colors } from '../ui';
import { IconButton } from '../studio/controls';
import { errorMessage } from '../errors';

export function LocalReceiver({ stream, onClose }: { stream: MediaStream; onClose: () => void }) {
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [state, setState] = useState('connecting');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] =
    useState<Awaited<ReturnType<ReturnType<typeof createLoopback>['stats']>>>(null);

  useEffect(() => {
    let disposed = false;
    let polling = false;
    setRemote(null);
    setStats(null);
    setState('connecting');
    setError(null);
    const loopback = createLoopback(stream, setRemote, setState);
    void loopback.connect().catch((cause) => {
      if (!disposed) {
        setError(errorMessage(cause));
        loopback.close();
      }
    });
    const interval = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const next = await loopback.stats();
        if (!disposed) setStats(next);
      } catch (cause) {
        if (!disposed) setError(errorMessage(cause));
      } finally {
        polling = false;
      }
    }, 1000);
    return () => {
      disposed = true;
      clearInterval(interval);
      loopback.close();
    };
  }, [stream]);

  return (
    <View style={local.panel}>
      <View style={local.header}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={local.title}>Stream check</Text>
          <Text style={local.caption}>On this device</Text>
        </View>
        <IconButton icon="close" label="Close stream check" onPress={onClose} />
      </View>
      {remote && (
        <RTCView
          testID="loopback-video"
          mediaStream={remote}
          objectFit="contain"
          style={local.video}
        />
      )}
      <Text testID="loopback-stats" style={local.stats}>
        {state} · {stats?.frames ?? 0} decoded frames · {stats?.fps ?? 0} fps
        {stats?.width ? ` · ${stats.width} × ${stats.height}` : ''}
      </Text>
      {error && <Notice error>{error}</Notice>}
    </View>
  );
}

const local = StyleSheet.create({
  panel: {
    padding: 12,
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#101719',
    borderWidth: 1,
    borderColor: '#FFFFFF24',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 11 },
  video: { height: 180, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' },
  stats: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});
