import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { account, resetStores } from '../../testing/fakeServices';
import { renderScreen, withServices } from '../testing';
import { ExamInfoScreen } from './ExamInfoScreen';
import { GradesScreen } from './GradesScreen';

beforeEach(() => resetStores());

// Lets the accounts query settle so no update lands after the test ends.
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});

const grade = (courseName: string, extra: object = {}) => ({
  courseName,
  semesterLabel: '114下學期',
  credits: '3',
  firstRegularScore: null,
  secondRegularScore: null,
  participationScore: null,
  regularAverage: null,
  midtermScore: null,
  finalScore: null,
  semesterGrade: '80',
  ...extra,
});

const exam = (courseName: string, extra: object = {}) => ({
  courseName,
  category: '期中考(正考)',
  date: '2026年11月07日(星期六)',
  time: '1500~1610第5節',
  room: null,
  ...extra,
});

function setupGrades(accountCount: number) {
  const getAllCourseGrades = jest.fn(
    async ({ allAccounts }: { allAccounts?: boolean } = {}) =>
      allAccounts
        ? [
            grade('甲課程', { accountId: 1, accountLabel: '主帳號' }),
            grade('乙課程', { accountId: 2, accountLabel: '副帳號' }),
          ]
        : [grade('甲課程')],
  );
  const { services } = withServices({
    account: {
      list: async () =>
        Array.from({ length: accountCount }, (_, index) =>
          account(index + 1, { isActive: index === 0 }),
        ),
    },
    schoolPortalDomain: { getAllCourseGrades },
  });

  return { services, getAllCourseGrades };
}

describe('GradesScreen account scope', () => {
  it('hides the switch with a single account', async () => {
    const { services } = setupGrades(1);
    await renderScreen(<GradesScreen />, services);

    expect(await screen.findByText('甲課程')).toBeTruthy();
    await act(async () => {});
    expect(screen.queryByText('所有帳號')).toBeNull();
  });

  it('lists every account under its own heading in 所有帳號', async () => {
    const { services, getAllCourseGrades } = setupGrades(2);
    await renderScreen(<GradesScreen />, services);

    await screen.findByText('甲課程');
    expect(screen.queryByText('主帳號')).toBeNull();
    expect(getAllCourseGrades).toHaveBeenLastCalledWith({
      allAccounts: false,
    });

    await act(async () => {
      fireEvent.press(screen.getByText('所有帳號'));
    });

    expect(await screen.findByText('主帳號')).toBeTruthy();
    expect(screen.getByText('副帳號')).toBeTruthy();
    expect(screen.getByText('乙課程')).toBeTruthy();
    expect(getAllCourseGrades).toHaveBeenLastCalledWith({ allAccounts: true });
  });
});

describe('ExamInfoScreen account scope', () => {
  it('requests agenda and scopes for every account and labels each block', async () => {
    const getExamAgenda = jest.fn(
      async ({ allAccounts }: { allAccounts?: boolean } = {}) =>
        allAccounts
          ? [
              exam('甲課程', { accountId: 1, accountLabel: '主帳號' }),
              exam('乙課程', { accountId: 2, accountLabel: '副帳號' }),
            ]
          : [exam('甲課程')],
    );
    const getExamScopes = jest.fn(async () => []);
    const { services } = withServices({
      account: {
        list: async () => [account(1, { isActive: true }), account(2)],
      },
      schoolPortalDomain: { getExamAgenda, getExamScopes },
    });
    await renderScreen(<ExamInfoScreen />, services);

    await screen.findByText('甲課程');
    await act(async () => {
      fireEvent.press(screen.getByText('所有帳號'));
    });

    expect(await screen.findByText('副帳號')).toBeTruthy();
    expect(screen.getByText('主帳號')).toBeTruthy();
    await waitFor(() =>
      expect(getExamScopes).toHaveBeenLastCalledWith({ allAccounts: true }),
    );
  });
});
