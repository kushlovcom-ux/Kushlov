import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/common/Screen';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const { width } = Dimensions.get('window');
/** Onboarding art is 1774×887 (2:1) — keep the frame matching so sides aren’t cropped. */
const HERO_HEIGHT = width / 2;

const HERO = [
  {
    key: '1',
    image: require('../../assets/onboarding/k1.png'),
    title: 'Meet someone new tonight',
    body: 'Browse real people nearby, match instantly, and start a conversation that matters.',
  },
  {
    key: '2',
    image: require('../../assets/onboarding/k2.png'),
    title: 'Chat, call & go live',
    body: 'From private messages to live rooms — connect the way you want, when you want.',
  },
  {
    key: '3',
    image: require('../../assets/onboarding/k3.png'),
    title: 'Made for modern dating',
    body: 'Verified hosts, live presence, and a premium experience built around you.',
  },
];

export function WelcomeScreen({ navigation }: Props) {
  const c = useThemeColors();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const slide = HERO[index] ?? HERO[0];

  return (
    <Screen padded={false}>
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        <View style={{ height: HERO_HEIGHT }}>
          <FlatList
            ref={listRef}
            data={HERO}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <View style={[styles.heroSlide, { width, height: HERO_HEIGHT, backgroundColor: c.bg }]}>
                <Image source={item.image} style={styles.heroImage} resizeMode="contain" />
                <LinearGradient
                  colors={['transparent', 'rgba(5,5,16,0.35)', c.bg]}
                  locations={[0.45, 0.78, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            )}
          />
        </View>

        <View style={styles.content}>
          <Image
            source={require('../../assets/images/kush.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="hero" style={styles.brand}>
            Kushlov
          </Text>
          <Text variant="h2" style={styles.headline}>
            {slide.title}
          </Text>
          <Text secondary style={styles.body}>
            {slide.body}
          </Text>

          <View style={styles.dots}>
            {HERO.map((s, i) => (
              <View
                key={s.key}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === index ? c.pink : c.borderStrong,
                    width: i === index ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          <Button
            title="Create account"
            fullWidth
            size="lg"
            onPress={() => navigation.navigate('Register')}
          />
          <Button
            title="Log in"
            variant="primary"
            fullWidth
            size="lg"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: spacing['2xl'] }}
          />
          <Button
            title="See how it works"
            variant="ghost"
            fullWidth
            onPress={() => navigation.navigate('Onboarding')}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroSlide: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heroImage: { width: '100%', height: '100%' },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing['2xl'],
    paddingBottom: 40,
    paddingTop: spacing.md,
  },
  logo: { width: 64, height: 64, marginBottom: 10 },
  brand: { marginBottom: spacing.sm },
  headline: { marginBottom: spacing.sm },
  body: { marginBottom: spacing.lg, lineHeight: 22, maxWidth: 360 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: spacing.xl, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
});
