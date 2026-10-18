import { fireEvent, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

import { openExternalUrl } from '../shell/openUrl';
import { LiveSessionsScreen } from './LiveSessionsScreen';
import { SchoolCalendarScreen } from './SchoolCalendarScreen';
import { renderWithServices } from './testUtils';

jest.mock('../shell/openUrl', () => ({
    openInAppBrowser: jest.fn(),
    openExternalUrl: jest.fn(),
}));

const session = (date: string) => ({
    accountId: 1,
    accountLabel: '我',
    courseId: 'c1',
    courseName: '線性代數',
    semester: '114-1',
    className: '甲班',
    classCode: 'A',
    type: 'live',
    typeLabel: '視訊',
    teacherName: '王老師',
    link: 'https://meet.example/room',
    backupClassroomUrl: 'https://meet.example/backup',
    startTime: null,
    endTime: null,
    sessions: [{ date, startTime: '19:00:00', endTime: '21:00:00' }],
});

const accountsOverride = {
    account: {
        list: async () => [
            {
                id: 1,
                username: 's123',
                displayName: '王小明',
                nickname: null,
                picture: '',
                isActive: true,
            },
        ],
    },
};

describe('LiveSessionsScreen', () => {
    it('shows sessions, then the nickname dialog before entering the classroom', async () => {
        await renderWithServices(<LiveSessionsScreen />, {
            ...accountsOverride,
            nouTools: {
                liveSessions: jest.fn(async () => [session('2999-01-01')]),
            },
        });

        expect(await screen.findByText('線性代數')).toBeTruthy();
        expect(screen.getByText('即將開始 / 進行中')).toBeTruthy();
        expect(screen.getByText('目前沒有已結束的視訊面授。')).toBeTruthy();

        await fireEvent.press(screen.getByText('進入教室'));
        expect(screen.getByDisplayValue('s123 王小明')).toBeTruthy();

        await fireEvent.press(screen.getByLabelText('複製顯示暱稱'));
        expect(Clipboard.setStringAsync).toHaveBeenCalledWith('s123 王小明');
        expect(await screen.findByText('已複製')).toBeTruthy();

        await fireEvent.press(screen.getAllByText('進入教室')[1]);
        expect(openExternalUrl).toHaveBeenCalledWith(
            'https://meet.example/room',
        );
    });

    it('shows the empty state', async () => {
        await renderWithServices(<LiveSessionsScreen />, {
            ...accountsOverride,
            nouTools: { liveSessions: jest.fn(async () => []) },
        });

        expect(
            await screen.findByText('目前沒有可顯示的視訊面授班級資訊。'),
        ).toBeTruthy();
    });

    it('shows the error panel when loading fails', async () => {
        await renderWithServices(<LiveSessionsScreen />, {
            ...accountsOverride,
            nouTools: {
                liveSessions: jest.fn(async () => {
                    throw new Error('x');
                }),
            },
        });

        expect(await screen.findByText('重試')).toBeTruthy();
    });
});

describe('SchoolCalendarScreen', () => {
    it('shows events and the countdown card', async () => {
        await renderWithServices(<SchoolCalendarScreen />, {
            nouTools: {
                schoolCalendar: jest.fn(async () => [
                    {
                        name: '遠方考試',
                        startDate: '2999-01-01',
                        endDate: '2999-01-02',
                        isCountdown: true,
                    },
                    {
                        name: '舊活動',
                        startDate: '2000-01-01',
                        endDate: '2000-01-01',
                        isCountdown: false,
                    },
                ]),
            },
        });

        expect(await screen.findByText('遠方考試')).toBeTruthy();
        expect(screen.getByText('天後')).toBeTruthy();
        expect(screen.getByText('舊活動')).toBeTruthy();
        expect(screen.getAllByText('已結束')).toHaveLength(2);
    });

    it('shows the empty state', async () => {
        await renderWithServices(<SchoolCalendarScreen />, {
            nouTools: { schoolCalendar: jest.fn(async () => []) },
        });

        expect(
            await screen.findByText('目前沒有可顯示的學校行事曆。'),
        ).toBeTruthy();
    });
});
