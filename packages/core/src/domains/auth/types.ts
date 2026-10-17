import type { HunguPayload } from '../../hungu';

/** Legacy SessionProfileViewModel. */
export interface SessionProfileViewModel {
    displayName: string | null;
    nickname: string | null;
    picture: string | null;
    username: string | null;
}

export type LoginOutcome =
    { ok: true } | { ok: false; message: string; raw?: HunguPayload };

/** Result of the launch-time session check (legacy BootstrapSessionController). */
export interface BootstrapSessionResult {
    ok: true;
    /** True when a valid HUNGU session (stored or re-established) exists. */
    authenticated: boolean;
    /** Legacy redirect target: `/courses` when signed in, otherwise `/login`. */
    redirect: '/courses' | '/login';
    nouToolsIntegrationEnabled: boolean;
}
