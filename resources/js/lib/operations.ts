/**
 * Maps an API call onto a short, stable code and a human label.
 *
 * The code is what makes a screenshot diagnosable. A user sends
 * "載入課程失敗 [CRS-U500]" and that alone says: the course list, and the
 * upstream service answered 500 — no need to ask them to expand anything.
 *
 * Operations are matched from the URL so every existing call site gets a
 * correct code without being touched. Pass `op` explicitly to apiFetch when a
 * URL is ambiguous or a new endpoint needs its own identity.
 */

export interface Operation {
    /** Short uppercase code shown inline, e.g. CRS. */
    code: string;
    /** zh-TW description shown in the detail panel and the log viewer. */
    label: string;
}

export const OPERATIONS: Record<string, Operation> = {
    'courses.list': { code: 'CRS', label: '課程列表' },
    'courses.tasksCount': { code: 'CTC', label: '課程任務統計' },
    'courses.path': { code: 'CPTH', label: '教材目錄' },
    'courses.content': { code: 'MCNT', label: '教材內容' },
    'courses.resources': { code: 'MRES', label: '教材資源' },
    'courses.learningTimes': { code: 'CLT', label: '學習時數' },
    'courses.homeworks': { code: 'CHW', label: '作業' },
    'courses.selfExams': { code: 'CSE', label: '自我練習' },
    'courses.grade': { code: 'CGRD', label: '成績' },
    'courses.lastSeenMaterial': { code: 'CLSM', label: '最後觀看教材' },
    'material.parsed': { code: 'MPRS', label: '教材解析' },
    'playback.progress': { code: 'PLAY', label: '播放進度' },
    'discuss.boards': { code: 'DBRD', label: '討論板' },
    'discuss.nodes': { code: 'DNOD', label: '討論主題' },
    'discuss.posts': { code: 'DPST', label: '討論文章' },
    'discuss.whispers': { code: 'DWSP', label: '悄悄話' },
    'discuss.read': { code: 'DRD', label: '討論已讀狀態' },
    'nouTools.liveSessions': { code: 'LIVE', label: '視訊面授' },
    'nouTools.schoolCalendar': { code: 'CAL', label: '學校行事曆' },
    'nouTools.courseInfo': { code: 'CINF', label: '課程資訊' },
    'accounts.list': { code: 'ACCT', label: '帳號列表' },
    'accounts.activity': { code: 'AACT', label: '學習活動' },
    'accounts.switch': { code: 'ASW', label: '切換帳號' },
    'auth.login': { code: 'LGIN', label: '登入' },
    'auth.logout': { code: 'LGUT', label: '登出' },
    'auth.profile': { code: 'PROF', label: '個人資料' },
    'auth.bootstrap': { code: 'BOOT', label: '啟動驗證' },
    'app.config': { code: 'CFG', label: 'App 設定' },
    'app.preferences': { code: 'PREF', label: '偏好設定' },
    'app.status': { code: 'STAT', label: '版本與公告' },
    'subscription.status': { code: 'SUBS', label: '訂閱狀態' },
    'subscription.products': { code: 'SPRD', label: '訂閱方案' },
    'subscription.purchase': { code: 'SBUY', label: '購買訂閱' },
    'subscription.restore': { code: 'SRST', label: '恢復購買' },
    'moderation.report': { code: 'MRPT', label: '檢舉內容' },
    'moderation.block': { code: 'MBLK', label: '封鎖使用者' },
    'moderation.sync': { code: 'MSYN', label: '同步封鎖清單' },
    'attachments.tasks': { code: 'ATT', label: '附件下載' },
    'dataExport.import': { code: 'IMPT', label: '資料匯入' },
    'studyTime.record': { code: 'STUD', label: '學習時數回報' },
    'diagnostics.connectivity': { code: 'DIAG', label: '連線診斷' },
    'diagnostics.log': { code: 'DLOG', label: '診斷記錄' },
    'diagnostics.material': { code: 'DMAT', label: '教材來源檢視' },
    unknown: { code: 'APP', label: '未知請求' },
};

/**
 * Ordered most-specific-first: the first pattern that matches wins.
 */
