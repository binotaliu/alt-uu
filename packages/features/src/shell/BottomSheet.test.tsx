import { BottomSheet, Text } from '@altuu/ui';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

async function renderSheet(visible: boolean, onClose = jest.fn()) {
  const element = (isVisible: boolean) => (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <BottomSheet visible={isVisible} onClose={onClose} title="標題">
        <Text>內容</Text>
      </BottomSheet>
    </SafeAreaProvider>
  );

  const view = await render(element(visible));

  return { element, onClose, rerender: view.rerender };
}

describe('BottomSheet', () => {
  it('renders nothing while hidden', async () => {
    await renderSheet(false);

    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('shows the title and children, then unmounts after closing', async () => {
    const { element, rerender } = await renderSheet(true);

    expect(screen.getByText('標題')).toBeTruthy();
    expect(screen.getByText('內容')).toBeTruthy();

    await rerender(element(false));

    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('closes from the backdrop', async () => {
    const { onClose } = await renderSheet(true);

    await fireEvent.press(screen.getByLabelText('關閉'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
