import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

export function VerifiedBadge({ size = 16 }: { size?: number }) {
  const c = useThemeColors();
  return <Ionicons name="checkmark-circle" size={size} color={c.purple} />;
}
