import type { AccountId } from '../../session/types';

/** Legacy AccountViewModel. */
export interface AccountViewModel {
  id: AccountId;
  username: string;
  displayName: string;
  nickname: string | null;
  picture: string;
  isActive: boolean;
}

export type AccountOperationResult =
  | { ok: true; message: ''; accounts: AccountViewModel[] }
  | { ok: false; message: string; accounts?: AccountViewModel[] };
