import type { AccountCredentialsStore } from '../../accounts';
import { isRecord } from '../../http/encoding';
import type {
    AccountId,
    HunguSession,
    SessionStore,
} from '../../session/types';
import {
    NouToolsClient,
    type JsonObject,
    type NouToolsClientDeps,
} from './nouToolsClient';
import {
    getNouToolsCourseData,
    UNDIVIDED_CLASS_CODE,
    type NouToolsUserCourse,
} from './nouToolsCourseData';
import type { LiveSessionItem, NouToolsCourseInfo } from './types';

export interface NouToolsServicesDeps extends NouToolsClientDeps {
    credentials: Pick<AccountCredentialsStore, 'all'>;
    activeAccountId: () => Promise<AccountId | null>;
    hunguSessions: SessionStore<HunguSession>;
    /** `preference:nou-tools-integration` (app-preference domain). */
    isIntegrationEnabled: () => Promise<boolean>;
    /**
     * The user's courses for an account (the course domain's ListCourses,
     * for the active account when `accountId` is null).
     */
    listUserCourses: (
        accountId: AccountId | null,
    ) => Promise<NouToolsUserCourse[]>;
    /** Reported when one account of an all-accounts fetch fails (legacy `report($e)`). */
    onError?: (error: unknown) => void;
}

/** NouTools live sessions, school calendar and course info. */
export function createNouToolsServices(deps: NouToolsServicesDeps) {
    const client = new NouToolsClient(deps);

    async function fetchSessionsForAccount(
        account: { nickname: string | null; username: string } | null,
        accountId: AccountId | null,
    ): Promise<LiveSessionItem[]> {
        const courseData = await getNouToolsCourseData(
            client,
            await deps.listUserCourses(accountId),
        );
        const accountLabel = await resolveAccountLabel(account, accountId);
        const sessions: LiveSessionItem[] = [];

        for (const item of courseData) {
            const matchedClass = item.matchedClass;

            if (
                matchedClass === null ||
                !isRecord(matchedClass.sessions ?? [])
            ) {
                continue;
            }

            const rawSessions = (matchedClass.sessions ?? []) as unknown;
            const classCode = stringOrNull(matchedClass.code);
            const sessionList = Array.isArray(rawSessions)
                ? rawSessions
                : Object.values(rawSessions as JsonObject);

            sessions.push({
                accountId,
                accountLabel,
                courseId: item.courseId,
                courseName: item.name,
                semester: item.semester,
                className:
                    classCode === UNDIVIDED_CLASS_CODE
                        ? UNDIVIDED_CLASS_CODE
                        : item.className,
                classCode,
                type: stringOrNull(matchedClass.type),
                typeLabel: stringOrNull(matchedClass.typeLabel),
                teacherName: stringOrNull(matchedClass.teacherName),
                link: stringOrNull(matchedClass.link),
                backupClassroomUrl: stringOrNull(
                    matchedClass.backupClassroomUrl,
                ),
                startTime: stringOrNull(matchedClass.startTime),
                endTime: stringOrNull(matchedClass.endTime),
                sessions: sessionList.filter((value): value is JsonObject =>
                    isRecord(value),
                ),
            });
        }

        return sessions;
    }

    async function resolveAccountLabel(
        account: { nickname: string | null; username: string } | null,
        accountId: AccountId | null,
    ): Promise<string> {
        if (account === null) {
            return '';
        }

        if (account.nickname !== null && account.nickname !== '') {
            return account.nickname;
        }

        const session =
            accountId === null ? null : await deps.hunguSessions.get(accountId);
        const profile = session?.profile;
        const displayName =
            isRecord(profile) &&
            typeof (profile as JsonObject).display_name === 'string'
                ? ((profile as JsonObject).display_name as string)
                : '';

        return displayName !== '' ? displayName : account.username;
    }

    return {
        client,

        /**
         * Sessions of the active account, or of every account with a stored
         * session when `allAccounts` is set and more than one account exists.
         * A failing account is reported and skipped in the all-accounts mode.
         */
        async liveSessions(
            options: { allAccounts?: boolean } = {},
        ): Promise<LiveSessionItem[]> {
            if (!(await deps.isIntegrationEnabled())) {
                return [];
            }

            const accounts = await deps.credentials.all();

            if (!(options.allAccounts === true && accounts.length > 1)) {
                const accountId = await deps.activeAccountId();
                const account =
                    accounts.find((candidate) => candidate.id === accountId) ??
                    null;

                return fetchSessionsForAccount(account, accountId);
            }

            const sessions: LiveSessionItem[] = [];

            for (const account of accounts) {
                if ((await deps.hunguSessions.get(account.id)) === null) {
                    continue;
                }

                try {
                    sessions.push(
                        ...(await fetchSessionsForAccount(account, account.id)),
                    );
                } catch (error) {
                    deps.onError?.(error);
                }
            }

            return sessions;
        },

        async schoolCalendar(): Promise<JsonObject[]> {
            if (!(await deps.isIntegrationEnabled())) {
                return [];
            }

            return client.getSchoolCalendar();
        },

        async courseInfo(cid: string): Promise<NouToolsCourseInfo> {
            if (!(await deps.isIntegrationEnabled())) {
                return { course: null };
            }

            const courseData = await getNouToolsCourseData(
                client,
                await deps.listUserCourses(null),
            );
            const current = courseData.find((item) => item.courseId === cid);
            const detail = current?.detail;

            if (
                current === undefined ||
                detail === null ||
                detail === undefined
            ) {
                return { course: null };
            }

            return {
                course: {
                    courseId: current.courseId,
                    courseName: current.name,
                    className: current.className,
                    nouToolsCourseId: current.nouToolsCourseId,
                    descriptionUrl: valueOrNull(detail.descriptionUrl) as
                        string | null,
                    creditType: valueOrNull(detail.creditType) as string | null,
                    credits: valueOrNull(detail.credits) as number | null,
                    department: valueOrNull(detail.department) as string | null,
                    nature: valueOrNull(detail.nature) as string | null,
                    midtermDate: valueOrNull(detail.midtermDate) as
                        string | null,
                    finalDate: valueOrNull(detail.finalDate) as string | null,
                    examTimeStart: valueOrNull(detail.examTimeStart) as
                        string | null,
                    examTimeEnd: valueOrNull(detail.examTimeEnd) as
                        string | null,
                    textbook: isRecord(detail.textbook)
                        ? (detail.textbook as JsonObject)
                        : null,
                    previousExams: Array.isArray(detail.previousExams)
                        ? detail.previousExams.filter(
                              (exam): exam is JsonObject => isRecord(exam),
                          )
                        : [],
                },
            };
        },
    };
}

export type NouToolsServices = ReturnType<typeof createNouToolsServices>;

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

/** PHP `$array[$key] ?? null`. */
function valueOrNull(value: unknown): unknown {
    return value === undefined ? null : value;
}
