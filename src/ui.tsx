import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export const colors = {
  background: '#0C1518',
  panel: '#162328',
  line: '#2B3C42',
  text: '#F3F8F7',
  muted: '#9CB2B6',
  accent: '#9CF2CE',
  danger: '#FFB3AC',
};

export function Button({
  label,
  onPress,
  disabled = false,
  primary = false,
  selected,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        disabled && styles.disabled,
        style,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.buttonText, primary && { color: colors.background }]}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return (
    <Text
      accessibilityRole={error ? 'alert' : undefined}
      style={[styles.notice, error && { color: colors.danger }]}
    >
      {children}
    </Text>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  heading: { color: colors.text, fontSize: 19, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  button: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.panel,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  notice: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  input: {
    color: colors.text,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 16,
    backgroundColor: colors.background,
  },
});
