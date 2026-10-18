import { describe, expect, it } from 'vitest';
import { loadGolden } from '../../../test/fixtures';
import { DiagnosticRedactor, REDACTED } from './redactor';

interface RedactorCase {
  op: string;
  salt: string;
  input: unknown;
}

function run(input: RedactorCase): unknown {
  const redactor = new DiagnosticRedactor(input.salt);

  switch (input.op) {
    case 'redact':
      return redactor.redact(input.input as Record<string, unknown>);
    case 'redactText':
      return redactor.redactText(input.input as string);
    case 'redactUrl':
      return redactor.redactUrl(input.input as string);
    case 'redactSecrets':
      return redactor.redactSecrets(input.input as string);
    case 'pseudonymizeStable':
      return (input.input as string[]).map((value) =>
        redactor.pseudonymize(value),
      );
    case 'pseudonymizeSalts': {
      const { value, saltA, saltB } = input.input as {
        value: string;
        saltA: string;
        saltB: string;
      };

      return [
        new DiagnosticRedactor(saltA).pseudonymize(value),
        new DiagnosticRedactor(saltB).pseudonymize(value),
      ];
    }
    default:
      throw new Error(`Unknown op ${input.op}`);
  }
}

describe('DiagnosticRedactor parity with the legacy PHP output', () => {
  const golden = loadGolden('diagnostics', 'redactor-cases');

  it.each(golden.cases.map((testCase) => [testCase.name, testCase] as const))(
    '%s',
    (_name, testCase) => {
      expect(run(testCase.input as RedactorCase)).toEqual(testCase.output);
    },
  );
});

describe('DiagnosticRedactor', () => {
  const redactor = new DiagnosticRedactor('test-salt');

  it('keeps the placeholder constant', () => {
    expect(REDACTED).toBe('[已遮蔽]');
  });

  it('redacts arrays element by element', () => {
    expect(redactor.redact([{ ticket: 'abc' }, 'login u1001'])).toEqual([
      { ticket: REDACTED },
      expect.stringMatching(/^login user#/),
    ]);
  });

  it('falls back to redactText for a string with no URL structure', () => {
    expect(redactor.redactUrl('')).toBe('');
    expect(redactor.redactUrl('about:blank')).toBe('about://blank');
  });

  it('does not decode other query values', () => {
    expect(redactor.redactUrl('https://uu.nou.edu.tw/x?q=a%20b&token=1')).toBe(
      `https://uu.nou.edu.tw/x?q=a b&token=${REDACTED}`,
    );
  });
});
