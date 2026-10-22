import { mockNativeModule } from '@altuu/attachment-bridge/mock';
import { useDuoLayout } from '@altuu/ui';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DuoLayoutProvider } from './DuoLayoutProvider';

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

afterEach(() => {
  mockGetRegions.mockReset().mockImplementation(async () => []);
});

describe('DuoLayoutProvider', () => {
  it('picks up folding from the hinge event without any window resize', async () => {
    mockGetRegions.mockResolvedValue([division(false)]);
    await render(
      <DuoLayoutProvider>
        <Probe />
      </DuoLayoutProvider>,
    );

    expect(screen.getByTestId('probe').props.children).toBe('true:flat');

    mockGetRegions.mockResolvedValue([division(true)]);
    await act(async () => {
      mockNativeModule.emitFoldChange();
    });

    expect(screen.getByTestId('probe').props.children).toBe('true:folded');

    mockGetRegions.mockResolvedValue([division(false)]);
    await act(async () => {
      mockNativeModule.emitFoldChange();
    });

    expect(screen.getByTestId('probe').props.children).toBe('true:flat');
  });

  it('stops listening on unmount', async () => {
    mockGetRegions.mockResolvedValue([]);
    const view = await render(
      <DuoLayoutProvider>
        <Probe />
      </DuoLayoutProvider>,
    );

    expect(mockNativeModule.foldListenerCount()).toBe(1);

    await view.unmount();

    expect(mockNativeModule.foldListenerCount()).toBe(0);
    expect(screen.queryByTestId('probe')).toBeNull();
  });
});
