import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { callsApi } from '@/api/calls';
import { apiGet, getErrorMessage } from '@/api/client';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useCallStore } from '@/store/call';
import { spacing } from '@/theme';
import type { CallType, Paginated, PublicUser } from '@/types';

type Props = {
  callId: string;
  type: CallType;
  /** invite = same-room add; consult = hold current call and ring someone else */
  mode?: 'invite' | 'consult';
  /** When set, the picker is controlled by the parent (no built-in trigger). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export function AddCallParticipant({
  callId,
  type,
  mode = 'invite',
  open: openProp,
  onOpenChange,
  hideTrigger,
}: Props) {
  const c = useThemeColors();
  const [internalOpen, setInternalOpen] = useState(false);
  const [q, setQ] = useState('');
  const isConsult = mode === 'consult';
  const startCall = useCallStore((s) => s.startCall);
  const setHeldCall = useCallStore((s) => s.setHeldCall);
  const active = useCallStore((s) => s.active);
  const open = openProp ?? internalOpen;

  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setInternalOpen(next);
  };

  const discover = useQuery({
    queryKey: ['call-invite-users', q],
    queryFn: () =>
      apiGet<Paginated<PublicUser>>('/users', {
        params: { q: q || undefined, limit: 8, online: true },
      }),
    enabled: open,
    staleTime: 15_000,
  });

  const pick = async (user: PublicUser) => {
    if (isConsult) {
      try {
        if (active) {
          setHeldCall({
            callId: active.session.id,
            type: active.session.type,
            peer: active.peer,
          });
        }
        const session = await callsApi.initiate({
          type,
          calleeId: user.id,
          fromCallId: callId,
        });
        if (session.heldCallId) {
          setHeldCall({
            callId: session.heldCallId,
            type: session.heldType ?? type,
            peer: active?.peer,
          });
        }
        startCall(session, 'caller', user);
        setOpen(false);
      } catch (err) {
        setHeldCall(null);
        Alert.alert('Call failed', getErrorMessage(err));
      }
      return;
    }
    try {
      await callsApi.invite(type, callId, user.id);
      Alert.alert('Invite sent');
      setOpen(false);
    } catch (err) {
      Alert.alert('Invite failed', getErrorMessage(err));
    }
  };

  return (
    <>
      {hideTrigger ? null : (
        <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
          <Text variant="caption" color="#fff">
            {isConsult ? 'Call Another' : 'Add Person'}
          </Text>
        </Pressable>
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => undefined}
          >
            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              {isConsult ? 'Call Another' : 'Add Person'}
            </Text>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search online users…"
              placeholderTextColor={c.textMuted}
              style={[
                styles.input,
                { color: c.text, borderColor: c.border, backgroundColor: c.elevated },
              ]}
            />
            <FlatList
              data={discover.data?.items ?? []}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 240 }}
              ListEmptyComponent={
                <Text muted style={{ paddingVertical: 12 }}>
                  {discover.isLoading ? 'Loading…' : 'No users found'}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => void pick(item)}>
                  <Avatar uri={item.avatarUrl} name={item.displayName} size={32} />
                  <Text>{item.displayName}</Text>
                </Pressable>
              )}
            />
            <Button title="Close" size="sm" onPress={() => setOpen(false)} style={{ marginTop: 8 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
});
