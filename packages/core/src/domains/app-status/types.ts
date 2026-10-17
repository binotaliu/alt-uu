export type AnnouncementSeverity = 'info' | 'warning' | 'critical';

/** Legacy AppUpdateViewModel. */
export interface AppUpdate {
    dismissKey: string;
    latestVersion: string;
    storeUrl: string | null;
    required: boolean;
}

/** Legacy AnnouncementViewModel. */
export interface Announcement {
    dismissKey: string;
    severity: AnnouncementSeverity;
    title: string;
    body: string;
    url: string | null;
    dismissible: boolean;
}

/** Legacy AppStatusViewModel. */
export interface AppStatus {
    update: AppUpdate | null;
    announcements: Announcement[];
}

export type AppStatusPlatform = 'ios' | 'android';
