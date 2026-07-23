import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';
import { typography } from '@/theme/typography';
import { haptics } from '@/utils/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  style?: ViewStyle;
  textStyle?: TextStyle;
  left?: React.ReactNode;
  leftIcon?: React.ReactNode;
  fullWidth?: boolean;
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  left,
  leftIcon,
  fullWidth,
}: Props) {
  const leading = left ?? leftIcon;
  const c = useThemeColors();
  const isDisabled = disabled || loading;

  const padV = size === 'sm' ? 10 : size === 'lg' ? 16 : 13;
  const padH = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  const minHeight = size === 'sm' ? 40 : size === 'lg' ? 56 : 48;

  const onPressInner = () => {
    haptics.selection();
    onPress?.();
  };

  const labelColor =
    variant === 'primary' || variant === 'danger'
      ? '#fff'
      : variant === 'ghost'
        ? c.primary
        : c.text;

  const content = loading ? (
    <ActivityIndicator color={labelColor} />
  ) : (
    <>
      {leading}
      <Text style={[typography.button, { color: labelColor, letterSpacing: 0.2 }, textStyle]}>
        {title}
      </Text>
    </>
  );

  const widthStyle: ViewStyle = {
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    width: fullWidth ? '100%' : undefined,
  };

  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPress={onPressInner}
        style={({ pressed }) => [
          widthStyle,
          styles.shadow,
          { opacity: isDisabled ? 0.5 : pressed ? 0.92 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={[...c.gradient]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.base,
            {
              paddingVertical: padV,
              paddingHorizontal: padH,
              minHeight,
            },
          ]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  const bg =
    variant === 'secondary' ? c.elevated : variant === 'danger' ? c.danger : 'transparent';
  const borderColor =
    variant === 'outline' ? c.pink : variant === 'ghost' ? 'transparent' : c.border;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPressInner}
      style={({ pressed }) => [
        styles.base,
        widthStyle,
        {
          backgroundColor: variant === 'outline' ? 'rgba(236,72,153,0.08)' : bg,
          borderColor,
          borderWidth: variant === 'ghost' ? 0 : 1.5,
          paddingVertical: padV,
          paddingHorizontal: padH,
          minHeight,
          opacity: isDisabled ? 0.5 : pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shadow: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#EC4899',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
