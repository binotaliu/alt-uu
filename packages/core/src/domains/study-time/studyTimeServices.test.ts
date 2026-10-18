import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { loadExpected, loadFixtureJson } from '../../../test/fixtures';
import { accountDailyActivities, playbackProgress } from '../../db/schema';
import type { FakeReply } from '../../http/testing';
import { createHarness } from '../account/testing';
import { ValidationError } from '../account/validation';
import { createStudyTimeServices, taipeiDateString } from './index';

interface UpstreamReply {
  status?: number;
  headers?: Record<string, string>;
  body?: object;
}

type UpstreamFixture = Record<
  string,
  object | UpstreamReply | Array<object | UpstreamReply>
>;

interface StudyFixture {
  request?: Record<string, unknown>;
  requests?: Array<Record<string, unknown>>;
  session?: Record<string, unknown>;
  upstream: UpstreamFixture;
}

function toReply(entry: object | UpstreamReply): FakeReply {
  if ('body' in entry && ('status' in entry || 'headers' in entry)) {
    const reply = entry as UpstreamReply;

    return {
      status: reply.status,
      body: reply.body,
      setCookies:
        reply.headers?.['Set-Cookie'] === undefined
          ? []
          : [reply.headers['Set-Cookie']],
    };
  }

  return { body: entry };
}

async function setup(fixtureName: string) {
  const fixture = loadFixtureJson<StudyFixture>('study-time', fixtureName);
  const serverTime = fixture.upstream['get-server-time'];
  const upload = fixture.upstream['set-read-node-history'];
  const harness = await createHarness([
    [
      'https://uu.nou.edu.tw/xmlapi/index.php?action=get-server-time*',
      toReply(serverTime as object),
    ],
    [
      'https://uu.nou.edu.tw/xmlapi/index.php?action=set-read-node-history*',
      Array.isArray(upload) ? upload.map(toReply) : toReply(upload),
    ],
  ]);
  const accountId = await harness.credentials.upsert({
    username: 's123',
    password: 'p',
  });
  const session = fixture.session ?? {
    base_url: 'https://uu.nou.edu.tw',
    ua: 'test-agent',
    ticket: 'ticket-1',
    session_idx: 'idx-1',
    cookies: { WM: 'cookie' },
  };
  await harness.hunguSessions.put(
    {
      baseUrl: session.base_url as string,
      userAgent: session.ua as string,
      ticket: session.ticket as string,
      session_idx: session.session_idx as string,
      cookies: session.cookies as Record<string, string>,
    },
    accountId,
  );
  const onStudyTimeRecorded = vi.fn();
  const studyTime = createStudyTimeServices({
    db: harness.db,
    activeProfile: harness.activeProfile,
    studyTime: harness.studyTime,
    clock: harness.clock,
    onStudyTimeRecorded,
  });

  return { fixture, harness, accountId, studyTime, onStudyTimeRecorded };
}

function uploadRequests(harness: Awaited<ReturnType<typeof createHarness>>) {
  return harness.requests.filter((request) =>
    request.url.includes('action=set-read-node-history'),
  );
}

