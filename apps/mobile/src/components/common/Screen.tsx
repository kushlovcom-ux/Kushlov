import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Pull-to-refresh handler. When set with scroll, wraps content in RefreshControl. */
  onRefresh?: () => void | Promise<unknown>;
  refreshing?: boolean;
};

export function Screen({
  children,
  scroll,
  padded = true,
  style,
  edges = ['top', 'left', 'right'],
  onRefresh,
  refreshing: refreshingProp,
}: Props) {
  const c = useThemeColors();
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const refreshing = refreshingProp ?? internalRefreshing;

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    if (refreshingProp === undefined) setInternalRefreshing(true);
    try {
      await onRefresh();
    } finally {
      if (refreshingProp === undefined) setInternalRefreshing(false);
    }
  }, [onRefresh, refreshingProp]);

  const content = (
    <View style={[padded && styles.pad, style, { flexGrow: 1 }]}>{children}</View>
  );

  const refreshControl =
    onRefresh != null ? (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={() => {
          void handleRefresh();
        }}
        tintColor={c.pink}
        colors={[c.pink]}
      />
    ) : undefined;

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: c.bg }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

/** Shared RefreshControl for screens that own their own ScrollView / FlashList. */
export function useScreenRefresh(onRefresh: () => void | Promise<unknown>) {
  const c = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const control = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        void refresh();
      }}
      tintColor={c.pink}
      colors={[c.pink]}
    />
  );

  return { refreshing, refresh, refreshControl: control };
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
