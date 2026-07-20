import React from 'react';
import { Switch as RNSwitch, SwitchProps } from 'react-native';
import { brand } from '@/theme/colors';
import { useThemeColors } from '@/hooks/useThemeColors';

export function Switch(props: SwitchProps) {
  const c = useThemeColors();
  return (
    <RNSwitch
      trackColor={{ false: c.borderStrong, true: brand.pink }}
      thumbColor="#fff"
      ios_backgroundColor={c.borderStrong}
      {...props}
    />
  );
}
