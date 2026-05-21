export const motion = {
  duration: {
    instant: 80,
    fast: 150,
    normal: 220,
    slow: 320,
    deliberate: 480,
  },
  easing: {
    settle: 'cubic-bezier(0.16, 1, 0.3, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;
