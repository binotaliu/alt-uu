import { describe, expect, it } from 'vitest';
import golden from '../__goldens__/clean-material-html.golden.json';
import { decodeLegacyProxyUrls } from '../testing';
import { cleanMaterialHtml } from './cleanMaterialHtml';

interface CalibrationCase {
  name: string;
  url: string;
  html: string;
  output: string;
}

/**
 * Cases where the port knowingly differs from HTMLPurifier. Values are the
 * port's output.
 */
const KNOWN_DIFFERENCES: Record<string, { reason: string; output: string }> = {
  'nonascii-url': {
    reason:
      'legacy mangled bytes 0x80-0x9F of percent-encoded UTF-8 into "_"; the port encodes UTF-8 correctly',
    output:
      '<p><img src="https://uu.nou.edu.tw/base/1/content/2/images/%E5%B0%81%E9%9D%A2%20%E5%9C%96.jpg" alt="x"><a href="https://uu.nou.edu.tw/base/1/content/2/files/%E8%AC%9B%E7%BE%A9%201.pdf?x=a%20b#frag%201" target="_blank" rel="noreferrer noopener">dl</a></p>',
  },
  'quote-attr': {
    reason:
      'legacy truncated an href at a decoded `"`; the port percent-encodes it',
    output:
      '<p><a href="https://x.example/?a=%22b%22&amp;c=1" title="he said &quot;hi&quot; &amp; &lt;" target="_blank" rel="noreferrer noopener">q</a></p>',
  },
  'block-in-a': {
    reason:
      'HTMLPurifier re-opens <a> inside and after a block it contains; the port closes the link before the block',
    output: '\n\n<div>blk</div>',
  },
};

const cases = (golden.cases as CalibrationCase[]).map(
  (testCase) => [testCase.name, testCase] as const,
);

describe('cleanMaterialHtml against real HTMLPurifier output', () => {
  it.each(cases)('%s', (name, testCase) => {
    const expected =
      KNOWN_DIFFERENCES[name]?.output ?? decodeLegacyProxyUrls(testCase.output);

    expect(cleanMaterialHtml(testCase.html, testCase.url)).toBe(expected);
  });
});
