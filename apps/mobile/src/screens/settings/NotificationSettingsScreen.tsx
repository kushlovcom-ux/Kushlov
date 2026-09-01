import React, { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '@/components/ui/Text';
import { Switch } from '@/components/ui/Switch';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { ensureNotificationPermissions, getExpoPushToken } from '@/services/notifications';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'NotificationSettings'>;

const KEY = 'kushlov.notif.prefs';

export function NotificationSettingsScreen({ navigation }: Props) {
  const [messages, setMessages] = useState(true);
  const [calls, setCalls] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as {
          messages?: boolean;
          calls?: boolean;
          marketing?: boolean;
        };
        if (parsed.messages != null) setMessages(parsed.messages);
        if (parsed.calls != null) setCalls(parsed.calls);
        if (parsed.marketing != null) setMarketing(parsed.marketing);
      } catch {
        // ignore
      }
    });
    getExpoPushToken().then(setToken);
  }, []);

  const persist = async (next: { messages: boolean; calls: boolean; marketing: boolean }) => {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  };

  const enableSystem = async () => {
    const ok = await ensureNotificationPermissions();
    if (!ok) {
      Alert.alert(
        'Notifications disabled',
        'Kushlov cannot show messages or incoming calls until you enable notifications in system settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    const t = await getExpoPushToken();
    setToken(t);
    Alert.alert('Enabled', t ? 'This device will receive push notifications.' : 'Permissions granted.');
  };

  return (
    <Screen scroll>
      <Header title="Notifications" onBack={() => navigation.goBack()} />
      <Row
        label="Messages"
        value={messages}
        onChange={(v) => {
          setMessages(v);
          persist({ messages: v, calls, marketing });
        }}
      />
      <Row
        label="Calls"
        value={calls}
        onChange={(v) => {
          setCalls(v);
          persist({ messages, calls: v, marketing });
        }}
      />
      <Row
        label="Announcements"
        value={marketing}
        onChange={(v) => {
          setMarketing(v);
          persist({ messages, calls, marketing: v });
        }}
      />
      <View style={{ height: spacing.lg }} />
      <Text muted variant="caption">
        Device token: {token ? `${token.slice(0, 24)}…` : 'not registered'}
      </Text>
      <View style={{ height: spacing.md }} />
      <Text muted variant="caption">
        If you previously denied permission, use Open Settings to enable alerts, sound, and badge.
        Incoming calls need notification permission (and on Android 14+, Full screen notifications
        for lock-screen ringing).
      </Text>
      <View style={{ height: spacing.md }} />
      <Text color="#ec4899" onPress={enableSystem}>
        Enable system notifications
      </Text>
      <View style={{ height: spacing.sm }} />
      <Text color="#ec4899" onPress={() => void Linking.openSettings()}>
        Open system settings
      </Text>
    </Screen>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
      }}
    >
      <Text>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
