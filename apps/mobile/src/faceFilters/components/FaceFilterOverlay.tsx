import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import type { Participant } from 'livekit-client';
import { getFilterDef } from '../catalog';
import { FACE_FILTER_ATTR } from '../types';
import { useFaceFilterStore, selectEffectiveFilterId } from '../hooks/useFaceFilter';

type OverlayProps = {
  filterId: string | null | undefined;
  mirrored?: boolean;
};

/**
 * Client-side face sticker / privacy mask when bitstream processing is unavailable.
 * Remotes render this from LiveKit attributes; local uses the active filter store.
 */
export function FaceFilterOverlay({ filterId, mirrored = false }: OverlayProps) {
  const filter = getFilterDef(filterId);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const layout = useMemo(() => {
    if (!filter || size.w < 8 || size.h < 8) return null;
    const fw = size.w * 0.42 * filter.scale;
    const fh = size.h * 0.48 * filter.scale;
    const cx = size.w * (mirrored ? 0.5 : 0.5);
    const cy = size.h * (0.34 + (filter.yOffset ?? 0) * 0.5);
    return {
      left: cx - fw / 2,
      top: cy - fh / 2,
      width: fw,
      height: fh,
      fontSize: Math.min(fw, fh) * 0.9,
    };
  }, [filter, size.w, size.h, mirrored]);

  if (!filter || !layout) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {filter.privacy ? (
        <View
          style={{
            position: 'absolute',
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
            borderRadius: layout.width / 2,
            backgroundColor:
              filter.privacy === 'solid'
                ? '#111'
                : filter.privacy === 'blur'
                  ? 'rgba(255,255,255,0.25)'
                  : 'rgba(0,0,0,0.45)',
          }}
        />
      ) : null}
      {!filter.beauty && filter.emoji ? (
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
          {filter.emoji}
        </Text>
      ) : null}
      {filter.beauty ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(255, 200, 220, 0.08)' },
          ]}
        />
      ) : null}
    </View>
  );
}

export function useParticipantFaceFilter(participant: Participant | null | undefined) {
  const [filterId, setFilterId] = useState(
    () => participant?.attributes?.[FACE_FILTER_ATTR] || '',
  );

  useEffect(() => {
    if (!participant) {
      setFilterId('');
      return;
    }
    const sync = () => setFilterId(participant.attributes?.[FACE_FILTER_ATTR] || '');
    sync();
    const handler = () => sync();
    participant.on('attributesChanged', handler);
    return () => {
      participant.off('attributesChanged', handler);
    };
  }, [participant]);

  return filterId;
}

/** Local tile: prefer store filter when publishing. */
export function useLocalOrRemoteFaceFilter(
  participant: Participant | null | undefined,
) {
  const attr = useParticipantFaceFilter(participant);
  const local = useFaceFilterStore(selectEffectiveFilterId);
  if (participant?.isLocal) {
    return local === 'none' ? '' : local;
  }
  return attr;
}
