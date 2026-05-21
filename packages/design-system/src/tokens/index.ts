import { colors } from './colors';
import { typography } from './typography';
import { space } from './space';
import { radius } from './radius';
import { shadow } from './shadow';
import { motion } from './motion';

export { colors, type AppAccent, type AppAccentColor } from './colors';
export { typography } from './typography';
export { space } from './space';
export { radius } from './radius';
export { shadow } from './shadow';
export { motion } from './motion';

export const tokens = { colors, typography, space, radius, shadow, motion } as const;
export type Tokens = typeof tokens;
