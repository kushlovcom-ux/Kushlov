import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { Room } from 'livekit-client';

export type VideoFilterId = 'none' | 'hideFace' | 'glowFace' | 'bgBlur' | 'bgWarm' | 'bgCool';

const FILTERS: {
  id: VideoFilterId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'none', label: 'Off', icon: 'close-circle-outline' },
  { id: 'hideFace', label: 'Hide', icon: 'eye-off-outline' },
  { id: 'glowFace', label: 'Glow', icon: 'sparkles-outline' },
  { id: 'bgBlur', label: 'Blur', icon: 'images-outline' },
  { id: 'bgWarm', label: 'Warm', icon: 'sunny-outline' },
  { id: 'bgCool', label: 'Cool', icon: 'snow-outline' },
];

type Props = {
  room: Room | null;
  onFilterChange?: (id: VideoFilterId) => void;
};

/**
 * Lightweight video filter controls for mobile calls/live.
 * Applies camera on/off + tint overlays (native ML processors not bundled).
 */
export function VideoFilterBar({ room, onFilterChange }: Props) {
  const c = useThemeColors();
  const [active, setActive] = useState<VideoFilterId>('none');

  const apply = async (id: VideoFilterId) => {
    setActive(id);
    onFilterChange?.(id);
    try {
      if (!room) return;
      if (id === 'hideFace') {
        await room.localParticipant.setCameraEnabled(false);
      } else {
        await room.localParticipant.setCameraEnabled(true);
      }
    } catch {
      // soft fail
    }
  };

  return (
    <View style={styles.row}>
      {FILTERS.map((f) => {
        const on = active === f.id;
        return (
          <Pressable
            key={f.id}
            onPress={() => void apply(f.id)}
            style={[
              styles.chip,
              { backgroundColor: on ? c.primary : c.elevated, borderColor: c.border },
            ]}
          >
            <Ionicons name={f.icon} size={14} color={on ? '#fff' : c.text} />
            <Text variant="tiny" color={on ? '#fff' : c.textMuted}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Overlay tint for glow / warm / cool / blur look on local preview. */
export function FilterOverlay({ filter }: { filter: VideoFilterId }) {
  if (filter === 'none' || filter === 'hideFace') return null;
  const tint =
    filter === 'glowFace'
      ? 'rgba(255, 200, 120, 0.18)'
      : filter === 'bgWarm'
        ? 'rgba(255, 140, 60, 0.22)'
        : filter === 'bgCool'
          ? 'rgba(80, 140, 255, 0.22)'
          : filter === 'bgBlur'
            ? 'rgba(0, 0, 0, 0.12)'
            : 'transparent';
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
