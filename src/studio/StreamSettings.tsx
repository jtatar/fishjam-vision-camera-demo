import { useState } from 'react';
import { Keyboard, Text, TextInput, View } from 'react-native';
import { Button, Notice, colors, styles } from '../ui';
import { Collapsible } from './Collapsible';
import { Sheet } from './controls';
import { useStudio } from './StudioContext';

export function StreamSettings({ onClose }: { onClose: () => void }) {
  const { draft, saveDraft } = useStudio();
  const [edited, setEdited] = useState(draft);
  const [showDetails, setShowDetails] = useState(() =>
    [draft.title, ...Object.values(draft.connection)].some((value) => !value.trim()),
  );
  const valid =
    !!edited.title.trim() &&
    !!edited.connection.roomName.trim() &&
    !!edited.connection.peerName.trim();
  return (
    <Sheet
      visible
      title="Stream details"
      subtitle="Get everything ready before you go live."
      onClose={onClose}
    >
      <View>
        <Button
          label={showDetails ? 'Hide stream details' : 'Show stream details'}
          onPress={() => {
            if (showDetails) Keyboard.dismiss();
            setShowDetails((shown) => !shown);
          }}
        />
        <Collapsible expanded={showDetails}>
          <View style={{ gap: 16, paddingTop: 16 }}>
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Stream title</Text>
              <TextInput
                accessibilityLabel="Stream title"
                value={edited.title}
                maxLength={80}
                onChangeText={(title) => setEdited({ ...edited, title })}
                style={styles.input}
                placeholder="Give your stream a title"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
              />
            </View>
            {(
              [
                ['roomName', 'Room name'],
                ['peerName', 'Host name'],
              ] as const
            ).map(([field, label]) => (
              <View key={field} style={{ gap: 8 }}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  accessibilityLabel={label}
                  value={edited.connection[field]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={100}
                  style={styles.input}
                  returnKeyType="done"
                  onChangeText={(value) =>
                    setEdited({ ...edited, connection: { ...edited.connection, [field]: value } })
                  }
                />
              </View>
            ))}
            <Notice>
              Add your Fishjam connection to broadcast. You can use the camera without it.
            </Notice>
            {(
              [
                ['fishjamId', 'Fishjam ID', 'Your Fishjam ID'],
                ['sandboxUrl', 'Sandbox API URL', 'https://…'],
              ] as const
            ).map(([field, label, placeholder]) => (
              <View key={field} style={{ gap: 8 }}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  accessibilityLabel={label}
                  testID={field}
                  value={edited.connection[field]}
                  onChangeText={(value) =>
                    setEdited({ ...edited, connection: { ...edited.connection, [field]: value } })
                  }
                  placeholder={placeholder}
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={field === 'sandboxUrl' ? 'url' : 'default'}
                  style={styles.input}
                  returnKeyType="done"
                />
              </View>
            ))}
            <Notice>
              Settings are kept for this session. Use a different host name on each device.
            </Notice>
          </View>
        </Collapsible>
      </View>
      <Button
        primary
        label="Save details"
        disabled={!valid}
        onPress={() => {
          saveDraft({ title: edited.title.trim(), connection: edited.connection });
          onClose();
        }}
      />
    </Sheet>
  );
}
