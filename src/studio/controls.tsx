import type { ComponentProps, PropsWithChildren } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, styles } from '../ui';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({
  name,
  size = 22,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}

export function IconButton({
  icon,
  label,
  caption,
  onPress,
  selected = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  caption?: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        local.tool,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.65 },
      ]}
    >
      <View style={[local.circle, selected && local.selected]}>
        <Icon name={icon} color={selected ? colors.background : colors.text} />
      </View>
      {caption && <Text style={local.caption}>{caption}</Text>}
    </Pressable>
  );
}

export function Sheet({
  title,
  subtitle,
  visible,
  onClose,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  visible: boolean;
  onClose: () => void;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={local.modal}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${title}`}
        />
        <View
          accessibilityViewIsModal
          style={[local.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={local.handle} />
          <View style={local.sheetHeading}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text accessibilityRole="header" style={styles.heading}>
                {title}
              </Text>
              {subtitle && <Text style={styles.notice}>{subtitle}</Text>}
            </View>
            <IconButton icon="close" label={`Close ${title}`} onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={local.sheetContent}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const local = StyleSheet.create({
  tool: { alignItems: 'center', gap: 5, minWidth: 48, minHeight: 48 },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#14191FD9',
    borderWidth: 1,
    borderColor: '#FFFFFF20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  caption: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: '#0009',
    textShadowRadius: 5,
  },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0007' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.panel,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF30',
    alignSelf: 'center',
    marginTop: 10,
  },
  sheetHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    paddingBottom: 16,
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
});
