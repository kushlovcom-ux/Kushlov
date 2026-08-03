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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/common/Screen';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAuthStore } from '@/store/auth';
import { spacing } from '@/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    title: 'Discover people nearby',
    body: 'Browse hosts and members with live presence and verified profiles.',
    image: require('../../assets/onboarding/k1.png'),
  },
  {
    key: '2',
    title: 'Chat, call & go live',
    body: 'Message matches, hop on audio/video, or stream to your audience.',
    image: require('../../assets/onboarding/k2.png'),
  },
  {
    key: '3',
    title: 'Diamonds power moments',
    body: 'Top up diamonds for calls, gifts, and premium conversations.',
    image: require('../../assets/onboarding/k3.png'),
  },
];

export function OnboardingScreen() {
  const c = useThemeColors();
  const navigation = useNavigation();
  const setOnboardingSeen = useAuthStore((s) => s.setOnboardingSeen);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  const finish = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.onboardingDone, '1');
    setOnboardingSeen(true);
    // If nested under Auth stack, try Welcome; otherwise root will switch via store.
    try {
      (navigation as { navigate?: (name: string) => void }).navigate?.('Welcome');
    } catch {
      /* root onboarding */
    }
  };

  const next = () => {
    if (index >= SLIDES.length - 1) {
      void finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <Screen padded={false}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.imageWrap}>
              <Image source={item.image} style={styles.image} resizeMode="contain" />
            </View>
            <Text variant="h1" style={styles.title}>
              {item.title}
            </Text>
            <Text muted style={styles.body}>
              {item.body}
            </Text>
          </View>
        )}
      />
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                { backgroundColor: i === index ? c.primary : c.borderStrong },
              ]}
            />
          ))}
        </View>
        <Button
          title={index === SLIDES.length - 1 ? 'Get started' : 'Next'}
          onPress={next}
          fullWidth
          size="lg"
        />
        <Button
          title="Skip"
          variant="ghost"
          onPress={() => void finish()}
          fullWidth
          style={{ marginTop: spacing.lg }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  slide: { paddingTop: 24, alignItems: 'center' },
  // Art is 1774×887 (2:1). Match that frame so contain shows the full image.
  imageWrap: {
    width: width - 48,
    aspectRatio: 2,
    borderRadius: 24,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: { textAlign: 'center', paddingHorizontal: 24 },
  body: { textAlign: 'center', paddingHorizontal: 32, marginTop: spacing.sm },
  footer: { padding: spacing['2xl'], paddingBottom: 40 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
