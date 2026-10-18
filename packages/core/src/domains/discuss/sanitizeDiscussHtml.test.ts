import { describe, expect, it } from 'vitest';
import golden from './__goldens__/sanitize-discuss-html.golden.json';
import { sanitizeDiscussHtml } from './sanitizeDiscussHtml';

interface CalibrationCase {
  name: string;
  html: string;
  output: string;
}

/** Cases where the port knowingly differs from HTMLPurifier (port output). */
const KNOWN_DIFFERENCES: Record<string, { reason: string; output: string }> =
  {};

const cases = (golden.cases as CalibrationCase[]).map(
  (testCase) => [testCase.name, testCase] as const,
);

describe('sanitizeDiscussHtml against real HTMLPurifier output', () => {
  it.each(cases)('%s', (name, testCase) => {
    expect(sanitizeDiscussHtml(testCase.html)).toBe(
      KNOWN_DIFFERENCES[name]?.output ?? testCase.output,
    );
  });

  it('never lets script or event handlers through', () => {
    const output = sanitizeDiscussHtml(
      '<img src="x.png" onerror="alert(1)"><a href="javascript:alert(1)">x</a><script>alert(1)</script>',
    );

    expect(output).not.toMatch(/onerror|javascript:|<script/i);
  });
});
