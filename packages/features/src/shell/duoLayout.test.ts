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

  it('recognises the closed outer display by its edge status strip', () => {
    const strip: ReservedRegion = {
      kind: 'occlusion',
      active: true,
      frame: { x: 382, y: 0, width: 84, height: 174 },
    };

    expect(
      deriveDuoLayout([camera, strip], { width: 466, height: 678 }),
    ).toMatchObject({ isFoldable: true, display: 'outer', sideBar: true });
  });

  it('ignores a centred camera cut-out on a regular iPhone', () => {
    const island: ReservedRegion = {
      kind: 'occlusion',
      active: true,
      frame: { x: 132, y: 11, width: 126, height: 37 },
    };

    expect(
      deriveDuoLayout([island], { width: 390, height: 844 }).isFoldable,
    ).toBe(false);
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
