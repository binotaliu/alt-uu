/* eslint-disable @typescript-eslint/no-require-imports */
import {
  adjustColourForDark,
  processHtmlForColorScheme,
} from './htmlColorScheme';
import {
  buildMaterialHtmlDocument,
  clampFontScale,
  fontScaleScript,
  parseMaterialHtmlMessage,
} from './materialHtmlDocument';
import { lightboxDocument } from './lightboxDocument';

jest.mock('@altuu/attachment-bridge', () =>
  require('@altuu/attachment-bridge/mock'),
);

const palette = {
  text: '#111111',
  heading: '#000000',
  link: '#0000ff',
  muted: '#666666',
  border: '#dddddd',
  codeBackground: '#eeeeee',
};

describe('processHtmlForColorScheme', () => {
  const html = '<p style="color: #000000; font-weight: bold">黑字</p>';

  it('leaves light mode untouched', () => {
    expect(processHtmlForColorScheme(html, false)).toBe(html);
  });

  it('lightens dark text in dark mode', () => {
    expect(processHtmlForColorScheme(html, true)).toBe(
      '<p style="color: #f2f2f2; font-weight: bold">黑字</p>',
    );
  });

  it('darkens light backgrounds and adds a text colour for the shorthand', () => {
    expect(
      processHtmlForColorScheme('<td style="background: #ffffff">x</td>', true),
    ).toBe('<td style="background: #0d0d0d; color: #f2f2f2">x</td>');
  });

  it('keeps already readable colours and unknown values', () => {
    expect(adjustColourForDark('#eeeeee', 'color')).toBe('#eeeeee');
    expect(adjustColourForDark('inherit', 'color')).toBe('inherit');
    expect(adjustColourForDark('rgba(0, 0, 0, 0.5)', 'color')).toBe(
      'rgba(242, 242, 242, 0.5)',
    );
  });

  it('handles single-quoted style attributes', () => {
    expect(
      processHtmlForColorScheme("<span style='color: black'>x</span>", true),
    ).toBe("<span style='color: #f2f2f2'>x</span>");
  });
});

describe('material HTML document', () => {
  it('wraps the content with the stylesheet and dark adjustments', () => {
    const document = buildMaterialHtmlDocument({
      html: ' <p style="color: #000">內容</p> ',
      isDark: true,
      fontScale: 1.2,
      palette,
    });

    expect(document).toContain(
      '<div id="altuu-content"><p style="color: #f2f2f2">內容</p></div>',
    );
    expect(document).toContain('--altuu-scale: 1.2');
    expect(document).toContain('color-scheme: dark');
  });

  it('clamps the font scale', () => {
    expect(clampFontScale(2)).toBe(1.6);
    expect(clampFontScale(0.2)).toBe(0.7);
    expect(clampFontScale(1.1000000001)).toBe(1.1);
    expect(fontScaleScript(5)).toContain("'1.6'");
  });

  it('parses bridge messages', () => {
    expect(parseMaterialHtmlMessage('{"type":"height","height":420}')).toEqual({
      type: 'height',
      height: 420,
    });
    expect(
      parseMaterialHtmlMessage('{"type":"link","href":"https://a/b"}'),
    ).toEqual({ type: 'link', href: 'https://a/b' });
    expect(
      parseMaterialHtmlMessage('{"type":"image","src":"https://a/i.png"}'),
    ).toEqual({ type: 'image', src: 'https://a/i.png', alt: '' });
    expect(parseMaterialHtmlMessage('nope')).toBeNull();
    expect(parseMaterialHtmlMessage('{"type":"height"}')).toBeNull();
  });

  it('escapes the lightbox image attributes', () => {
    expect(
      lightboxDocument({
        src: 'https://a/i.png?x=1&y="2"',
        alt: '<圖>',
        baseUrl: 'https://a/',
      }),
    ).toContain('src="https://a/i.png?x=1&amp;y=&quot;2&quot;" alt="&lt;圖>"');
  });
});
