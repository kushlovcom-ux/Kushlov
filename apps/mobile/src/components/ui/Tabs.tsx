import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing, typography } from '@/theme';

type Tab = { key: string; label: string };

type Props = {
  tabs: Tab[];
  value: string;
  onChange: (key: string) => void;
};

export function Tabs({ tabs, value, onChange }: Props) {
  const c = useThemeColors();
  return (
    <View style={[styles.row, { backgroundColor: c.elevated }]}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[
              styles.tab,
              active && { backgroundColor: c.card, borderColor: c.border },
            ]}
          >
            <Text
              style={[
                typography.captionBold,
                { color: active ? c.text : c.textMuted },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
});
