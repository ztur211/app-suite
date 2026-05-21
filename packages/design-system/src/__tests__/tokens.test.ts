import { tokens, colors, typography, space, radius, shadow, motion } from '../tokens';

describe('tokens', () => {
  describe('colors', () => {
    it('has brand palette with coral and pink', () => {
      expect(colors.brand.coral).toBe('#FF6B47');
      expect(colors.brand.pink).toBe('#FF3D7F');
      expect(Array.isArray(colors.brand.gradient)).toBe(true);
      expect(colors.brand.gradient).toHaveLength(2);
    });

    it('has per-app accent slots for all 5 apps', () => {
      expect(colors.apps.do).toBe('#FF6B47');
      expect(colors.apps.say).toBe('#7B61FF');
      expect(colors.apps.buy).toBe('#22C55E');
      expect(colors.apps.eat).toBe('#F59E0B');
      expect(colors.apps.send).toBe('#0EA5E9');
    });

    it('has ink scale with 7 stops', () => {
      const stops = Object.keys(colors.ink);
      expect(stops).toHaveLength(7);
      expect(colors.ink[900]).toBe('#1A1424');
      expect(colors.ink[50]).toBe('#FBF9FC');
    });

    it('has surface tokens', () => {
      expect(colors.surface.canvas).toBe('#FFFFFF');
      expect(colors.surface.raised).toBeTruthy();
      expect(colors.surface.sunken).toBeTruthy();
      expect(colors.surface.overlay).toMatch(/rgba/);
    });

    it('has semantic tokens for success/warning/danger/info', () => {
      expect(colors.semantic.success).toBe('#22C55E');
      expect(colors.semantic.warning).toBe('#F59E0B');
      expect(colors.semantic.danger).toBe('#EF4444');
      expect(colors.semantic.info).toBe('#0EA5E9');
    });
  });

  describe('typography', () => {
    it('has fontFamily with sans and mono', () => {
      expect(typography.fontFamily.sans).toBe('System');
      expect(typography.fontFamily.mono).toBe('Courier');
    });

    it('has fontSize scale with 8 stops', () => {
      expect(typography.fontSize.xs).toBe(12);
      expect(typography.fontSize.base).toBe(16);
      expect(typography.fontSize['4xl']).toBe(48);
    });

    it('has fontWeight with 5 named weights', () => {
      expect(typography.fontWeight.regular).toBe('400');
      expect(typography.fontWeight.bold).toBe('700');
      expect(typography.fontWeight.black).toBe('800');
    });

    it('has letterSpacing tokens', () => {
      expect(typography.letterSpacing.tight).toBeLessThan(0);
      expect(typography.letterSpacing.normal).toBe(0);
      expect(typography.letterSpacing.wide).toBeGreaterThan(0);
    });
  });

  describe('space', () => {
    it('has 4px grid baseline', () => {
      expect(space[1]).toBe(4);
      expect(space[2]).toBe(8);
      expect(space[4]).toBe(16);
    });

    it('has 0 and large values', () => {
      expect(space[0]).toBe(0);
      expect(space[24]).toBe(96);
    });
  });

  describe('radius', () => {
    it('has none to full scale', () => {
      expect(radius.none).toBe(0);
      expect(radius.xs).toBe(6);
      expect(radius.full).toBe(9999);
    });

    it('has named stops xs through 2xl', () => {
      expect(radius.sm).toBe(10);
      expect(radius.md).toBe(14);
      expect(radius.lg).toBe(18);
      expect(radius.xl).toBe(22);
      expect(radius['2xl']).toBe(28);
    });
  });

  describe('shadow', () => {
    it('has sm shadow with low elevation', () => {
      expect(shadow.sm.elevation).toBe(1);
      expect(shadow.sm.shadowOpacity).toBeLessThan(0.1);
    });

    it('has md shadow with brand coral color', () => {
      expect(shadow.md.shadowColor).toBe('#FF6B47');
      expect(shadow.md.elevation).toBe(3);
    });

    it('has lg shadow with high elevation', () => {
      expect(shadow.lg.elevation).toBe(8);
      expect(shadow.lg.shadowRadius).toBe(32);
    });

    it('all shadows have required RN shadow props', () => {
      for (const key of ['sm', 'md', 'lg'] as const) {
        expect(shadow[key]).toHaveProperty('shadowColor');
        expect(shadow[key]).toHaveProperty('shadowOffset');
        expect(shadow[key]).toHaveProperty('shadowOpacity');
        expect(shadow[key]).toHaveProperty('shadowRadius');
        expect(shadow[key]).toHaveProperty('elevation');
      }
    });
  });

  describe('motion', () => {
    it('has duration scale from instant to deliberate', () => {
      expect(motion.duration.instant).toBe(80);
      expect(motion.duration.fast).toBe(150);
      expect(motion.duration.normal).toBe(220);
      expect(motion.duration.slow).toBe(320);
      expect(motion.duration.deliberate).toBe(480);
    });

    it('has named easing curves', () => {
      expect(motion.easing.settle).toMatch(/cubic-bezier/);
      expect(motion.easing.spring).toMatch(/cubic-bezier/);
      expect(motion.easing.exit).toMatch(/cubic-bezier/);
      expect(motion.easing.smooth).toMatch(/cubic-bezier/);
    });
  });

  describe('tokens bundle', () => {
    it('exports all token namespaces', () => {
      expect(tokens.colors).toBe(colors);
      expect(tokens.typography).toBe(typography);
      expect(tokens.space).toBe(space);
      expect(tokens.radius).toBe(radius);
      expect(tokens.shadow).toBe(shadow);
      expect(tokens.motion).toBe(motion);
    });
  });
});
