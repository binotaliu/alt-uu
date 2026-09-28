declare namespace AltUU {
    namespace Domains {
        namespace Account {
            namespace DataTransferObjects {
                export type AddAccountInputData = {
                    username: string;
                    password: string;
                };
                export type ReauthenticateAccountInputData = {
                    password: string;
                };
                export type RenameAccountInputData = {
                    nickname: string | null;
                };
            }
            namespace ViewModels {
                export type AccountViewModel = {
                    id: number;
                    username: string;
                    displayName: string;
                    nickname: string | null;
                    picture: string;
                    isActive: boolean;
                };
            }
        }
        namespace Activity {
            namespace ViewModels {
                export type ActivityDayViewModel = {
                    date: string;
                    seconds: number;
                };
                export type ActivityHeatmapViewModel = {
                    days: AltUU.Domains.Activity.ViewModels.ActivityDayViewModel[];
                    currentStreak: number;
                    longestStreak: number;
                    longestStudyDayDate: string | null;
                    longestStudyDaySeconds: number;
                    hasMultipleAccounts: boolean;
                };
            }
        }
        namespace AppConfig {
            namespace ViewModels {
                export type AppConfigViewModel = {
                    appearance: string;
                    accentColor: string;
                    nouToolsIntegrationEnabled: boolean;
                    screenReaderEnhancedSupportEnabled: boolean;
                    altUuPlusDisabled: boolean;
                    appName: string;
                    appVersion: string;
                    appVersionCode: string;
                    appDisplayVersion: string;
                    frameworkVersion: string;
                };
            }
        }
        namespace AppPreference {
            namespace DataTransferObjects {
                export type SetAltUuPlusDisabledInputData = {
                    disabled: boolean;
                };
                export type SetAppearanceInputData = {
                    appearance: string;
                };
                export type SetCellularPlaybackWarningEnabledInputData = {
                    enabled: boolean;
                };
                export type SetLiveSessionNicknameModalEnabledInputData = {
                    enabled: boolean;
                };
                export type SetLiveSessionsTimezoneInputData = {
                    timezone: string;
                };
                export type SetNouToolsIntegrationEnabledInputData = {
                    enabled: boolean;
                };
                export type SetOnboardingCompletedInputData = {
                    completed: boolean;
                };
                export type SetScreenReaderEnhancedSupportEnabledInputData = {
                    enabled: boolean;
                };
                export type UpdateAppPreferencesInputData = {
                    appearance: undefined | string;
                    accentColor: undefined | string;
                    nouToolsIntegrationEnabled: undefined | boolean;
                    screenReaderEnhancedSupportEnabled: undefined | boolean;
                    altUuPlusDisabled: undefined | boolean;
                    onboardingCompleted: undefined | boolean;
                    liveSessionsTimezone: undefined | string;
                    liveSessionNicknameModalEnabled: undefined | boolean;
                    cellularPlaybackWarningEnabled: undefined | boolean;
                    whatsNewSeenVersion: undefined | string;
                };
            }
            namespace ViewModels {
                export type AltUuPlusDisabledPreferenceViewModel = {
                    disabled: boolean;
                };
                export type AppPreferencesViewModel = {
                    appearance: string;
                    accentColor: string;
                    nouToolsIntegrationEnabled: boolean;
                    screenReaderEnhancedSupportEnabled: boolean;
                    altUuPlusDisabled: boolean;
                    onboardingCompleted: boolean;
                    liveSessionsTimezone: string;
                    liveSessionNicknameModalEnabled: boolean;
                    cellularPlaybackWarningEnabled: boolean;
                    whatsNewSeenVersion: string;
                };
                export type AppearancePreferenceViewModel = {
                    appearance: string;
                };
                export type CellularPlaybackWarningEnabledPreferenceViewModel =
                    {
                        enabled: boolean;
                    };
                export type LiveSessionNicknameModalEnabledPreferenceViewModel =
                    {
                        enabled: boolean;
                    };
                export type LiveSessionsTimezonePreferenceViewModel = {
                    timezone: string;
                };
                export type NouToolsIntegrationPreferenceViewModel = {
                    enabled: boolean;
                };
                export type OnboardingPreferenceViewModel = {
                    completed: boolean;
                };
                export type ScreenReaderEnhancedSupportPreferenceViewModel = {
                    enabled: boolean;
                };
            }
        }
        namespace AttachmentDownload {
            namespace DataTransferObjects {
                export type QueueAttachmentDownloadInputData = {
                    cid: string;
                    sourceUrl: string;
                    filename: string | null;
                    source: string;
                };
            }
            namespace ViewModels {
                export type AttachmentDownloadTaskViewModel = {
                    taskId: number;
                    status: string;
                    fileName: string | null;
                    mimeType: string | null;
                    fileSize: number | null;
                    errorMessage: string | null;
                    localFilePath: string | null;
                    expiresAt: string | null;
                };
            }
        }
        namespace Auth {
            namespace DataTransferObjects {
                export type LoginInputData = {
                    username: string;
                    password: string;
                };
            }
            namespace ViewModels {
                export type SessionProfileViewModel = {
                    displayName: string | null;
                    nickname: string | null;
                    picture: string | null;
                    username: string | null;
                };
            }
        }
        namespace Course {
            namespace DataTransferObjects {
                export type MaterialContentInputData = {
                    url: string;
                };
            }
            namespace Enums {
                export type VideoProvider = 'native' | 'youtube';
            }
            namespace ViewModels {
                export type CourseHomeworkItemViewModel = {
                    title: string;
                    percent: string;
                    type: string;
                    status: string | null;
                    window: string | null;
                    actionUrl: string | null;
                    resultUrl: string | null;
                    source: string;
                };
                export type CourseHomeworkListViewModel = {
                    homeworkItems: AltUU.Domains.Course.ViewModels.CourseHomeworkItemViewModel[];
                    schoolPortalNotices: AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalHomeworkNoticeViewModel[];
                };
                export type CourseItemViewModel = {
                    courseId: string;
                    commonCourseId: string | null;
                    semester: string | null;
                    name: string;
                    className: string | null;
                    courseType: string | null;
                };
                export type CourseLearningTimeItemViewModel = {
                    identifier: string;
                    href: string | null;
                    text: string;
                    level: number;
                    itemDisabled: boolean;
                    duration: string | null;
                };
                export type CourseMaterialNodeViewModel = {
                    identifier: string;
                    href: string | null;
                    text: string;
                    readed: boolean;
                    level: number;
                    leaf: boolean;
                    itemDisabled: boolean;
                };
                export type CourseMaterialResourceViewModel = {
                    downloadPath: string | null;
                    relativePath: string | null;
                    updateDatetime: number;
                    size: number;
                    metadata: string;
                    filename: string | null;
                    title: string | null;
                    href: string | null;
                };
                export type CoursePathInfoViewModel = {
                    code: number;
                    message: string;
                    courseId: string;
                    baseUrl: string | null;
                    progress: number;
                    pathText: string;
                };
                export type CourseSchoolPortalInfoViewModel = {
                    classSessionInfo: AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalClassSessionInfoViewModel | null;
                    examInfo: AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalExamInfoViewModel | null;
                };
                export type CourseTasksCountViewModel = {
                    courseId: string;
                    pendingHomeworks: number;
                    unreadArticles: number;
                };
                export type ParsedMaterialContentViewModel = {
                    videoUrl: string | null;
                    subtitleUrl: string | null;
                    downloadUrl: string | null;
                    downloadProxyUrl: string | null;
                    downloadFileName: string | null;
                    downloadFileExtension: string | null;
                    isPdf: boolean;
                    htmlContent: string | null;
                    videoProvider: AltUU.Domains.Course.Enums.VideoProvider;
                    embedVideoUrl: string | null;
                };
            }
        }
        namespace DataPortability {
            namespace DataTransferObjects {
                export type AccountDailyActivityImportItemData = {
                    username: string;
                    activityDate: string;
                    totalSeconds: number;
                };
                export type ImportDataInputData = {
                    accounts: Record<string, number>;
                    playbackProgress: AltUU.Domains.DataPortability.DataTransferObjects.PlaybackProgressImportItemData[];
                    accountDailyActivities: AltUU.Domains.DataPortability.DataTransferObjects.AccountDailyActivityImportItemData[];
                };
                export type PlaybackProgressImportItemData = {
                    username: string;
                    cid: string;
                    activityId: string;
                    durationSeconds: number;
                    positionSeconds: number;
                    hunguUploadSuccess: boolean | null;
                };
            }
            namespace ViewModels {
                export type AccountDailyActivityExportItemViewModel = {
                    username: string;
                    activityDate: string;
                    totalSeconds: number;
                };
                export type DataExportViewModel = {
                    exportedAt: string;
                    accounts: Record<string, number>;
                    playbackProgress: AltUU.Domains.DataPortability.ViewModels.PlaybackProgressExportItemViewModel[];
                    accountDailyActivities: AltUU.Domains.DataPortability.ViewModels.AccountDailyActivityExportItemViewModel[];
                };
                export type DataImportResultViewModel = {
                    importedAccountsCount: number;
                    skippedUsernames: string[];
                    importedPlaybackProgressCount: number;
                    importedAccountDailyActivitiesCount: number;
                };
                export type PlaybackProgressExportItemViewModel = {
                    username: string;
                    cid: string;
                    activityId: string;
                    durationSeconds: number;
                    positionSeconds: number;
                    hunguUploadSuccess: boolean | null;
                };
            }
        }
        namespace Diagnostics {
            namespace DataTransferObjects {
                export type ClientDiagnosticEventData = {
                    occurredAt: string;
                    type: string;
                    level: string;
                    summary: string;
                    op: string | null;
                    requestId: string | null;
                    status: number | null;
                    durationMs: number | null;
                    context: Record<string, unknown>;
                };
                export type ClientDiagnosticEventsInputData = {
                    events: AltUU.Domains.Diagnostics.DataTransferObjects.ClientDiagnosticEventData[];
                };
                export type SetDiagnosticRecordingInputData = {
                    enabled: boolean;
                };
            }
            namespace Enums {
                export type ConnectivityServiceEnum =
                    | 'hungu'
                    | 'school_portal'
                    | 'nou_tools'
                    | 'iap'
                    | 'google'
                    | 'cloudflare'
                    | 'apple';
                export type DiagnosticEventTypeEnum =
                    | 'api.request'
                    | 'upstream.call'
                    | 'parse.anomaly'
                    | 'exception'
                    | 'client.error'
                    | 'client.nav';
                export type DiagnosticLevelEnum = 'info' | 'warning' | 'error';
                export type DiagnosticSourceEnum = 'server' | 'client';
            }
            namespace ViewModels {
                export type ConnectivityCheckResultViewModel = {
                    service: AltUU.Domains.Diagnostics.Enums.ConnectivityServiceEnum;
                    label: string;
                    checkKind: string;
                    reachable: boolean;
                    statusCode: number | null;
                    latencyMs: number | null;
                    error: string | null;
                    checkedAt: string;
                };
                export type ConnectivityServiceListViewModel = {
                    services: AltUU.Domains.Diagnostics.ViewModels.ConnectivityServiceViewModel[];
                };
                export type ConnectivityServiceViewModel = {
                    service: AltUU.Domains.Diagnostics.Enums.ConnectivityServiceEnum;
                    label: string;
                    isReference: boolean;
                };
                export type DiagnosticBundleViewModel = {
                    filename: string;
                    content: string;
                };
                export type DiagnosticEventListViewModel = {
                    events: AltUU.Domains.Diagnostics.ViewModels.DiagnosticEventViewModel[];
                    total: number;
                    recordingEnabled: boolean;
                };
                export type DiagnosticEventViewModel = {
                    id: number;
                    occurredAt: string;
                    type: AltUU.Domains.Diagnostics.Enums.DiagnosticEventTypeEnum;
                    typeLabel: string;
                    level: AltUU.Domains.Diagnostics.Enums.DiagnosticLevelEnum;
                    source: AltUU.Domains.Diagnostics.Enums.DiagnosticSourceEnum;
                    op: string | null;
                    requestId: string | null;
                    summary: string;
                    status: number | null;
                    durationMs: number | null;
                    context: Record<string, unknown>;
                };
                export type DiagnosticRecordingStatusViewModel = {
                    available: boolean;
                    recording: boolean;
                    expiresAt: string | null;
                    windowMinutes: number;
                    retentionDays: number;
                };
                export type MaterialDirectoryInspectionViewModel = {
                    cid: string;
                    apiCode: number | null;
                    apiMessage: string | null;
                    nodeCount: number;
                    nodes: AltUU.Domains.Diagnostics.ViewModels.MaterialDirectoryNodeViewModel[];
                    rawJson: string;
                    rawJsonTruncated: boolean;
                };
                export type MaterialDirectoryNodeViewModel = {
                    identifier: string;
                    text: string;
                    level: number;
                    href: string | null;
                    leaf: boolean;
                    itemDisabled: boolean;
                    isInspectable: boolean;
                };
                export type MaterialParseOutcomeViewModel = {
                    succeeded: boolean;
                    kind: string;
                    videoUrl: string | null;
                    htmlLength: number;
                    downloadFileName: string | null;
                    errorClass: string | null;
                    errorMessage: string | null;
                    errorLocation: string | null;
                };
                export type MaterialSourceInspectionViewModel = {
                    cid: string;
                    scoid: string;
                    nodeText: string;
                    url: string;
                    fetchStatus: number | null;
                    contentType: string | null;
                    bodyBytes: number;
                    isText: boolean;
                    body: string | null;
                    bodyTruncated: boolean;
                    fetchError: string | null;
                    parse: AltUU.Domains.Diagnostics.ViewModels.MaterialParseOutcomeViewModel;
                };
            }
        }
        namespace Discuss {
            namespace ViewModels {
                export type AttachmentViewModel = {
                    filename: string | null;
                    href: string | null;
                };
                export type BoardListViewModel = {
                    courseId: string;
                    boards: AltUU.Domains.Discuss.ViewModels.BoardViewModel[];
                };
                export type BoardViewModel = {
                    boardId: string;
                    boardName: string;
                    allowPost: boolean;
                    hasNewPost: boolean;
                    subjectCount: number | null;
                };
                export type NodeListViewModel = {
                    courseId: string;
                    boardId: string;
                    nodes: AltUU.Domains.Discuss.ViewModels.NodeViewModel[];
                };
                export type NodeViewModel = {
                    node: string;
                    subject: string;
                    isRead: boolean;
                    poster: string | null;
                    repliesCount: number | null;
                    likesCount: number | null;
                    isBlocked: boolean;
                    blockedReason: string | null;
                };
                export type PostListViewModel = {
                    courseId: string;
                    boardId: string;
                    nodeId: string;
                    posts: AltUU.Domains.Discuss.ViewModels.PostViewModel[];
                };
                export type PostViewModel = {
                    floor: number;
                    node: string | null;
                    subject: string | null;
                    content: string | null;
                    poster: string | null;
                    realname: string | null;
                    postDate: string | null;
                    push: number;
                    liked: boolean;
                    whisperCount: number;
                    whispers: AltUU.Domains.Discuss.ViewModels.WhisperViewModel[];
                    attachments: AltUU.Domains.Discuss.ViewModels.AttachmentViewModel[];
                    isBlocked: boolean;
                    blockedReason: string | null;
                };
                export type WhisperViewModel = {
                    wid: string | null;
                    sid: string | null;
                    creator: string | null;
                    realname: string | null;
                    content: string | null;
                    createTime: string | null;
                    createTimeDescription: string | null;
                    canDelete: boolean | null;
                };
            }
        }
        namespace MaterialPreference {
            namespace DataTransferObjects {
                export type SetMaterialFontScaleInputData = {
                    scale: number;
                };
            }
            namespace ViewModels {
                export type MaterialFontScalePreferenceViewModel = {
                    scale: number;
                };
            }
        }
        namespace Moderation {
            namespace ViewModels {
                export type BlockedUserViewModel = {
                    poster: string;
                    realname: string;
                };
            }
        }
        namespace SchoolPortal {
            namespace ViewModels {
                export type SchoolPortalClassSessionInfoViewModel = {
                    courseName: string;
                    semesterLabel: string;
                    classDates: string | null;
                    classType: string | null;
                    classCode: string | null;
                    teacher: string | null;
                    classTime: string | null;
                };
                export type SchoolPortalExamAgendaItemViewModel = {
                    courseName: string;
                    category: string;
                    date: string | null;
                    time: string | null;
                    room: string | null;
                };
                export type SchoolPortalExamInfoViewModel = {
                    courseName: string;
                    semesterLabel: string;
                    schedules: AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalExamScheduleViewModel[];
                    scopes: AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalExamScopeViewModel[];
                };
                export type SchoolPortalExamScheduleViewModel = {
                    category: string;
                    date: string | null;
                    time: string | null;
                    room: string | null;
                    note: string | null;
                };
                export type SchoolPortalExamScopeViewModel = {
                    category: string;
                    scope: string | null;
                };
                export type SchoolPortalGradeViewModel = {
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
                };
                export type SchoolPortalHomeworkNoticeViewModel = {
                    title: string;
                    dueDate: string | null;
                    submissionMethod: string | null;
                    downloadUrl: string | null;
                };
            }
        }
        namespace StudyTime {
            namespace DataTransferObjects {
                export type StudyTimeInputData = {
                    cid: string;
                    activityId: string;
                    url: string;
                    seconds: number | null;
                    startedAt: undefined | null;
                };
            }
            namespace ViewModels {
                export type StudyTimeResultViewModel = {
                    ok: boolean;
                    seconds: number;
                    message: string | null;
                };
            }
        }
        namespace Subscription {
            namespace DataTransferObjects {
                export type PurchaseSubscriptionInputData = {
                    productId: string;
                };
            }
            namespace ViewModels {
                export type EntitlementViewModel = {
                    active: boolean;
                    productId: string | null;
                    expiresAt: string | null;
                    platform: string | null;
                };
                export type ProductViewModel = {
                    id: string;
                    displayName: string;
                    description: string;
                    displayPrice: string;
                    price: number;
                };
            }
        }
    }
}
