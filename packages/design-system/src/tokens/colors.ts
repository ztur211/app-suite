export const colors = {
  brand: {
    coral: '#FF6B47',
    pink: '#FF3D7F',
    gradient: ['#FF6B47', '#FF3D7F'] as const, // for LinearGradient consumers
  },
  apps: {
    do: '#FF6B47', // coral
    say: '#7B61FF', // violet
    buy: '#22C55E', // green
    eat: '#F59E0B', // amber
    send: '#0EA5E9', // sky
  },
  ink: {
    900: '#1A1424',
    700: '#3F3550',
    500: '#7B6E89',
    300: '#C9C0D2',
    200: '#E5DEE9',
    100: '#F2EDF5',
    50: '#FBF9FC',
  },
  surface: {
    canvas: '#FFFFFF',
    raised: '#FBF9FC',
    sunken: '#F2EDF5',
    overlay: 'rgba(26,20,36,0.6)',
  },
  semantic: {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#0EA5E9',
  },
} as const;

export type AppAccent = keyof typeof colors.apps;
export type AppAccentColor = (typeof colors.apps)[AppAccent];
