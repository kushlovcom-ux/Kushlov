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

const { width, height } = Dimensions.get('window');

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
      <View style={styles.root}>
        <FlatList
          ref={listRef}
          data={HERO}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <View style={{ width, height: height * 0.62 }}>
              <Image source={item.image} style={styles.heroImage} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(5,5,8,0.55)', c.bg]}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}
        />

        <View style={styles.overlay}>
          <Image
            source={require('../../assets/images/kush.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="display" style={styles.brand}>
            Kushlov
          </Text>
          <Text variant="h2" style={styles.headline}>
            {slide.title}
          </Text>
          <Text muted style={styles.body}>
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
                    width: i === index ? 22 : 8,
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
            variant="outline"
            fullWidth
            size="lg"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: spacing.md }}
          />
          <Button
            title="See how it works"
            variant="ghost"
            fullWidth
            onPress={() => navigation.navigate('Onboarding')}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050508' },
  heroImage: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing['2xl'],
    paddingBottom: 36,
  },
  logo: { width: 56, height: 56, marginBottom: 8 },
  brand: { marginBottom: spacing.sm },
  headline: { marginBottom: spacing.sm },
  body: { marginBottom: spacing.lg, lineHeight: 22, maxWidth: 360 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: spacing.xl },
  dot: { height: 8, borderRadius: 4 },
});
