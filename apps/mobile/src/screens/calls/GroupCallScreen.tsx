import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { SearchBar } from '@/components/common/SearchBar';
import { callsApi } from '@/api/calls';
import { apiGet, getErrorMessage } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useCallStore } from '@/store/call';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import { CallType, type Paginated, type PublicUser } from '@/types';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'GroupCall'>;

const MAX = 5;

export function GroupCallScreen({ navigation }: Props) {
  const c = useThemeColors();
  const { user } = useAuth();
  const startCall = useCallStore((s) => s.startCall);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);

  const list = useQuery({
    queryKey: ['group-call-users', debounced],
    queryFn: () =>
      apiGet<Paginated<PublicUser>>('/users', {
        params: { q: debounced || undefined, limit: 24, online: true },
      }),
  });

  const selectedIds = useMemo(() => new Set(selected.map((u) => u.id)), [selected]);

  const toggle = (u: PublicUser) => {
    if (u.id === user?.id) return;
    setSelected((prev) => {
      if (prev.some((p) => p.id === u.id)) return prev.filter((p) => p.id !== u.id);
      if (prev.length >= MAX) {
        Alert.alert('Limit', `Pick up to ${MAX} people`);
        return prev;
      }
      return [...prev, u];
    });
  };

  const start = async (type: CallType) => {
    if (selected.length === 0) {
      Alert.alert('Select people', 'Pick at least one person for the group call.');
      return;
    }
    setLoading(true);
    try {
      const [primary, ...rest] = selected;
      const session = await callsApi.initiate({
        type,
        calleeId: primary.id,
        participantIds: [primary.id, ...rest.map((u) => u.id)],
      });
      startCall(session, 'caller', primary);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not start call', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header title="Group call" onBack={() => navigation.goBack()} />
      <Text muted style={{ marginBottom: spacing.md }}>
        Select up to {MAX} people. Selected: {selected.length}
      </Text>
      <SearchBar value={q} onChangeText={setQ} placeholder="Search online…" />
      <FlatList
        data={(list.data?.items ?? []).filter((u) => u.id !== user?.id)}
        keyExtractor={(item) => item.id}
        style={{ flex: 1, marginTop: spacing.md }}
        renderItem={({ item }) => {
          const on = selectedIds.has(item.id);
          return (
            <Pressable
              onPress={() => toggle(item)}
              style={[
                styles.row,
                { borderColor: c.border, backgroundColor: on ? c.primaryMuted : c.card },
              ]}
            >
              <Avatar uri={item.avatarUrl} name={item.displayName} size={40} />
              <Text style={{ flex: 1 }}>{item.displayName}</Text>
              <Text muted>{on ? '✓' : ''}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text muted style={{ marginTop: 24 }}>
            {list.isLoading ? 'Loading…' : 'No users found'}
          </Text>
        }
      />
      <View style={styles.actions}>
        <Button
          title="Audio"
          variant="secondary"
          onPress={() => void start(CallType.Audio)}
          loading={loading}
          style={{ flex: 1 }}
        />
        <Button
          title="Video"
          onPress={() => void start(CallType.Video)}
          loading={loading}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.md, marginBottom: spacing.md },
});
