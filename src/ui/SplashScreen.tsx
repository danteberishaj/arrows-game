import React, { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Palette } from './theme';
import { Wordmark } from './Wordmark';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Animated intro: the wordmark springs in, then a line-art arrow — the same
 * stroke the game is made of — draws itself underneath, bends once (of
 * course it bends), and lands its arrowhead. Fades out and hands over to the
 * menu. Tap anywhere to skip.
 */
export function SplashScreen({ palette, onDone }: { palette: Palette; onDone: () => void }) {
  const { width } = useWindowDimensions();

  const mark = useSharedValue(0); // wordmark spring-in
  const draw = useSharedValue(0); // arrow self-draw 0..1
  const head = useSharedValue(0); // arrowhead pop
  const out = useSharedValue(0); // whole-screen fade-out

  // Underline arrow geometry: run under the wordmark, one playful Z-bend.
  const w = Math.min(width * 0.62, 340);
  const H = 56; // svg height
  const stroke = 7;
  // left -> dip down -> back up -> continue right (a small Z in the middle)
  const d = `M${8} ${18} L${w * 0.42} ${18} L${w * 0.42} ${38} L${w * 0.58} ${38} L${w * 0.58} ${18} L${w - 26} ${18}`;
  const pathLen = (w * 0.42 - 8) + 20 + (w * 0.16) + 20 + (w - 26 - w * 0.58) + 8;
  const tipX = w - 24;
  const headD = `M${tipX + 17} ${18} L${tipX} ${8.5} L${tipX} ${27.5} Z`;

  useEffect(() => {
    mark.value = withDelay(150, withSpring(1, { damping: 14, stiffness: 120 }));
    draw.value = withDelay(650, withTiming(1, { duration: 850, easing: Easing.inOut(Easing.cubic) }));
    head.value = withDelay(1450, withSpring(1, { damping: 12, stiffness: 260 }));
    out.value = withDelay(2250, withTiming(1, { duration: 380, easing: Easing.in(Easing.quad) }, (f) => {
      if (f) runOnJS(onDone)();
    }));
  }, []);

  const skip = () => {
    out.value = withTiming(1, { duration: 180 }, (f) => {
      if (f) runOnJS(onDone)();
    });
  };

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.72 + 0.28 * mark.value }, { translateY: 10 * (1 - mark.value) }],
  }));
  const shaftProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLen * (1 - draw.value),
  }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: head.value,
    transform: [{ scale: 0.4 + 0.6 * head.value }],
  }));

  return (
    <Pressable style={[styles.root, { backgroundColor: palette.bg }]} onPress={skip}>
      <Animated.View style={[styles.center, rootStyle]}>
        <Animated.View style={markStyle}>
          <Wordmark size={56} palette={palette} />
        </Animated.View>

        <Animated.View style={{ marginTop: 26 }}>
          <Svg width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
            <AnimatedPath
              d={d}
              animatedProps={shaftProps}
              stroke={palette.ink}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${pathLen} ${pathLen}`}
            />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, headStyle]}>
            <Svg width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
              <Path d={headD} fill={palette.accent} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
});
