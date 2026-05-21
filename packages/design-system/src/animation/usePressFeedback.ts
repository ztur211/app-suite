import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { tokens } from '../tokens';

export function usePressFeedback() {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = () => {
    scale.value = withTiming(0.97, { duration: tokens.motion.duration.instant });
  };
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: tokens.motion.duration.fast });
  };
  return { animatedStyle, onPressIn, onPressOut };
}
