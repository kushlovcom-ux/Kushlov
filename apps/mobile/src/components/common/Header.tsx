import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** When true, uses navigation.goBack() if onBack is not provided */
  showBack?: boolean;
  right?: React.ReactNode;
};

export function Header({ title, subtitle, onBack, showBack, right }: Props) {
  const c = useThemeColors();
  const navigation = useNavigation();
  const handleBack = onBack ?? (showBack ? () => navigation.goBack() : undefined);

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {handleBack ? (
          <Pressable onPress={handleBack} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </Pressable>
        ) : null}
        <View style={{ flexShrink: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" muted numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    minHeight: 44,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  back: { marginRight: 4 },
});
