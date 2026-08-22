import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FACE_FILTER_CATALOG, FILTER_CATEGORIES } from '../catalog';
import { useFaceFilterStore } from '../hooks/useFaceFilter';
import type { FaceFilterCategory, FaceFilterId } from '../types';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';

type Props = {
  /** Compact trigger shown in call/live chrome */
  triggerLabel?: string;
};

/** Bottom-sheet filter picker matching web catalog. */
export function FilterSelector({ triggerLabel = 'Filters' }: Props) {
  const c = useThemeColors();
  const panelOpen = useFaceFilterStore((s) => s.panelOpen);
  const setPanelOpen = useFaceFilterStore((s) => s.setPanelOpen);
  const settings = useFaceFilterStore((s) => s.settings);
  const activeFilterId = useFaceFilterStore((s) => s.activeFilterId);
  const setActiveFilterId = useFaceFilterStore((s) => s.setActiveFilterId);
  const setEnabled = useFaceFilterStore((s) => s.setEnabled);
  const toggleFavorite = useFaceFilterStore((s) => s.toggleFavorite);
  const faceDetected = useFaceFilterStore((s) => s.faceDetected);
  const hydrate = useFaceFilterStore((s) => s.hydrate);
  const hydrated = useFaceFilterStore((s) => s.hydrated);
  const [category, setCategory] = useState<FaceFilterCategory>('trending');

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const items = useMemo(() => {
    if (category === 'trending') {
      return FACE_FILTER_CATALOG.filter(
        (f) => f.id === 'none' || settings.favorites.includes(f.id) || f.category === 'trending',
      );
    }
    return FACE_FILTER_CATALOG.filter((f) => f.category === category || f.id === 'none');
  }, [category, settings.favorites]);

  return (
    <>
      <Pressable
        onPress={() => setPanelOpen(true)}
        style={[styles.trigger, { backgroundColor: c.elevated, borderColor: c.border }]}
      >
        <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>✨ {triggerLabel}</Text>
      </Pressable>

      <Modal visible={panelOpen} transparent animationType="slide" onRequestClose={() => setPanelOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPanelOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => undefined}
          >
            <View style={styles.sheetHeader}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Face filters</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Pressable
                  onPress={() => setEnabled(!settings.enabled)}
                  style={[
                    styles.badge,
                    { backgroundColor: settings.enabled ? c.primary : c.danger },
                  ]}
                >
                  <Text style={{ color: '#fff', fontSize: 11 }}>{settings.enabled ? 'On' : 'Off'}</Text>
                </Pressable>
                <Pressable onPress={() => setPanelOpen(false)}>
                  <Text style={{ color: c.textMuted, fontSize: 14 }}>Close</Text>
                </Pressable>
              </View>
            </View>

            {!faceDetected && activeFilterId !== 'none' ? (
              <Text style={{ color: '#fbbf24', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
                Face not detected — retrying…
              </Text>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
              {FILTER_CATEGORIES.map((cat) => {
                const on = category === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: on ? c.primary : c.elevated,
                        borderColor: c.border,
                      },
                    ]}
                  >
                    <Text style={{ color: on ? '#fff' : c.textMuted, fontSize: 11 }}>{cat.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView contentContainerStyle={styles.grid}>
              {items.map((f) => {
                const on = activeFilterId === f.id;
                const fav = settings.favorites.includes(f.id);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      if (f.id !== 'none') setEnabled(true);
                      setActiveFilterId(f.id as FaceFilterId);
                    }}
                    onLongPress={() => {
                      if (f.id !== 'none') toggleFavorite(f.id as FaceFilterId);
                    }}
                    style={[
                      styles.cell,
                      {
                        borderColor: on ? c.primary : c.border,
                        backgroundColor: on ? `${c.primary}33` : c.elevated,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 26 }}>{f.id === 'none' ? '✕' : f.emoji}</Text>
                    <Text style={{ color: c.textMuted, fontSize: 10, textAlign: 'center' }} numberOfLines={2}>
                      {f.name}
                    </Text>
                    {fav ? (
                      <Text style={styles.star}>★</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={{ color: c.textMuted, fontSize: 10, textAlign: 'center', marginTop: 4 }}>
              Long-press to favorite
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '62%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cats: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: spacing.sm,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '22%',
    minWidth: 68,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    position: 'relative',
  },
  star: {
    position: 'absolute',
    top: 4,
    right: 6,
    fontSize: 10,
    color: '#fbbf24',
  },
});
