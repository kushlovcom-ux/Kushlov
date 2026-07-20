import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { typography } from '@/theme';

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const t = useThemeColors();
  return (
    <View style={styles.wrap}>
      <Text style={[typography.h3, { color: t.text, textAlign: 'center' }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sub, { color: t.textMuted }]}>{subtitle}</Text>
      ) : null}
      {action}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const t = useThemeColors();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color="#ec4899" />
      <Text style={{ color: t.textMuted, marginTop: 12 }}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useThemeColors();
  return (
    <View style={styles.wrap}>
      <Text style={[typography.h3, { color: t.danger, textAlign: 'center' }]}>Something went wrong</Text>
      <Text style={[styles.sub, { color: t.textMuted }]}>{message}</Text>
      {onRetry ? (
        <Text onPress={onRetry} style={{ color: '#ec4899', fontWeight: '700', marginTop: 8 }}>
          Try again
        </Text>
      ) : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', radius = 8 }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  const t = useThemeColors();
  return (
    <View
      style={{
        height,
        width: width as number,
        borderRadius: radius,
        backgroundColor: t.elevated,
        opacity: 0.7,
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  sub: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
