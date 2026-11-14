import { describe, expect, it, vi } from 'vitest';
import { createTestContext } from '../../../test/db/helpers';
import { loadFixture } from '../../../test/fixtures';
import {
  createSchoolPortalDomainServices,
  type SchoolPortalAccount,
} from './index';

const D = 'school-portal';
const accounts: SchoolPortalAccount[] = [
  { accountId: 1, username: 'u1001', label: '甲' },
  { accountId: 2, username: 'u2002', label: '乙' },
];

async function setup(
  options: { accounts?: SchoolPortalAccount[]; failingAccountId?: number } = {},
) {
  const context = await createTestContext();
  const requested: Array<{ page: string; accountId: number | undefined }> = [];
  const onError = vi.fn();
  const page =
    (key: string, body: string) =>
    async (accountId?: number): Promise<{ status: number; body: string }> => {
      requested.push({ page: key, accountId });

      if (accountId !== undefined && accountId === options.failingAccountId) {
        throw new Error('portal down');
      }

      return { status: 200, body };
    };
  const services = createSchoolPortalDomainServices({
    client: {
      fetchHomeworkNoticesPage: page('homework', ''),
      fetchCurrentSemesterGradesPage: page(
        'grades',
        loadFixture(D, 'all-grades.qryscore'),
      ),
      fetchHistoricalGradesPage: page(
        'historical',
        loadFixture(D, 'all-grades.qryscore2'),
      ),
      fetchClassSessionInfoPage: page('classSession', ''),
      fetchExamInfoPage: page('exam', loadFixture(D, 'exam-agenda')),
    },
    cache: context.cache,
    getProfileUsername: () => 'u1001',
    portalBaseUrl: 'https://nouapp.nou.edu.tw',
    listCourses: async () => [],
    listAccounts: async () => options.accounts ?? accounts,
    onError,
  });

  return { services, requested, onError };
}

describe('school portal all-accounts requests', () => {
  it('stays on the active account without account tags by default', async () => {
    const { services, requested } = await setup();
    const grades = await services.getAllCourseGrades();

    expect(grades.length).toBeGreaterThan(0);
    expect(grades.every((grade) => grade.accountId === undefined)).toBe(true);
    expect(requested.every((call) => call.accountId === undefined)).toBe(true);
  });

  it('stays on the active account when only one account exists', async () => {
    const { services, requested } = await setup({
      accounts: [accounts[0]],
    });
    const agenda = await services.getExamAgenda({ allAccounts: true });

    expect(agenda.every((item) => item.accountId === undefined)).toBe(true);
    expect(requested.every((call) => call.accountId === undefined)).toBe(true);
  });

  it('merges grades of every account, tagged with account and label', async () => {
    const { services, requested } = await setup();
    const single = await services.getAllCourseGrades();
    const merged = await services.getAllCourseGrades({ allAccounts: true });

    expect(merged).toHaveLength(single.length * 2);
    expect(merged.filter((grade) => grade.accountId === 1)).toEqual(
      single.map((grade) => ({ ...grade, accountId: 1, accountLabel: '甲' })),
    );
    expect(merged.filter((grade) => grade.accountLabel === '乙')).toHaveLength(
      single.length,
    );
    expect(
      requested.filter((call) => call.accountId === 2).map((c) => c.page),
    ).toEqual(['grades', 'historical']);
  });

  it('merges exam agenda and scopes per account', async () => {
    const { services } = await setup();
    const single = await services.getExamAgenda();
    const agenda = await services.getExamAgenda({ allAccounts: true });
    const scopes = await services.getExamScopes({ allAccounts: true });

    expect(agenda).toHaveLength(single.length * 2);
    expect(new Set(agenda.map((item) => item.accountId))).toEqual(
      new Set([1, 2]),
    );
    expect(scopes.every((item) => item.accountLabel !== undefined)).toBe(true);
  });

  it('keeps a separate cache per account', async () => {
    const { services, requested } = await setup();

    await services.getExamAgenda({ allAccounts: true });
    await services.getExamAgenda({ allAccounts: true });

    expect(requested.filter((call) => call.page === 'exam')).toHaveLength(2);
  });

  it('reports and skips an account whose fetch fails', async () => {
    const { services, onError } = await setup({ failingAccountId: 2 });
    const agenda = await services.getExamAgenda({ allAccounts: true });

    expect(agenda.length).toBeGreaterThan(0);
    expect(agenda.every((item) => item.accountId === 1)).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
