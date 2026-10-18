import {
  buildBeforeContentLoadedScript,
  createCssInjectionScript,
  viewportFixScript,
} from './browserScripts';
import { homeworkCss } from './homeworkCss';

describe('buildBeforeContentLoadedScript', () => {
  it('only fixes the viewport without a css preset', () => {
    const script = buildBeforeContentLoadedScript(null);

    expect(script).toContain(viewportFixScript);
    expect(script).not.toContain('__altuu_attachment_css__');
    expect(script.trim().endsWith('true;')).toBe(true);
  });

  it('adds a style element carrying the homework css', () => {
    const script = buildBeforeContentLoadedScript('homework');

    expect(script).toContain('__altuu_attachment_css__');
    expect(script).toContain(JSON.stringify(homeworkCss));
  });

  it('produces runnable javascript that injects the css', () => {
    const appended: Array<{ id?: string; textContent?: string }> = [];
    const documentElement = {
      appendChild: (node: object) => appended.push(node),
    };
    const fakeDocument = {
      getElementById: () => null,
      createElement: () => ({}),
      head: null,
      documentElement,
      querySelector: () => null,
    };

    new Function('document', createCssInjectionScript('a{color:red}'))(
      fakeDocument,
    );

    expect(appended).toEqual([
      { id: '__altuu_attachment_css__', textContent: 'a{color:red}' },
    ]);
  });

  it('sets a device-width viewport meta', () => {
    const meta: { name?: string; content?: string } = {};
    const fakeDocument = {
      querySelector: () => null,
      createElement: () => meta,
      head: { appendChild: jest.fn() },
      documentElement: {},
    };

    new Function('document', viewportFixScript)(fakeDocument);

    expect(meta).toEqual({
      name: 'viewport',
      content: 'width=device-width, initial-scale=1',
    });
  });
});
