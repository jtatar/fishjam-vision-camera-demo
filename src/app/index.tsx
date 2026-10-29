import { useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, IconButton } from '../studio/controls';
import { StreamSettings } from '../studio/StreamSettings';
import { useStudio } from '../studio/StudioContext';
import { colors, styles } from '../ui';

export default function StudioHome() {
  const [settings, setSettings] = useState(false);
  const { draft } = useStudio();
  const configured = !!draft.connection.fishjamId.trim() && !!draft.connection.sandboxUrl.trim();
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={local.content} bounces={false}>
        <View style={local.header}>
          <View style={local.brand}>
            <Icon name="radio" color={colors.accent} />
            <Text style={local.brandText}>LIVE STUDIO</Text>
          </View>
          <IconButton
            icon="options-outline"
            label="Room settings"
            onPress={() => setSettings(true)}
          />
        </View>
        <View style={local.intro}>
          <Text style={local.kicker}>YOUR NEXT LIVE MOMENT</Text>
          <Text style={local.title}>{'Show it.\nTell the story.'}</Text>
          <Text style={local.description}>
            Bring your products closer. Connect with your audience, live.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open studio"
          onPress={() => router.push('/camera')}
          style={({ pressed }) => [local.hero, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient colors={['#243B35', '#192723', '#192024']} style={local.heroGradient}>
            <View style={local.heroTop}>
              <View style={local.cameraIcon}>
                <Icon name="videocam-outline" size={30} color={colors.accent} />
              </View>
              <Text style={local.draft}>DRAFT</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={local.heroTitle} numberOfLines={2}>
                {draft.title}
              </Text>
              <Text style={styles.body}>Frame your shot. Find your light.</Text>
            </View>
            <View style={local.open}>
              <Text style={local.openText}>Open studio</Text>
              <Icon name="arrow-forward" color={colors.background} />
            </View>
          </LinearGradient>
        </Pressable>
        <View style={local.connection}>
          <View
            style={[local.dot, { backgroundColor: configured ? colors.accent : colors.muted }]}
          />
          <Text style={styles.notice}>
            {configured
              ? 'Stream connection ready'
              : 'Camera ready to explore · Connect when you’re ready'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Join as a viewer"
          onPress={() => router.push('/viewer')}
          style={local.watch}
        >
          <Icon name="play-circle-outline" size={27} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={local.watchTitle}>Join as a viewer</Text>
            <Text style={styles.notice}>Watch a stream from another device</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Text style={local.powered}>POWERED BY FISHJAM</Text>
      </ScrollView>
      {settings && <StreamSettings onClose={() => setSettings(false)} />}
    </SafeAreaView>
  );
}
const local = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { color: colors.text, fontWeight: '800', fontSize: 13, letterSpacing: 2 },
  intro: { gap: 8 },
  kicker: { color: colors.accent, fontWeight: '600', fontSize: 10, letterSpacing: 2.4 },
  title: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.5,
    fontWeight: '700',
  },
  description: { color: colors.muted, fontSize: 16, lineHeight: 22, maxWidth: 300 },
  hero: { borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: '#385149' },
  heroGradient: { padding: 18, gap: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#9CF2CE10',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  draft: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '700',
    backgroundColor: '#9CF2CE10',
    padding: 8,
    borderRadius: 6,
  },
  heroTitle: { color: colors.text, fontSize: 23, fontWeight: '600', letterSpacing: -0.7 },
  open: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  connection: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  watch: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  watchTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  powered: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 2,
    textAlign: 'center',
    opacity: 0.7,
  },
});