const URL_PATTERNS: ReadonlyArray<[RegExp, string]> = [
    [/^\/api\/courses\/tasks-count/, 'courses.tasksCount'],
    [/^\/api\/courses\/[^/]+\/path/, 'courses.path'],
    [/^\/api\/courses\/[^/]+\/nodes\/[^/]+\/resources/, 'courses.resources'],
    [/^\/api\/courses\/[^/]+\/nodes\/[^/]+\/content/, 'courses.content'],
    [/^\/api\/courses\/[^/]+\/learning-times/, 'courses.learningTimes'],
    [/^\/api\/courses\/[^/]+\/homeworks/, 'courses.homeworks'],
    [/^\/api\/courses\/[^/]+\/self-exams/, 'courses.selfExams'],
    [/^\/api\/courses\/[^/]+\/grade/, 'courses.grade'],
    [/^\/api\/courses\/[^/]+\/last-seen-material/, 'courses.lastSeenMaterial'],
    [/^\/api\/courses\/?$/, 'courses.list'],
    [/^\/api\/courses\//, 'courses.list'],
    [/^\/materials\/content\/parsed/, 'material.parsed'],
    [/^\/api\/playback-progress/, 'playback.progress'],
    [/^\/api\/discuss\/boards/, 'discuss.boards'],
    [/^\/api\/discuss\/nodes/, 'discuss.nodes'],
    [/^\/api\/discuss\/whispers/, 'discuss.whispers'],
    [/^\/api\/discuss\/read/, 'discuss.read'],
    [/^\/api\/discuss\/posts/, 'discuss.posts'],
    [/^\/api\/nou-tools\/live-sessions/, 'nouTools.liveSessions'],
    [/^\/api\/nou-tools\/school-calendar/, 'nouTools.schoolCalendar'],
    [/^\/api\/nou-tools\/course-info/, 'nouTools.courseInfo'],
    [/^\/api\/accounts\/activity/, 'accounts.activity'],
    [/^\/api\/accounts\/[^/]+\/switch/, 'accounts.switch'],
    [/^\/api\/accounts/, 'accounts.list'],
    [/^\/api\/auth\/bootstrap-session/, 'auth.bootstrap'],
    [/^\/api\/auth\/profile/, 'auth.profile'],
    [/^\/login/, 'auth.login'],
    [/^\/logout/, 'auth.logout'],
    [/^\/api\/config/, 'app.config'],
    [/^\/api\/preferences/, 'app.preferences'],
    [/^\/api\/app-status/, 'app.status'],
    [/^\/api\/material-preferences/, 'app.preferences'],
    [/^\/api\/subscription\/status/, 'subscription.status'],
    [/^\/api\/subscription\/products/, 'subscription.products'],
    [/^\/api\/subscription\/purchase/, 'subscription.purchase'],
    [/^\/api\/subscription\/restore/, 'subscription.restore'],
    [/^\/api\/moderation\/report/, 'moderation.report'],
    [/^\/api\/moderation\/block/, 'moderation.block'],
    [/^\/api\/moderation\/sync/, 'moderation.sync'],
    [/^\/api\/moderation\/blocked-users/, 'moderation.block'],
    [/^\/api\/attachments/, 'attachments.tasks'],
    [/^\/api\/data-export/, 'dataExport.import'],
    [/^\/study-time/, 'studyTime.record'],
    [/^\/api\/diagnostics\/connectivity/, 'diagnostics.connectivity'],
    [/^\/api\/diagnostics\/log/, 'diagnostics.log'],
    [/^\/api\/diagnostics\/material/, 'diagnostics.material'],
];

export function resolveOperationKey(url: string, explicit?: string): string {
    if (explicit && explicit in OPERATIONS) {
        return explicit;
    }

    const path = pathOf(url);

    for (const [pattern, key] of URL_PATTERNS) {
        if (pattern.test(path)) {
            return key;
        }
    }

    return 'unknown';
}

export function operationFor(key: string): Operation {
    return OPERATIONS[key] ?? OPERATIONS.unknown;
}

function pathOf(url: string): string {
    const withoutQuery = url.split('?')[0] ?? url;

    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}
