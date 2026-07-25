import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { liveApi } from '@/api/live';
import { getErrorMessage } from '@/api/client';
import { useColiveStore } from '@/store/colive';
import { useThemeColors } from '@/hooks/useThemeColors';
import { navigationRef } from '@/navigation/navigationRef';
import { spacing } from '@/theme';

/** Global Accept/Decline for co-live invites (works over LiveKit fullscreen). */
export function ColiveInviteModal() {
  const c = useThemeColors();
  const invite = useColiveStore((s) => s.invite);
  const setInvite = useColiveStore((s) => s.setInvite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // HTTP fallback when socket event is missed while already live.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await liveApi.coliveIncoming();
        if (cancelled) return;
        const next = data.items?.[0];
        const current = useColiveStore.getState().invite;
        if (next?.liveId) {
          if (current?.liveId !== next.liveId) setInvite(next);
        } else if (current) {
          setInvite(null);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [setInvite]);

  if (!invite) return null;

  const decline = () => {
    setError(null);
    const liveId = invite.liveId;
    setInvite(null);
    if (liveId) void liveApi.coliveReject(liveId).catch(() => undefined);
  };

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await liveApi.coliveAccept(invite.liveId);
      const liveId = invite.liveId;
      setInvite(null);
      if (navigationRef.isReady()) {
        navigationRef.navigate('App', {
          screen: 'LiveRoom',
          params: {
            liveId,
            coliveToken: data.token,
            livekitUrl: data.livekitUrl,
          },
        } as never);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={decline}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : decline}>
        <Pressable
          style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => undefined}
        >
          <Text variant="h3" style={{ textAlign: 'center' }}>
            Co-live invite
          </Text>
          <Text muted style={{ textAlign: 'center', marginTop: 8 }}>
            {invite.from?.displayName ?? 'A host'} invited you to join “
            {invite.title ?? 'their stream'}”
          </Text>
          {error ? (
            <Text color={c.danger} style={{ textAlign: 'center', marginTop: 8 }}>
              {error}
            </Text>
          ) : null}
          {busy ? (
            <ActivityIndicator color={c.primary} style={{ marginTop: 16 }} />
          ) : (
            <View style={styles.row}>
              <Button title="Decline" variant="secondary" onPress={decline} style={{ flex: 1 }} />
              <Button title="Accept" onPress={() => void accept()} style={{ flex: 1 }} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.lg,
  },
});
