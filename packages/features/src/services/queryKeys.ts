/**
 * Query keys for the shell-owned queries. Feature areas add their own keys
 * under their own prefix (for example `['courses', ...]`); keep the first
 * element unique per domain so `invalidateQueries({ queryKey: [...] })` stays
 * targeted.
 */
export const queryKeys = {
  accounts: ['accounts'] as const,
  sessionProfile: ['auth', 'profile'] as const,
  appConfig: ['app', 'config'] as const,
  appStatus: ['app', 'status'] as const,
  entitlement: ['subscription', 'entitlement'] as const,
};