// Ported from tests/Feature/StudyTime/StudyTimeTest.php
describe('RecordStudyTime', () => {
  it('uploads reading time and stores playback progress (upload-success)', async () => {
    const { fixture, harness, accountId, studyTime, onStudyTimeRecorded } =
      await setup('upload-success');
    const expected = loadExpected('study-time', 'upload-success').cases[0]
      .expected as {
      response: unknown;
      playbackProgressRow: Record<string, unknown>;
      upstreamUpload: {
        contentType: string;
        form: Record<string, string>;
      };
    };

    const result = await studyTime.record(fixture.request as never);

    expect(result).toMatchObject(expected.response as object);
    expect(onStudyTimeRecorded).toHaveBeenCalledWith({
      accountId,
      cid: '1001',
      activityId: 'N-1',
      seconds: 120,
    });

    const [row] = await harness.db
      .select()
      .from(playbackProgress)
      .where(eq(playbackProgress.accountId, accountId));
    expect(row).toMatchObject({
      cid: expected.playbackProgressRow.cid,
      activityId: expected.playbackProgressRow.activity_id,
      durationSeconds: expected.playbackProgressRow.duration_seconds,
      positionSeconds: expected.playbackProgressRow.position_seconds,
      mediaDurationSeconds: expected.playbackProgressRow.media_duration_seconds,
      hunguUploadSuccess: expected.playbackProgressRow.hungu_upload_success,
    });

    const [upload] = uploadRequests(harness);
    expect(upload.headers['content-type']).toContain(
      expected.upstreamUpload.contentType,
    );
    expect(Object.fromEntries(new URLSearchParams(upload.body ?? ''))).toEqual(
      expected.upstreamUpload.form,
    );
  });

  it('accumulates seconds into the daily activity log across multiple sessions', async () => {
    const { fixture, harness, accountId, studyTime } = await setup(
      'daily-activity-accumulates',
    );

    for (const request of fixture.requests ?? []) {
      await studyTime.record(request as never);
    }

    const [row] = await harness.db
      .select()
      .from(accountDailyActivities)
      .where(eq(accountDailyActivities.accountId, accountId));
    expect(row.activityDate).toBe(taipeiDateString(harness.clock.now()));
    expect(row.totalSeconds).toBe(210);
  });

  it('retries the upload with et when the first attempt fails', async () => {
    const { fixture, harness, studyTime, onStudyTimeRecorded } = await setup(
      'upload-retry-with-et',
    );
    const expected = loadExpected('study-time', 'upload-retry-with-et').cases[0]
      .expected as {
      response: object;
      firstUploadForm: Record<string, string>;
      secondUploadFormHasKeys: string[];
    };

    const result = await studyTime.record(fixture.request as never);

    expect(result).toMatchObject(expected.response);
    const requests = uploadRequests(harness);
    expect(requests).toHaveLength(2);
    expect(
      Object.fromEntries(new URLSearchParams(requests[0].body ?? '')),
    ).toEqual(expected.firstUploadForm);
    expect(
      Object.keys(
        Object.fromEntries(new URLSearchParams(requests[1].body ?? '')),
      ).sort(),
    ).toEqual([...expected.secondUploadFormHasKeys].sort());
    // `et` is the current Asia/Taipei time.
    expect(new URLSearchParams(requests[1].body ?? '').get('et')).toBe(
      '2026-10-01 08:00:00',
    );
    expect(onStudyTimeRecorded).toHaveBeenCalledOnce();
  });

  it('uses the rotated hungu cookie for the upload that follows', async () => {
    const { fixture, harness, studyTime } = await setup('rotated-cookie-reuse');
    const expected = loadExpected('study-time', 'rotated-cookie-reuse').cases[0]
      .expected as {
      uploadRequestCookieHeaderContains: string;
      uploadRequestCookieHeaderNotContains: string;
    };

    const result = await studyTime.record(fixture.request as never);

    expect(result.ok).toBe(true);
    const cookie = uploadRequests(harness)[0].headers.cookie;
    expect(cookie).toContain(expected.uploadRequestCookieHeaderContains);
    expect(cookie).not.toContain(expected.uploadRequestCookieHeaderNotContains);
  });

  it('records a failed upload without firing the recorded hook', async () => {
    const harness = await createHarness([
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-server-time*',
        {
          body: {
            code: 0,
            data: { server_time: '2026-03-14 10:00:00' },
          },
        },
      ],
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=set-read-node-history*',
        { body: { code: 500, message: 'failed' } },
      ],
    ]);
    const accountId = await harness.seedAccount('s1', 'x', true);
    await harness.hunguSessions.put(
      {
        baseUrl: 'https://uu.nou.edu.tw',
        userAgent: 'ua',
        cookies: {},
        ticket: 't',
      },
      accountId,
    );
    const onStudyTimeRecorded = vi.fn();
    const studyTime = createStudyTimeServices({
      db: harness.db,
      activeProfile: harness.activeProfile,
      studyTime: harness.studyTime,
      clock: harness.clock,
      onStudyTimeRecorded,
    });

    const result = await studyTime.record({
      cid: '1',
      activityId: 'N-1',
      url: 'https://uu.nou.edu.tw/m.html',
      seconds: 30,
    });

    expect(result).toEqual({ ok: false, seconds: 30, message: 'failed' });
    expect(onStudyTimeRecorded).not.toHaveBeenCalled();
    const [row] = await harness.db.select().from(playbackProgress);
    expect(row.hunguUploadSuccess).toBe(false);
  });

  it('derives seconds from startedAt and clamps to the allowed range', async () => {
    const { harness, studyTime } = await setup('upload-success');

    const startedAt = new Date(
      harness.clock.now().getTime() - 90_000,
    ).toISOString();
    const result = await studyTime.record({
      cid: '1001',
      activityId: 'N-9',
      url: 'https://uu.nou.edu.tw/material/x.html',
      startedAt,
    });

    // The fake upstream answers `data.seconds = 120`, but the st offset follows the derived 90 s.
    expect(result.seconds).toBe(120);
    expect(
      new URLSearchParams(uploadRequests(harness)[0].body ?? '').get('st'),
    ).toBe('2026-03-14 09:58:30');
  });

  it('rejects invalid input', async () => {
    const { studyTime } = await setup('upload-success');

    await expect(
      studyTime.record({ cid: '', activityId: 'N-1', url: 'nope' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      studyTime.record({
        cid: '1',
        activityId: 'N-1',
        url: 'https://uu.nou.edu.tw/a',
        seconds: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      studyTime.record({
        cid: '1',
        activityId: 'N-1',
        url: 'https://uu.nou.edu.tw/a',
        mediaDurationSeconds: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
