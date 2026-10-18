/* eslint-disable @typescript-eslint/no-require-imports */
import {
  ACTIVE_MATERIAL_SESSION_KEY,
  parseActiveMaterialSession,
  pendingStudyTimeInput,
  type ActiveMaterialSession,
} from './activeMaterialSession';
import { recoverActiveMaterialSession } from './ActiveMaterialRestorePrompt';

jest.mock('@altuu/attachment-bridge', () =>
  require('@altuu/attachment-bridge/mock'),
);

const session: ActiveMaterialSession = {
  accountId: 7,
  routePath: '/courses/C1/S1',
  cid: 'C1',
  activityId: 'S1',
  href: 'https://uu.nou.edu.tw/m/s1.htm',
  startedAt: '2026-10-18T02:00:00.000Z',
  lastActiveAt: '2026-10-18T02:10:00.000Z',
  positionSeconds: 590,
  mediaDurationSeconds: 1800,
  wasPlaying: true,
  materialName: '第一講',
  courseName: '心理學',
};

function memoryStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    values,
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => {
      values.set(key, value);
    },
    delete: async (key: string) => {
      values.delete(key);
    },
  };
}

function fakeRuntime(
  stored: ActiveMaterialSession | null,
  activeAccountId: number | null = 7,
) {
  const keyValues = memoryStore(
    stored === null
      ? {}
      : { [ACTIVE_MATERIAL_SESSION_KEY]: JSON.stringify(stored) },
  );
  const record = jest.fn(async () => ({
    ok: true,
    seconds: 600,
    message: null,
  }));
  const runtime = {
    services: {
      storage: {
        keyValues,
        activeProfile: { get: async () => activeAccountId },
      },
      studyTime: { record },
    },
    run: <T>(_op: string, work: () => Promise<T> | T) =>
      Promise.resolve(work()),
  };

  return { runtime: runtime as never, record, keyValues };
}

describe('active material session', () => {
  it('round-trips and rejects malformed data', () => {
    expect(parseActiveMaterialSession(JSON.stringify(session))).toEqual(
      session,
    );
    expect(parseActiveMaterialSession(null)).toBeNull();
    expect(parseActiveMaterialSession('{')).toBeNull();
    expect(
      parseActiveMaterialSession(
        JSON.stringify({ ...session, routePath: 'courses' }),
      ),
    ).toBeNull();
    expect(
      parseActiveMaterialSession(
        JSON.stringify({ ...session, startedAt: 'never' }),
      ),
    ).toBeNull();
  });

  it('owes the study time up to the last checkpoint', () => {
    expect(pendingStudyTimeInput(session)).toEqual({
      cid: 'C1',
      activityId: 'S1',
      url: 'https://uu.nou.edu.tw/m/s1.htm',
      seconds: 600,
      startedAt: '2026-10-18T02:00:00.000Z',
      positionSeconds: 590,
      mediaDurationSeconds: 1800,
    });
    expect(
      pendingStudyTimeInput({
        ...session,
        lastActiveAt: '2026-10-18T02:00:02.000Z',
      }),
    ).toBeNull();
  });

  it('reports the interrupted visit and offers to return when media played', async () => {
    const { runtime, record, keyValues } = fakeRuntime(session);

    await expect(recoverActiveMaterialSession(runtime)).resolves.toEqual(
      session,
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        cid: 'C1',
        activityId: 'S1',
        seconds: 600,
      }),
    );
    expect(keyValues.values.size).toBe(0);
  });

  it('does not offer to return when nothing was playing', async () => {
    const { runtime, record } = fakeRuntime({
      ...session,
      wasPlaying: false,
    });

    await expect(recoverActiveMaterialSession(runtime)).resolves.toBeNull();
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('drops a visit of another account', async () => {
    const { runtime, record, keyValues } = fakeRuntime(session, 8);

    await expect(recoverActiveMaterialSession(runtime)).resolves.toBeNull();
    expect(record).not.toHaveBeenCalled();
    expect(keyValues.values.size).toBe(0);
  });

  it('does nothing without a stored visit', async () => {
    const { runtime, record } = fakeRuntime(null);

    await expect(recoverActiveMaterialSession(runtime)).resolves.toBeNull();
    expect(record).not.toHaveBeenCalled();
  });
});
