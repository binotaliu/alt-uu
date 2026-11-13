import {
  mockNativeModule,
  resetAttachmentBridgeMock,
} from '@altuu/attachment-bridge/mock';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithServices } from '../../courses/testUtils';
import { AttachmentSection } from './AttachmentSection';

jest.mock('@altuu/attachment-bridge', () =>
  jest.requireActual('@altuu/attachment-bridge/mock'),
);

beforeEach(() => {
  resetAttachmentBridgeMock();
});

describe('AttachmentSection file attachments', () => {
  it('downloads with the session cookies and previews the file', async () => {
    await renderWithServices(
      <AttachmentSection
        cid="7"
        attachments={[
          { href: 'https://uu.nou.edu.tw/files/a.pdf', filename: 'a.pdf' },
        ]}
        onOpenImage={jest.fn()}
      />,
      {
        course: {
          prepareMaterialFetch: jest.fn(async (url: string) => ({
            url,
            headers: { 'user-agent': 'UA', Cookie: 'PHPSESSID=sess' },
            baseUrl: 'https://uu.nou.edu.tw',
          })),
        },
      },
    );

    await fireEvent.press(screen.getByText('a.pdf'));
    await fireEvent.press(await screen.findByText('確認下載'));

    await waitFor(() =>
      expect(mockNativeModule.previewFile).toHaveBeenCalled(),
    );
    const request = mockNativeModule.download.mock.calls[0][0];
    expect(request.cookies).toEqual([
      { name: 'PHPSESSID', value: 'sess', domain: 'uu.nou.edu.tw', path: '/' },
    ]);
    expect(request.headers).toEqual({ 'user-agent': 'UA' });
  });
});
