/** View model shapes mirror legacy resources/js/types/generated.d.ts (camelCase). */
export interface SchoolPortalGrade {
    courseName: string;
    semesterLabel: string;
    credits: string | null;
    firstRegularScore: string | null;
    secondRegularScore: string | null;
    participationScore: string | null;
    regularAverage: string | null;
    midtermScore: string | null;
    finalScore: string | null;
    semesterGrade: string | null;
}

export interface SchoolPortalClassSessionInfo {
    courseName: string;
    semesterLabel: string;
    classDates: string | null;
    classType: string | null;
    classCode: string | null;
    teacher: string | null;
    classTime: string | null;
}

export interface SchoolPortalExamSchedule {
    category: string;
    date: string | null;
    time: string | null;
    room: string | null;
    note: string | null;
}

export interface SchoolPortalExamScope {
    category: string;
    scope: string | null;
}

export interface SchoolPortalExamInfo {
    courseName: string;
    semesterLabel: string;
    schedules: SchoolPortalExamSchedule[];
    scopes: SchoolPortalExamScope[];
}

export interface SchoolPortalExamAgendaItem {
    courseName: string;
    category: string;
    date: string | null;
    time: string | null;
    room: string | null;
}

export interface SchoolPortalHomeworkNotice {
    title: string;
    dueDate: string | null;
    submissionMethod: string | null;
    downloadUrl: string | null;
}

export interface CourseSchoolPortalInfo {
    classSessionInfo: SchoolPortalClassSessionInfo | null;
    examInfo: SchoolPortalExamInfo | null;
}

/** The minimal slice of a course the school portal domain needs. */
export interface SchoolPortalCourseRef {
    courseId: string;
    name: string;
    semester: string;
}

/** Internal parsed row of the grade / class session pages. */
export interface ParsedPortalItem {
    courseName: string;
    normalizedCourseName: string;
    semesterLabel: string;
    termCode: string | null;
    fields: Record<string, string>;
}
