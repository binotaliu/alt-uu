import { mockNativeModule } from '@altuu/attachment-bridge/mock';
import { useDuoLayout } from '@altuu/ui';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DuoLayoutProvider, FOLD_POLL_INTERVAL_MS } from './DuoLayoutProvider';

jest.mock('@altuu/attachment-bridge', () =>
  jest.requireActual('@altuu/attachment-bridge/mock'),
);

const mockGetRegions = mockNativeModule.getReservedRegions;

const division = (active: boolean) => ({
  kind: 'division' as const,
  active,
  frame: { x: 380, y: 0, width: 8, height: 800 },
});

function Probe() {
  const { isFoldable, foldFrame } = useDuoLayout();

  return (
    <Text testID="probe">{`${isFoldable}:${foldFrame ? 'folded' : 'flat'}`}</Text>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  mockGetRegions.mockReset().mockImplementation(async () => []);
});

describe('DuoLayoutProvider', () => {
  it('picks up folding without any window resize', async () => {
    mockGetRegions.mockResolvedValue([division(false)]);
    await render(
      <DuoLayoutProvider>
        <Probe />
      </DuoLayoutProvider>,
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(FOLD_POLL_INTERVAL_MS);
    });

    expect(screen.getByTestId('probe').props.children).toBe('true:flat');

    mockGetRegions.mockResolvedValue([division(true)]);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(FOLD_POLL_INTERVAL_MS);
    });

    expect(screen.getByTestId('probe').props.children).toBe('true:folded');

    mockGetRegions.mockResolvedValue([division(false)]);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(FOLD_POLL_INTERVAL_MS);
    });

    expect(screen.getByTestId('probe').props.children).toBe('true:flat');
  });

  it('does not poll a device without a fold', async () => {
    mockGetRegions.mockResolvedValue([]);
    await render(
      <DuoLayoutProvider>
        <Probe />
      </DuoLayoutProvider>,
    );
    const callsAfterMount = mockGetRegions.mock.calls.length;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(FOLD_POLL_INTERVAL_MS * 5);
    });

    expect(mockGetRegions.mock.calls.length).toBe(callsAfterMount);
    expect(screen.getByTestId('probe').props.children).toBe('false:flat');
  });
});
