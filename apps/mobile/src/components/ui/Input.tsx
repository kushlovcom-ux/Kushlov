import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing, typography } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  right?: React.ReactNode;
};

export function Input({ label, error, right, style, ...rest }: Props) {
  const c = useThemeColors();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[typography.captionBold, { color: c.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: c.elevated,
            borderColor: error ? c.danger : c.border,
          },
        ]}
      >
        <TextInput
          placeholderTextColor={c.textMuted}
          style={[styles.input, { color: c.text }, style]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text style={[typography.caption, { color: c.danger, marginTop: 4 }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
});
