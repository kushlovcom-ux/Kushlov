import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FACE_FILTER_CATALOG, FILTER_CATEGORIES } from '../catalog';
import { useFaceFilterStore } from '../hooks/useFaceFilter';
import type { FaceFilterCategory, FaceFilterId } from '../types';
import { spacing } from '@/theme';

type Props = {
  triggerLabel?: string;
  /** Glass pill + carousel over the camera (calls / live). */
  compact?: boolean;
};

/** Snapchat-style circular filter carousel under the camera. */
export function FilterSelector({ triggerLabel = 'Filters', compact = false }: Props) {
  const settings = useFaceFilterStore((s) => s.settings);
  const activeFilterId = useFaceFilterStore((s) => s.activeFilterId);
  const setActiveFilterId = useFaceFilterStore((s) => s.setActiveFilterId);
  const setEnabled = useFaceFilterStore((s) => s.setEnabled);
  const toggleFavorite = useFaceFilterStore((s) => s.toggleFavorite);
  const hydrate = useFaceFilterStore((s) => s.hydrate);
  const hydrated = useFaceFilterStore((s) => s.hydrated);
  const [category, setCategory] = useState<FaceFilterCategory>('trending');
  const [open, setOpen] = useState(!compact);

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

  const active = FACE_FILTER_CATALOG.find((f) => f.id === activeFilterId);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.trigger}>
          <Text style={styles.triggerText}>
            {active && active.id !== 'none' ? `${active.emoji}  ${active.name}` : `✨  ${triggerLabel}`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setEnabled(!settings.enabled)}
          style={[styles.badge, { backgroundColor: settings.enabled ? '#ec4899' : 'rgba(239,68,68,0.9)' }]}
        >
          <Text style={styles.badgeText}>{settings.enabled ? 'On' : 'Off'}</Text>
        </Pressable>
      </View>

      {open ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cats}
          >
            {FILTER_CATEGORIES.map((cat) => {
              const on = category === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  style={[styles.catChip, on && styles.catChipOn]}
                >
                  <Text style={styles.catText}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          >
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
                  style={styles.thumbWrap}
                >
                  <View style={[styles.thumb, on && styles.thumbOn]}>
                    <Text style={{ fontSize: 26 }}>{f.id === 'none' ? '✕' : f.emoji}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.thumbLabel}>
                    {f.name}
                  </Text>
                  {fav ? <Text style={styles.star}>★</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  trigger: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(8,8,12,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  triggerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  cats: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  catChipOn: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  catText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    paddingHorizontal: 8,
    paddingBottom: 4,
    gap: 12,
    alignItems: 'center',
  },
  thumbWrap: {
    width: 72,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  thumb: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,12,16,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  thumbOn: {
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: 'rgba(236,72,153,0.85)',
    transform: [{ scale: 1.06 }],
  },
  thumbLabel: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    width: 72,
  },
  star: {
    position: 'absolute',
    top: 0,
    right: 4,
    fontSize: 11,
    color: '#fbbf24',
  },
});
