/** Port of legacy config/school_portal.php. */
export interface SchoolPortalConfig {
    baseUrl: string;
    reviewerUsername: string;
    reviewerBaseUrl: string;
    userAgent: string;
}

export const defaultSchoolPortalConfig: SchoolPortalConfig = {
    baseUrl: 'https://nouapp.nou.edu.tw',
    reviewerUsername: 'reviewer',
    reviewerBaseUrl: 'https://alt-uu-staging.binota.org',
    userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

export function resolveSchoolPortalBaseUrl(
    config: SchoolPortalConfig,
    username: string,
): string {
    if (
        username !== '' &&
        username.trim().startsWith(config.reviewerUsername.trim())
    ) {
        return config.reviewerBaseUrl;
    }

    return config.baseUrl;
}
