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
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';

type Props = {
  triggerLabel?: string;
};

/** Snapchat-style circular filter carousel under the camera. */
export function FilterSelector({ triggerLabel = 'Filters' }: Props) {
  const c = useThemeColors();
  const settings = useFaceFilterStore((s) => s.settings);
  const activeFilterId = useFaceFilterStore((s) => s.activeFilterId);
  const setActiveFilterId = useFaceFilterStore((s) => s.setActiveFilterId);
  const setEnabled = useFaceFilterStore((s) => s.setEnabled);
  const toggleFavorite = useFaceFilterStore((s) => s.toggleFavorite);
  const faceDetected = useFaceFilterStore((s) => s.faceDetected);
  const hydrate = useFaceFilterStore((s) => s.hydrate);
  const hydrated = useFaceFilterStore((s) => s.hydrated);
  const [category, setCategory] = useState<FaceFilterCategory>('trending');
  const [open, setOpen] = useState(true);

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
        <Pressable onPress={() => setOpen((v) => !v)} style={[styles.trigger, { backgroundColor: c.elevated }]}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>
            ✨ {active && active.id !== 'none' ? active.name : triggerLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setEnabled(!settings.enabled)}
          style={[styles.badge, { backgroundColor: settings.enabled ? c.primary : c.danger }]}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            {settings.enabled ? 'On' : 'Off'}
          </Text>
        </Pressable>
      </View>

      {!faceDetected && activeFilterId !== 'none' && !activeFilterId.startsWith('bg') ? (
        <Text style={styles.warn}>Face not detected — retrying…</Text>
      ) : null}

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
                  style={[
                    styles.catChip,
                    { backgroundColor: on ? c.primary : 'rgba(0,0,0,0.45)', borderColor: c.border },
                  ]}
                >
                  <Text style={{ color: on ? '#fff' : '#fff', fontSize: 12, fontWeight: '600' }}>
                    {cat.label}
                  </Text>
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
                  <View
                    style={[
                      styles.thumb,
                      {
                        borderColor: on ? '#fff' : 'rgba(255,255,255,0.25)',
                        borderWidth: on ? 3 : 1,
                        transform: [{ scale: on ? 1.08 : 1 }],
                        backgroundColor: on ? `${c.primary}CC` : 'rgba(12,12,16,0.72)',
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 28 }}>{f.id === 'none' ? '✕' : f.emoji}</Text>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  warn: {
    color: '#fbbf24',
    fontSize: 12,
    textAlign: 'center',
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    paddingHorizontal: 8,
    paddingBottom: 4,
    gap: 12,
    alignItems: 'center',
  },
  thumbWrap: {
    width: 76,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabel: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    width: 76,
  },
  star: {
    position: 'absolute',
    top: 0,
    right: 4,
    fontSize: 11,
    color: '#fbbf24',
  },
});
