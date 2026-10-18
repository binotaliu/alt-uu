import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PostHtml, toTextStyle } from './components/PostHtml';
import { getReasonLabel, isUserBlocked } from './moderation';
import { isImageAttachment } from './attachments';
import { whisperText } from './DiscussThreadScreen';

jest.mock('@altuu/attachment-bridge', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@altuu/attachment-bridge/mock'),
);

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe('PostHtml', () => {
  it('renders inline formatting, lists and links', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PostHtml html='<p>a <b>粗</b> <a href="https://x.example/">連結</a></p><ul><li>一</li><li>二</li></ul><ol><li>甲</li></ol>' />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('粗')).toBeTruthy();
    expect(screen.getByText('連結')).toBeTruthy();
    expect(screen.getByText('一')).toBeTruthy();
    expect(screen.getAllByText('•')).toHaveLength(2);
    expect(screen.getByText('1.')).toBeTruthy();
  });

  it('offers audio and video as links', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PostHtml html='<video controls><source src="https://x.example/v.mp4" type="video/mp4"></video>' />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('播放影片')).toBeTruthy();
  });
});

describe('toTextStyle', () => {
  it('maps the purifier CSS subset', () => {
    expect(
      toTextStyle(
        {
          color: '#FF0000',
          'font-size': '12pt',
          'font-weight': 'bold',
          'font-style': 'italic',
          'text-decoration': 'underline line-through',
          'text-align': 'center',
        },
        false,
      ),
    ).toEqual({
      color: '#FF0000',
      fontSize: 16,
      fontWeight: '700',
      fontStyle: 'italic',
      textDecorationLine: 'underline line-through',
      textAlign: 'center',
    });
  });

  it('remaps dark text colours in dark mode', () => {
    expect(toTextStyle({ color: '#000000' }, true).color).toBe('#f2f2f2');
  });
});

describe('helpers', () => {
  it('detects image attachments by filename then url', () => {
    expect(isImageAttachment('a.PNG', null)).toBe(true);
    expect(isImageAttachment(null, 'https://x/y.jpg?x=1')).toBe(true);
    expect(isImageAttachment('a.pdf', 'https://x/y.jpg')).toBe(false);
  });

  it('labels report reasons and falls back to 其他', () => {
    expect(getReasonLabel('c')).toBe('受版權保護的內容');
    expect(getReasonLabel('zzz')).toBe('其他');
    expect(getReasonLabel(null)).toBe('其他');
  });

  it('matches blocked users on poster and realname', () => {
    const blocked = [{ poster: 'u1', realname: 'A' }];

    expect(isUserBlocked(blocked, 'u1', 'A')).toBe(true);
    expect(isUserBlocked(blocked, 'u1', 'B')).toBe(false);
    expect(isUserBlocked(blocked, null, 'A')).toBe(false);
  });

  it('turns whisper markup into text', () => {
    expect(whisperText('a<br />\nb &lt;c&gt;')).toBe('a\nb <c>');
    expect(whisperText(null)).toBe('（無內容）');
  });
});
