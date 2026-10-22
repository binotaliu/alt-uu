import { DuoLayoutContext, type DuoLayout } from '@altuu/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { resetStores } from '../../testing/fakeServices';
import { renderScreen } from '../testing';
import { OnboardingScreen, onboardingPadding } from './OnboardingScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

const none = { top: 0, right: 0, bottom: 0, left: 0 };

beforeEach(() => {
  resetStores();
});

describe('onboardingPadding', () => {
  it('keeps the card inside every safe-area edge, landscape notch included', () => {
    expect(
      onboardingPadding(
        { top: 0, right: 0, bottom: 21, left: 59 },
        none,
        null,
        844,
      ),
    ).toEqual({
      paddingTop: 32,
      paddingBottom: 32,
      paddingLeft: 59,
      paddingRight: 20,
    });
  });

  it('stays clear of the iPadOS window controls', () => {
    expect(
      onboardingPadding(none, { ...none, top: 40, left: 84 }, null, 1024),
    ).toMatchObject({ paddingTop: 40, paddingLeft: 84 });
  });

  it('moves the card to the wider side of the fold', () => {
    const fold = { x: 300, y: 0, width: 12, height: 800 };

    expect(onboardingPadding(none, none, fold, 700)).toMatchObject({
      paddingLeft: 312,
      paddingRight: 20,
    });
    expect(
      onboardingPadding(none, none, { ...fold, x: 400 }, 700),
    ).toMatchObject({ paddingLeft: 20, paddingRight: 300 });
  });
});

describe('OnboardingScreen', () => {
  it('walks through the slides', async () => {
    await renderScreen(<OnboardingScreen />);

    expect(screen.getByText('這是什麼 App？')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('onboarding-continue'));

    expect(screen.getByText('保存學習時數')).toBeTruthy();
  });

  it('renders on a folded iPhone Duo', async () => {
    const layout: DuoLayout = {
      isFoldable: true,
      display: 'inner',
      foldFrame: { x: 360, y: 0, width: 12, height: 800 },
      foldAxis: 'vertical',
      sideBar: false,
    };

    await renderScreen(
      <DuoLayoutContext.Provider value={layout}>
        <OnboardingScreen />
      </DuoLayoutContext.Provider>,
    );

    expect(screen.getByText('這是什麼 App？')).toBeTruthy();
  });
});
