import type { AccountId } from '../../session/types';
import type { JsonObject } from './nouToolsClient';

/** One matched class of a course, as the live-sessions screen consumes it. */
export interface LiveSessionItem {
    accountId: AccountId | null;
    accountLabel: string;
    courseId: string;
    courseName: string;
    semester: string | null;
    className: string | null;
    classCode: string | null;
    type: string | null;
    typeLabel: string | null;
    teacherName: string | null;
    link: string | null;
    backupClassroomUrl: string | null;
    startTime: string | null;
    endTime: string | null;
    sessions: JsonObject[];
}

/** Payload of the legacy `GET /api/courses/{cid}/nou-tools-info`. */
export interface NouToolsCourseInfo {
    course: {
        courseId: string;
        courseName: string;
        className: string | null;
        nouToolsCourseId: number | null;
        descriptionUrl: string | null;
        creditType: string | null;
        credits: number | null;
        department: string | null;
        nature: string | null;
        midtermDate: string | null;
        finalDate: string | null;
        examTimeStart: string | null;
        examTimeEnd: string | null;
        textbook: JsonObject | null;
        previousExams: JsonObject[];
    } | null;
}
