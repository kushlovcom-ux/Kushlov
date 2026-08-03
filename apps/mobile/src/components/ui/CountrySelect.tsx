import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { COUNTRIES } from '@/constants/countries';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing, typography } from '@/theme';

type Props = {
  label?: string;
  value: string;
  onChange: (country: string) => void;
  error?: string;
  placeholder?: string;
};

export function CountrySelect({
  label = 'Country',
  value,
  onChange,
  error,
  placeholder = 'Select your country',
}: Props) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...COUNTRIES];
    return COUNTRIES.filter((name) => name.toLowerCase().includes(q));
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[typography.captionBold, { color: c.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          {
            backgroundColor: c.elevated,
            borderColor: error ? c.danger : c.border,
          },
        ]}
      >
        <Text style={{ flex: 1, color: value ? c.text : c.textMuted }} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <ChevronDown size={18} color={c.textMuted} />
      </Pressable>

      {error ? (
        <Text style={[typography.caption, { color: c.danger, marginTop: 4 }]}>{error}</Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.sheetHeader}>
              <Text variant="h2">Select country</Text>
              <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
                <X size={22} color={c.text} />
              </Pressable>
            </View>

            <View
              style={[
                styles.search,
                { backgroundColor: c.elevated, borderColor: c.border },
              ]}
            >
              <Search size={16} color={c.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search countries"
                placeholderTextColor={c.textMuted}
                autoCorrect={false}
                style={[styles.searchInput, { color: c.text }]}
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={24}
              windowSize={10}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      close();
                    }}
                    style={[
                      styles.row,
                      selected && { backgroundColor: c.primaryMuted },
                    ]}
                  >
                    <Text color={selected ? c.pink : c.text}>{item}</Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text muted center style={{ marginTop: spacing.xl }}>
                  No countries match your search
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  field: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  search: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  row: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
  },
});
