import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { MaterialDirectory } from './MaterialDirectory';
import type { DirectorySourceNode } from './materialTree';

const node = (
  identifier: string,
  duration: string | null,
): DirectorySourceNode => ({
  identifier,
  href: `/m/${identifier}`,
  text: `教材 ${identifier}`,
  level: 0,
  itemDisabled: false,
  duration,
});

const nodes = [node('a', '00:10'), node('b', null), node('c', null)];

const layout = (y: number, height: number) => ({
  nativeEvent: { layout: { x: 0, y, width: 300, height } },
});

async function renderDirectory() {
  await render(<MaterialDirectory selectedCid="1" nodes={nodes} />);

  const scroll = screen.getByTestId('material-directory-scroll');

  await fireEvent(scroll, 'layout', layout(0, 400));
  // The first unread row ("b") sits far below the viewport.
  await fireEvent(
    screen.getAllByTestId('material-node')[1],
    'layout',
    layout(900, 50),
  );

  return scroll;
}

const scrollTo = async (
  scroll: Parameters<typeof fireEvent.scroll>[0],
  y: number,
) =>
  await fireEvent.scroll(scroll, {
    nativeEvent: { contentOffset: { x: 0, y } },
  });

describe('MaterialDirectory unread jump', () => {
  it('shows the jump button once the user scrolls away from the first unread material', async () => {
    const scroll = await renderDirectory();

    await scrollTo(scroll, 0);

    expect(screen.getByTestId('material-jump-to-unread')).toBeTruthy();
  });

  it('hides the jump button while the first unread material is in view', async () => {
    const scroll = await renderDirectory();

    await scrollTo(scroll, 700);

    await waitFor(() =>
      expect(screen.queryByTestId('material-jump-to-unread')).toBeNull(),
    );
  });

  it('shows no jump button when every material has been watched', async () => {
    await render(
      <MaterialDirectory selectedCid="1" nodes={[node('a', '00:10')]} />,
    );

    expect(screen.queryByTestId('material-jump-to-unread')).toBeNull();
  });
});
