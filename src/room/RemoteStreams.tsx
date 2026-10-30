import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RTCView } from '@fishjam-cloud/react-native-client';
import type { MediaStream } from '@fishjam-cloud/react-native-client';
import { Icon, IconButton } from '../studio/controls';
import { Card, Notice, styles } from '../ui';
import { FullscreenStream } from './FullscreenStream';

export function RemoteStreams({ stream, name }: { stream: MediaStream | null; name: string }) {
  return stream ? (
    <RemoteStreamCard key={stream.id} stream={stream} name={name} />
  ) : (
    <Card>
      <Notice>Your host’s video will appear here when you connect to their livestream.</Notice>
    </Card>
  );
}

function RemoteStreamCard({ stream, name }: { stream: MediaStream; name: string }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <Card>
      <View style={local.heading}>
        <Text style={[styles.heading, local.name]}>{name}</Text>
        <IconButton
          icon="expand-outline"
          label={`View ${name} fullscreen`}
          onPress={() => setFullscreen(true)}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name} video fullscreen`}
        onPress={() => setFullscreen(true)}
        style={local.preview}
      >
        {!fullscreen && (
          <RTCView mediaStream={stream} objectFit="contain" style={StyleSheet.absoluteFill} />
        )}
        <View pointerEvents="none" style={local.expand}>
          <Icon name="expand-outline" size={20} />
        </View>
      </Pressable>
      {fullscreen && <FullscreenStream stream={stream} onClose={() => setFullscreen(false)} />}
    </Card>
  );
}

const local = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1 },
  preview: { height: 280, backgroundColor: '#000' },
  expand: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#14191FD9',
  },
});
