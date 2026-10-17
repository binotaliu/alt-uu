/**
 * View models of the course domain. Field names mirror the legacy
 * `resources/js/types/generated.d.ts` (AltUU.Domains.Course.*) so UI ports
 * keep parity.
 */

/** CourseItemViewModel */
export interface CourseItem {
    courseId: string;
    commonCourseId: string | null;
    semester: string | null;
    name: string;
    className: string | null;
    courseType: string | null;
}

/** CoursePathInfoViewModel */
export interface CoursePathInfo {
    code: number;
    message: string;
    courseId: string;
    baseUrl: string | null;
    progress: number;
    pathText: string;
}

/** CourseMaterialNodeViewModel */
export interface CourseMaterialNode {
    identifier: string;
    href: string | null;
    text: string;
    readed: boolean;
    level: number;
    leaf: boolean;
    itemDisabled: boolean;
}

/** GET /api/courses/{cid}/path */
export interface CoursePath {
    pathInfo: CoursePathInfo;
    materialNodes: CourseMaterialNode[];
}

/** CourseMaterialResourceViewModel */
export interface CourseMaterialResource {
    downloadPath: string | null;
    relativePath: string | null;
    updateDatetime: number;
    size: number;
    metadata: string;
    filename: string | null;
    title: string | null;
    href: string | null;
}

/** CourseLearningTimeItemViewModel */
export interface CourseLearningTimeItem {
    identifier: string;
    href: string | null;
    text: string;
    level: number;
    itemDisabled: boolean;
    duration: string | null;
}

/** CourseTasksCountViewModel */
export interface CourseTasksCount {
    courseId: string;
    pendingHomeworks: number;
    unreadArticles: number;
}

/** CourseHomeworkItemViewModel (also used for self exams). */
export interface CourseHomeworkItem {
    title: string;
    percent: string;
    type: string;
    status: string | null;
    window: string | null;
    actionUrl: string | null;
    resultUrl: string | null;
    source: string;
    isSubmitted: boolean;
    resultUnavailableReason: string | null;
}

/**
 * SchoolPortalHomeworkNoticeViewModel, as produced by the school portal
 * domain (structurally identical to its `SchoolPortalHomeworkNotice`).
 */
export interface CourseSchoolPortalHomeworkNotice {
    title: string;
    dueDate: string | null;
    submissionMethod: string | null;
    downloadUrl: string | null;
}

/** CourseHomeworkListViewModel */
export interface CourseHomeworkList {
    homeworkItems: CourseHomeworkItem[];
    schoolPortalNotices: CourseSchoolPortalHomeworkNotice[];
}

/** VideoProvider enum */
export type VideoProvider = 'native' | 'youtube';

/**
 * A request the app performs itself with the user's HUNGU session: the
 * attachment bridge `download({url, headers})`, or a player / WebView
 * request. Replaces the legacy local `/material-proxy/<b64>` URL.
 */
export interface MaterialFetchDescriptor {
    url: string;
    headers: Record<string, string>;
}

/**
 * ParsedMaterialContentViewModel plus the fields that replace the legacy
 * material proxy.
 *
 * Intentional differences from legacy (no local proxy server exists):
 * - `htmlContent` keeps same-host `src` URLs as absolute upstream URLs
 *   (legacy: `/material-proxy/<b64>`). Render it in a WebView with
 *   `baseUrl` as the page URL and the HUNGU cookies seeded via
 *   `setWebViewCookies`.
 * - `subtitleUrl` is the absolute upstream URL; `subtitle` carries the
 *   headers to fetch it.
 * - `downloadProxyUrl` is always null; use `download` with the attachment
 *   bridge instead.
 */
export interface ParsedMaterialContent {
    videoUrl: string | null;
    subtitleUrl: string | null;
    downloadUrl: string | null;
    downloadProxyUrl: null;
    downloadFileName: string | null;
    downloadFileExtension: string | null;
    isPdf: boolean;
    htmlContent: string | null;
    videoProvider: VideoProvider;
    embedVideoUrl: string | null;
    /** Page URL to use as the WebView base URL (null when there is no HTML). */
    baseUrl: string | null;
    download: MaterialFetchDescriptor | null;
    subtitle: MaterialFetchDescriptor | null;
}

/** GET /api/courses/{cid}/last-seen-material */
export interface CourseLastSeenMaterial {
    activityId: string | null;
    positionSeconds: number | null;
    mediaDurationSeconds: number | null;
}

/** GET /api/courses/{cid}/playback-progress/{activityId} `progress` */
export interface CoursePlaybackProgress {
    cid: string;
    activityId: string;
    studySeconds: number;
    positionSeconds: number;
    mediaDurationSeconds: number | null;
    hunguUploadSuccess: boolean | null;
    /** ISO 8601 in UTC (`toIso8601String`), or null. */
    updatedAt: string | null;
}
