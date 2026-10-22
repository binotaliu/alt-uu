import { screen } from '@testing-library/react-native';

import { renderWithServices } from '../testUtils';
import { CourseInfoView } from './CourseInfoTab';

jest.mock('../../shell/openUrl', () => ({
  openInAppBrowser: jest.fn(),
  openExternalUrl: jest.fn(),
}));

const course = (previousExams: unknown[]) =>
  ({
    creditType: '必修',
    credits: 3,
    department: '資訊',
    nature: '一般',
    midtermDate: null,
    finalDate: null,
    examTimeStart: null,
    examTimeEnd: null,
    textbook: null,
    previousExams,
  }) as never;

const renderView = (previousExams: unknown[]) =>
  renderWithServices(
    <CourseInfoView
      nouToolsEnabled
      course={course(previousExams)}
      isLoading={false}
      error={null}
      portalInfo={null}
      onRetry={jest.fn()}
    />,
  );

describe('CourseInfoView past exams', () => {
  it('shows an empty state when the course has no past exams', async () => {
    await renderView([]);

    expect(screen.getByText('本課程無考古題')).toBeTruthy();
    expect(
      screen.getByText(
        '可能的原因：本課程是新開課程，或本課程為全遠距微學分課程。',
      ),
    ).toBeTruthy();
  });

  it('lists past exams without the empty state', async () => {
    await renderView([
      {
        term: '113-1',
        midtermReferencePrimary: 'a.pdf',
        midtermReferenceSecondary: null,
        finalReferencePrimary: null,
        finalReferenceSecondary: null,
      },
    ]);

    expect(screen.getByText('113-1')).toBeTruthy();
    expect(screen.queryByText('本課程無考古題')).toBeNull();
  });
});
