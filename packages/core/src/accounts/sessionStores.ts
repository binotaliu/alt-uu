import type {
    HunguSession,
    SchoolPortalSession,
    SessionStore,
} from '../session/types';
import {
    EncryptedSessionStore,
    type EncryptedSessionStoreDeps,
} from './encryptedSessionStore';

/** Port of legacy UUSessionStore (`accounts.hungu_session`). */
export class UUSessionStore
    extends EncryptedSessionStore<HunguSession>
    implements SessionStore<HunguSession>
{
    constructor(deps: EncryptedSessionStoreDeps) {
        super(deps, 'hunguSession');
    }
}

/** Port of legacy SchoolPortalSessionStore (`accounts.school_portal_session`). */
export class SchoolPortalSessionStore
    extends EncryptedSessionStore<SchoolPortalSession>
    implements SessionStore<SchoolPortalSession>
{
    constructor(deps: EncryptedSessionStoreDeps) {
        super(deps, 'schoolPortalSession');
    }
}
