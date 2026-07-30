import { TextStyle } from 'react-native';

/**
 * Premium type scale — system fonts for Expo Go compatibility.
 * Hierarchy: display → hero → titles → body → labels.
 */
export const typography = {
  hero: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 46,
  } satisfies TextStyle,
  display: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 40,
  } satisfies TextStyle,
  h1: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 34,
  } satisfies TextStyle,
  h2: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  } satisfies TextStyle,
  h3: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 24,
  } satisfies TextStyle,
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 } satisfies TextStyle,
  bodyBold: { fontSize: 16, fontWeight: '600', lineHeight: 24 } satisfies TextStyle,
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 20,
  } satisfies TextStyle,
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 } satisfies TextStyle,
  captionBold: { fontSize: 13, fontWeight: '600', lineHeight: 18 } satisfies TextStyle,
  tiny: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    lineHeight: 14,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  button: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 20,
  } satisfies TextStyle,
} as const;
