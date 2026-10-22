export interface ExamScopeEntry {
  label: string | null;
  value: string;
}

// A label is a non-space run (plus an optional "(正考)" qualifier) right before a colon.
const SCOPE_LABEL =
  /([^\s\d：:。][^\s：:。]*(?:\s*[(（][^)）]*[)）])?)\s*[：:]/g;

const trimSentenceEnd = (text: string): string =>
  text.replace(/[\s。]+$/, '').trim();

/**
 * The portal sends one run-on string, separated by 。 or only by spaces
 * ("第一章～第六章 命題參考題型 (正考)：… 參考資料或工具 (正考): …"). Split it at
 * each "label：" into label / value entries; leading unlabeled text is kept.
 */
export function parseExamScope(scope: string): ExamScopeEntry[] {
  const labels = [...scope.matchAll(SCOPE_LABEL)];
  const entries: ExamScopeEntry[] = [];
  const head = trimSentenceEnd(
    scope.slice(0, labels[0]?.index ?? scope.length),
  );

  if (head !== '') {
    entries.push({ label: null, value: head });
  }

  labels.forEach((match, index) => {
    const valueStart = match.index + match[0].length;
    const valueEnd = labels[index + 1]?.index ?? scope.length;
    const value = trimSentenceEnd(scope.slice(valueStart, valueEnd));

    entries.push({ label: (match[1] ?? '').trim(), value });
  });

  return entries.filter((entry) => entry.value !== '');
}
