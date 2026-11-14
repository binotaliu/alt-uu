import { groupByAccount } from './accountGroups';

describe('groupByAccount', () => {
  it('keeps rows without an account in a single unlabelled group', () => {
    expect(groupByAccount([{ n: 1 }, { n: 2 }] as never[])).toEqual([
      { accountId: null, label: '', items: [{ n: 1 }, { n: 2 }] },
    ]);
  });

  it('groups rows per account in first-seen order', () => {
    const rows = [
      { accountId: 2, accountLabel: '乙', n: 1 },
      { accountId: 1, accountLabel: '甲', n: 2 },
      { accountId: 2, accountLabel: '乙', n: 3 },
    ];

    expect(groupByAccount(rows)).toEqual([
      { accountId: 2, label: '乙', items: [rows[0], rows[2]] },
      { accountId: 1, label: '甲', items: [rows[1]] },
    ]);
  });

  it('returns nothing for no rows', () => {
    expect(groupByAccount([])).toEqual([]);
  });
});
