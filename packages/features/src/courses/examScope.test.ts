import { parseExamScope } from './examScope';

describe('parseExamScope', () => {
  it('splits the run-on portal string into label / value entries', () => {
    expect(
      parseExamScope(
        '媒體教材：第1-1~9-4講次。 教科書：第一章～第九章（第1頁～第172頁）。 命題參考題型(正考)：簡答題50%申論題50%',
      ),
    ).toEqual([
      { label: '媒體教材', value: '第1-1~9-4講次' },
      { label: '教科書', value: '第一章～第九章（第1頁～第172頁）' },
      { label: '命題參考題型(正考)', value: '簡答題50%申論題50%' },
    ]);
  });

  it('splits space-separated text with ASCII colons and leading unlabeled text', () => {
    expect(
      parseExamScope(
        '第一章～第六章 命題參考題型 (正考)：是非題 10% 選擇題 60% 參考資料或工具 (正考): 可攜帶任何紙本參考資料 命題參考題型 (補考)：是非題 10%',
      ),
    ).toEqual([
      { label: null, value: '第一章～第六章' },
      { label: '命題參考題型 (正考)', value: '是非題 10% 選擇題 60%' },
      { label: '參考資料或工具 (正考)', value: '可攜帶任何紙本參考資料' },
      { label: '命題參考題型 (補考)', value: '是非題 10%' },
    ]);
  });

  it('keeps unlabeled text as a value-only entry', () => {
    expect(parseExamScope('第一章～第六章')).toEqual([
      { label: null, value: '第一章～第六章' },
    ]);
  });
});
