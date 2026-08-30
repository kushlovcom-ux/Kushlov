import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type LiveHeartsHandle = {
  /** Spawn one rising heart. Call once per like. */
  burst: (count?: number) => void;
};

type Heart = {
  key: number;
  color: string;
  size: number;
  drift: number;
  delay: number;
};

const COLORS = ['#FF4D8D', '#FF7AB6', '#FF3B6B', '#FFC1DA', '#FFD36E', '#8E7BFF'];

/** Too many at once turns the stream into confetti and costs frames. */
const MAX_ALIVE = 24;

let seq = 0;

function pick<T>(list: readonly T[]) {
  return list[Math.floor(Math.random() * list.length)]!;
}

function RisingHeart({ heart, onDone }: { heart: Heart; onDone: (key: number) => void }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 2400,
      delay: heart.delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) onDone(heart.key);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -240],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, heart.drift, -heart.drift, heart.drift * 0.5, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0.4, 1, 0.75],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.heart, { opacity, transform: [{ translateY }, { translateX }, { scale }] }]}
    >
      <Ionicons name="heart" size={heart.size} color={heart.color} />
    </Animated.View>
  );
}

/**
 * Floating like hearts. Kept imperative so a like never re-renders the room —
 * the stage below is a LiveKit surface and repainting it drops frames.
 */
export const LiveHearts = forwardRef<LiveHeartsHandle>(function LiveHearts(_props, ref) {
  const [hearts, setHearts] = useState<Heart[]>([]);

  const remove = useCallback((key: number) => {
    setHearts((prev) => prev.filter((h) => h.key !== key));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      burst: (count = 1) => {
        const batch: Heart[] = [];
        for (let i = 0; i < Math.min(count, 6); i += 1) {
          seq += 1;
          batch.push({
            key: seq,
            color: pick(COLORS),
            size: 22 + Math.round(Math.random() * 14),
            drift: 16 + Math.random() * 28,
            delay: i * 110,
          });
        }
        setHearts((prev) => [...prev, ...batch].slice(-MAX_ALIVE));
      },
    }),
    [],
  );

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {hearts.map((h) => (
        <RisingHeart key={h.key} heart={h} onDone={remove} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 8,
    // Starts above the composer / filter carousel so hearts read as coming
    // off the like button rather than out from behind the controls.
    bottom: 56,
    width: 96,
    height: 300,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 30,
    elevation: 30,
  },
  heart: {
    position: 'absolute',
    bottom: 0,
  },
});
