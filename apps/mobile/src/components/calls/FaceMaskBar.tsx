import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  FACE_MASK_ATTR,
  FACE_MASKS,
  getFaceMask,
  type FaceMaskId,
} from '@/constants/faceMasks';
import { useFaceMaskStore } from '@/store/faceMask';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { Participant, Room } from 'livekit-client';

type BarProps = {
  room: Room | null;
  onMaskChange?: (id: FaceMaskId) => void;
};

/**
 * Face-only emoji / icon mask picker. Publishes selection via LiveKit attributes
 * so remotes can overlay the same mask on this participant's face.
 */
export function FaceMaskBar({ room, onMaskChange }: BarProps) {
  const c = useThemeColors();
  const [active, setActive] = useState<FaceMaskId>('none');
  const setLocalMaskId = useFaceMaskStore((s) => s.setLocalMaskId);

  const apply = async (id: FaceMaskId) => {
    setActive(id);
    setLocalMaskId(id === 'none' ? '' : id);
    onMaskChange?.(id);
    try {
      await room?.localParticipant.setAttributes({
        [FACE_MASK_ATTR]: id === 'none' ? '' : id,
      });
    } catch {
      // soft fail — local overlay still shows via store
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.caption, { color: c.textMuted }]}>Face mask</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {FACE_MASKS.map((m) => {
          const on = active === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => void apply(m.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? c.primary : c.elevated,
                  borderColor: c.border,
                },
              ]}
            >
              <Text style={styles.emoji}>{m.id === 'none' ? '✕' : m.emoji}</Text>
              <Text style={{ color: on ? '#fff' : c.textMuted, fontSize: 10 }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type OverlayProps = {
  maskId: string | null | undefined;
  /** When true, nudge for mirrored local selfie framing */
  mirrored?: boolean;
};

/**
 * Positions an emoji/mask over the typical face region of a video tile
 * (face-only — not a full-screen filter).
 */
export function FaceMaskOverlay({ maskId, mirrored = false }: OverlayProps) {
  const mask = getFaceMask(maskId);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const layout = useMemo(() => {
    if (!mask || size.w < 8 || size.h < 8) return null;
    // Selfie face sits upper-center; cover just that region.
    const base = Math.min(size.w, size.h) * 0.42 * mask.scale;
    const cx = size.w * 0.5;
    const cy = size.h * (mask.id === 'crown' ? 0.18 : mask.id === 'sunglasses' ? 0.3 : 0.34);
    return {
      left: cx - base / 2,
      top: cy - base / 2,
      width: base,
      height: base,
      fontSize: base * 0.92,
    };
  }, [mask, size.w, size.h, mirrored]);

  if (!mask) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {layout ? (
        <Text
          style={{
            position: 'absolute',
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
            fontSize: layout.fontSize,
            textAlign: 'center',
            lineHeight: layout.height,
            textShadowColor: 'rgba(0,0,0,0.45)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 6,
          }}
        >
          {mask.emoji}
        </Text>
      ) : null}
    </View>
  );
}

/** Read face-mask attribute from a LiveKit participant (with live updates). */
export function useParticipantFaceMask(participant: Participant | null | undefined) {
  const [maskId, setMaskId] = useState(
    () => participant?.attributes?.[FACE_MASK_ATTR] || '',
  );

  useEffect(() => {
    if (!participant) {
      setMaskId('');
      return;
    }
    const sync = () => setMaskId(participant.attributes?.[FACE_MASK_ATTR] || '');
    sync();
    // livekit-client Participant emits 'attributesChanged'
    const handler = () => sync();
    participant.on('attributesChanged', handler);
    return () => {
      participant.off('attributesChanged', handler);
    };
  }, [participant]);

  return maskId;
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.xs },
  caption: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginLeft: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingBottom: 2,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emoji: { fontSize: 18, lineHeight: 22 },
});
