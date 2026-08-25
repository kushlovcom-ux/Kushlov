import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import type { FilterLayerKind } from '../types';
import type { FilterLayout } from '../layout';

type Props = {
  kind: FilterLayerKind;
  layout: FilterLayout;
};

/** Original vector AR parts, scaled to landmark layout. */
export function FilterLayerSvg({ kind, layout }: Props) {
  const { x, y, w, h, rotation } = layout;
  if (w < 4 || h < 4) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        transform: [{ rotate: `${rotation}deg` }],
      }}
    >
      <Svg width="100%" height="100%" viewBox={viewBoxFor(kind)} preserveAspectRatio="xMidYMid meet">
        <Defs>
          <SvgLinearGradient id={`glassShine-${kind}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#fff" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <LayerArt kind={kind} />
      </Svg>
    </View>
  );
}

function viewBoxFor(kind: FilterLayerKind): string {
  switch (kind) {
    case 'dogEars':
    case 'catEars':
    case 'bunnyEars':
    case 'crown':
    case 'flowerCrown':
    case 'devilHorns':
      return '0 0 220 140';
    case 'clownNose':
    case 'dogNose':
    case 'catNose':
      return '0 0 90 80';
    case 'mustache':
    case 'catWhiskers':
    case 'robotJaw':
    case 'medicalMask':
      return '0 0 200 110';
    default:
      return '0 0 220 90';
  }
}

function LayerArt({ kind }: { kind: FilterLayerKind }) {
  switch (kind) {
    case 'sunglasses':
      return (
        <G>
          <Rect x="18" y="28" width="80" height="42" rx="16" fill="#111" />
          <Rect x="122" y="28" width="80" height="42" rx="16" fill="#111" />
          <Path d="M98 46 H122" stroke="#111" strokeWidth="8" strokeLinecap="round" />
          <Path d="M18 42 H6" stroke="#111" strokeWidth="7" strokeLinecap="round" />
          <Path d="M202 42 H214" stroke="#111" strokeWidth="7" strokeLinecap="round" />
          <Rect x="24" y="34" width="68" height="16" rx="8" fill="url(#glassShine-sunglasses)" />
          <Rect x="128" y="34" width="68" height="16" rx="8" fill="url(#glassShine-sunglasses)" />
        </G>
      );
    case 'aviator':
      return (
        <G>
          <Path d="M28 28 C28 18 48 14 70 18 C92 22 102 38 98 54 C92 72 52 76 36 62 C24 50 28 36 28 28Z" fill="#1a1a1a" />
          <Path d="M192 28 C192 18 172 14 150 18 C128 22 118 38 122 54 C128 72 168 76 184 62 C196 50 192 36 192 28Z" fill="#1a1a1a" />
          <Path d="M98 40 H122" stroke="#c9a227" strokeWidth="6" strokeLinecap="round" />
          <Path d="M36 36 C48 32 70 34 84 42" stroke="#4b6a88" strokeWidth="4" opacity="0.55" fill="none" />
          <Path d="M184 36 C172 32 150 34 136 42" stroke="#4b6a88" strokeWidth="4" opacity="0.55" fill="none" />
        </G>
      );
    case 'heartGlasses':
      return (
        <G>
          <Path
            d="M70 72 C70 72 22 42 22 28 C22 16 34 12 46 20 C58 12 70 18 70 28 C70 18 82 12 94 20 C106 12 118 16 118 28 C118 42 70 72 70 72Z"
            fill="#ec4899"
          />
          <Path
            d="M150 72 C150 72 102 42 102 28 C102 16 114 12 126 20 C138 12 150 18 150 28 C150 18 162 12 174 20 C186 12 198 16 198 28 C198 42 150 72 150 72Z"
            fill="#ec4899"
          />
          <Path d="M118 36 H102" stroke="#be185d" strokeWidth="5" strokeLinecap="round" />
        </G>
      );
    case 'rainbowGlasses':
      return (
        <G>
          <Rect x="16" y="26" width="84" height="44" rx="18" fill="none" stroke="#ef4444" strokeWidth="8" />
          <Rect x="20" y="30" width="76" height="36" rx="14" fill="none" stroke="#f59e0b" strokeWidth="5" />
          <Rect x="120" y="26" width="84" height="44" rx="18" fill="none" stroke="#22c55e" strokeWidth="8" />
          <Rect x="124" y="30" width="76" height="36" rx="14" fill="none" stroke="#3b82f6" strokeWidth="5" />
          <Path d="M100 46 H120" stroke="#a855f7" strokeWidth="8" strokeLinecap="round" />
        </G>
      );
    case 'animeEyes':
      return (
        <G>
          <Ellipse cx="70" cy="46" rx="38" ry="32" fill="#fff" stroke="#111" strokeWidth="5" />
          <Ellipse cx="150" cy="46" rx="38" ry="32" fill="#fff" stroke="#111" strokeWidth="5" />
          <Circle cx="76" cy="50" r="16" fill="#2563eb" />
          <Circle cx="156" cy="50" r="16" fill="#2563eb" />
          <Circle cx="80" cy="44" r="6" fill="#111" />
          <Circle cx="160" cy="44" r="6" fill="#111" />
          <Circle cx="68" cy="40" r="5" fill="#fff" />
          <Circle cx="148" cy="40" r="5" fill="#fff" />
        </G>
      );
    case 'laserEyes':
      return (
        <G>
          <Circle cx="70" cy="36" r="14" fill="#ef4444" />
          <Circle cx="150" cy="36" r="14" fill="#ef4444" />
          <Path d="M70 50 L58 88" stroke="#f97316" strokeWidth="8" strokeLinecap="round" />
          <Path d="M150 50 L162 88" stroke="#f97316" strokeWidth="8" strokeLinecap="round" />
          <Circle cx="70" cy="36" r="6" fill="#fff" />
          <Circle cx="150" cy="36" r="6" fill="#fff" />
        </G>
      );
    case 'medicalMask':
      return (
        <G>
          <Path
            d="M28 28 C70 8 150 8 192 28 C198 58 170 96 110 102 C50 96 22 58 28 28Z"
            fill="#e8f4ff"
            stroke="#94a3b8"
            strokeWidth="3"
          />
          <Path d="M28 40 H8" stroke="#94a3b8" strokeWidth="4" />
          <Path d="M192 40 H212" stroke="#94a3b8" strokeWidth="4" />
          <Path d="M50 58 H170" stroke="#cbd5e1" strokeWidth="3" />
          <Path d="M56 72 H164" stroke="#cbd5e1" strokeWidth="3" />
        </G>
      );
    case 'mustache':
      return (
        <Path
          d="M20 58 C40 18 70 28 100 50 C130 28 160 18 180 58 C150 42 120 62 100 70 C80 62 50 42 20 58Z"
          fill="#3f2a1d"
        />
      );
    case 'dogEars':
      return (
        <G>
          <Path d="M28 118 C18 40 70 8 96 70 C70 86 48 110 28 118Z" fill="#c47a3a" />
          <Path d="M192 118 C202 40 150 8 124 70 C150 86 172 110 192 118Z" fill="#c47a3a" />
          <Path d="M40 100 C36 60 68 36 86 72" fill="#f3c6a0" />
          <Path d="M180 100 C184 60 152 36 134 72" fill="#f3c6a0" />
        </G>
      );
    case 'dogNose':
      return (
        <G>
          <Ellipse cx="45" cy="32" rx="28" ry="22" fill="#3f2a1d" />
          <Ellipse cx="38" cy="26" rx="8" ry="5" fill="#6b4a32" />
          <Path d="M45 52 Q45 70 32 76" stroke="#3f2a1d" strokeWidth="4" fill="none" />
          <Path d="M45 52 Q45 70 58 76" stroke="#3f2a1d" strokeWidth="4" fill="none" />
        </G>
      );
    case 'catEars':
      return (
        <G>
          <Path d="M36 120 L52 18 L108 92 Z" fill="#f4b942" />
          <Path d="M184 120 L168 18 L112 92 Z" fill="#f4b942" />
          <Path d="M48 96 L58 40 L90 86 Z" fill="#f8c9d4" />
          <Path d="M172 96 L162 40 L130 86 Z" fill="#f8c9d4" />
        </G>
      );
    case 'catNose':
      return <Path d="M45 18 L68 48 L22 48 Z" fill="#ec4899" />;
    case 'catWhiskers':
      return (
        <G stroke="#222" strokeWidth="4" strokeLinecap="round">
          <Path d="M20 40 H80" />
          <Path d="M18 58 H82" />
          <Path d="M20 76 H80" />
          <Path d="M120 40 H180" />
          <Path d="M118 58 H182" />
          <Path d="M120 76 H180" />
        </G>
      );
    case 'bunnyEars':
      return (
        <G>
          <Ellipse cx="70" cy="58" rx="28" ry="58" fill="#f8f4ef" stroke="#e8d9c8" strokeWidth="3" />
          <Ellipse cx="150" cy="58" rx="28" ry="58" fill="#f8f4ef" stroke="#e8d9c8" strokeWidth="3" />
          <Ellipse cx="70" cy="62" rx="12" ry="40" fill="#f9c5d5" />
          <Ellipse cx="150" cy="62" rx="12" ry="40" fill="#f9c5d5" />
        </G>
      );
    case 'crown':
      return (
        <G>
          <Path d="M20 88 L44 28 L78 70 L110 16 L142 70 L176 28 L200 88 Z" fill="#f4c430" stroke="#d4a017" strokeWidth="4" />
          <Circle cx="44" cy="28" r="8" fill="#ef4444" />
          <Circle cx="110" cy="16" r="9" fill="#38bdf8" />
          <Circle cx="176" cy="28" r="8" fill="#22c55e" />
        </G>
      );
    case 'flowerCrown':
      return (
        <G>
          <Circle cx="40" cy="70" r="22" fill="#fb7185" />
          <Circle cx="88" cy="48" r="24" fill="#f472b6" />
          <Circle cx="132" cy="48" r="24" fill="#fb7185" />
          <Circle cx="180" cy="70" r="22" fill="#f9a8d4" />
          <Circle cx="40" cy="70" r="8" fill="#fde68a" />
          <Circle cx="88" cy="48" r="8" fill="#fde68a" />
          <Circle cx="132" cy="48" r="8" fill="#fde68a" />
          <Circle cx="180" cy="70" r="8" fill="#fde68a" />
        </G>
      );
    case 'devilHorns':
      return (
        <G>
          <Path d="M40 120 C28 40 62 8 86 64 C62 78 50 108 40 120Z" fill="#b91c1c" />
          <Path d="M180 120 C192 40 158 8 134 64 C158 78 170 108 180 120Z" fill="#b91c1c" />
        </G>
      );
    case 'clownNose':
      return (
        <G>
          <Circle cx="45" cy="40" r="28" fill="#ef4444" />
          <Circle cx="36" cy="30" r="8" fill="#fecaca" />
        </G>
      );
    case 'robotVisor':
      return (
        <G>
          <Rect x="22" y="24" width="176" height="48" rx="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="4" />
          <Rect x="36" y="36" width="60" height="24" rx="6" fill="#22d3ee" />
          <Rect x="124" y="36" width="60" height="24" rx="6" fill="#22d3ee" />
        </G>
      );
    case 'robotJaw':
      return (
        <G>
          <Rect x="50" y="28" width="100" height="48" rx="10" fill="#334155" />
          <Rect x="62" y="44" width="76" height="10" rx="4" fill="#94a3b8" />
        </G>
      );
    case 'anonMask':
      return (
        <G>
          <Ellipse cx="110" cy="46" rx="90" ry="40" fill="#111" />
          <Path d="M50 52 Q110 78 170 52" stroke="#444" strokeWidth="4" fill="none" />
        </G>
      );
    default:
      return null;
  }
}
