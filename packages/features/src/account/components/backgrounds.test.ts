import { accentPalettes } from '@altuu/ui';

import { authBackgroundStyle, subscriptionHeroStyle } from './backgrounds';

describe('legacy gradient backgrounds', () => {
  it('draws the auth radial gradient in light mode only', () => {
    expect(authBackgroundStyle(false)?.backgroundImage).toMatch(
      /^radial-gradient\(circle at top right, /,
    );
    expect(authBackgroundStyle(true)).toBeUndefined();
  });

  it('ends the subscription hero gradient in the accent colour', () => {
    expect(subscriptionHeroStyle(false, 'ocean').backgroundImage).toBe(
      `linear-gradient(to bottom right, #f59e0b, #f97316, ${accentPalettes.ocean['700']})`,
    );
    expect(subscriptionHeroStyle(true, 'ocean').backgroundImage).toContain(
      '#18181b',
    );
  });
});
