import type { ReservedRegion } from '@altuu/attachment-bridge';

import { deriveDuoLayout } from './duoLayout';

const fold = (active: boolean): ReservedRegion => ({
  kind: 'division',
  active,
  frame: { x: 380, y: 0, width: 8, height: 800 },
});

const camera: ReservedRegion = {
  kind: 'occlusion',
  active: true,
  frame: { x: 0, y: 0, width: 40, height: 40 },
};

describe('deriveDuoLayout', () => {
  it('is not foldable without a division region', () => {
    const layout = deriveDuoLayout([camera], { width: 390, height: 844 });

    expect(layout.isFoldable).toBe(false);
    expect(layout.sideBar).toBe(false);
    expect(layout.display).toBe('other');
  });

  it('puts the side bar on the outer display in any orientation', () => {
    expect(
      deriveDuoLayout([fold(false)], { width: 390, height: 844 }),
    ).toMatchObject({ display: 'outer', sideBar: true, foldFrame: null });
    expect(
      deriveDuoLayout([fold(false)], { width: 844, height: 390 }),
    ).toMatchObject({ display: 'outer', sideBar: true });
  });

  it('keeps horizontal bars on the inner display in portrait', () => {
    expect(
      deriveDuoLayout([fold(false)], { width: 700, height: 900 }),
    ).toMatchObject({ display: 'inner', sideBar: false });
  });

  it('uses the side bar on the inner display in landscape', () => {
    expect(
      deriveDuoLayout([fold(false)], { width: 900, height: 700 }),
    ).toMatchObject({ display: 'inner', sideBar: true });
  });

  it('exposes the active fold and its axis', () => {
    const layout = deriveDuoLayout([fold(true), camera], {
      width: 800,
      height: 700,
    });

    expect(layout.foldFrame).toEqual({ x: 380, y: 0, width: 8, height: 800 });
    expect(layout.foldAxis).toBe('vertical');
    expect(
      deriveDuoLayout(
        [{ ...fold(true), frame: { x: 0, y: 380, width: 800, height: 8 } }],
        { width: 700, height: 800 },
      ).foldAxis,
    ).toBe('horizontal');
  });
});
