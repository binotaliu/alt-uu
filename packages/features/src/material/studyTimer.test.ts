import {
  MAX_STUDY_SECONDS,
  StudyTimerSession,
  formatDurationLabel,
  formatStudyClock,
} from './studyTimer';

function clock(startIso = '2026-10-18T02:00:00.000Z') {
  let now = Date.parse(startIso);

  return {
    now: () => now,
    advance: (seconds: number) => {
      now += seconds * 1000;
    },
  };
}

describe('formatters', () => {
  it('formats the header clock as mm:ss', () => {
    expect(formatStudyClock(0)).toBe('00:00');
    expect(formatStudyClock(65)).toBe('01:05');
    expect(formatStudyClock(3725)).toBe('62:05');
  });

  it('formats the resume label like legacy', () => {
    expect(formatDurationLabel(7)).toBe('7 秒');
    expect(formatDurationLabel(125)).toBe('2 分 05 秒');
    expect(formatDurationLabel(3723)).toBe('1 時 02 分 03 秒');
  });
});

describe('StudyTimerSession', () => {
  it('does not track materials without href', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(false);
    fake.advance(30);

    expect(session.isTracking).toBe(false);
    expect(session.elapsedSeconds()).toBe(0);
    expect(session.buildPayload('c1', 'a1', 'https://uu/x')).toBeNull();
  });

  it('counts elapsed seconds from the start', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(true);
    fake.advance(42.6);

    expect(session.startedAt).toBe('2026-10-18T02:00:00.000Z');
    expect(session.elapsedSeconds()).toBe(42);
  });

  it('continues from an earlier start time when given', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(true, '2026-10-18T01:59:00.000Z');

    expect(session.elapsedSeconds()).toBe(60);
  });

  it('falls back to now for an invalid start override', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(true, 'not a date');

    expect(session.startedAt).toBe('2026-10-18T02:00:00.000Z');
  });

  it('skips visits shorter than 3 seconds', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(true);
    fake.advance(2);

    expect(session.buildPayload('c1', 'a1', 'https://uu/x')).toBeNull();
  });

  it('builds the record payload with live position and duration', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(true);
    fake.advance(90);

    expect(
      session.buildPayload('c1', 'a1', 'https://uu/x', {
        positionSeconds: 75.5,
        mediaDurationSeconds: 600,
      }),
    ).toEqual({
      cid: 'c1',
      activityId: 'a1',
      url: 'https://uu/x',
      seconds: 90,
      startedAt: '2026-10-18T02:00:00.000Z',
      positionSeconds: 75.5,
      mediaDurationSeconds: 600,
    });
  });

  it('falls back to the last known position when the player reports 0', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(true);
    session.updatePlaybackPosition(120);
    session.updateMediaDuration(900);
    fake.advance(10);

    expect(
      session.buildPayload('c1', 'a1', 'u', {
        positionSeconds: 0,
        mediaDurationSeconds: 0,
      }),
    ).toMatchObject({ positionSeconds: 120, mediaDurationSeconds: 900 });
  });

  it('ignores invalid position and duration updates', () => {
    const session = new StudyTimerSession(clock().now);

    session.updatePlaybackPosition(Number.NaN);
    session.updatePlaybackPosition(-1);
    session.updateMediaDuration(0);
    session.updateMediaDuration(Number.POSITIVE_INFINITY);

    expect(session.lastKnownPlaybackPosition).toBeNull();
    expect(session.lastKnownMediaDuration).toBeNull();
  });

  it('forgets the previous material position when a new one starts', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(true);
    session.updatePlaybackPosition(300);
    session.start(true);
    fake.advance(5);

    expect(session.buildPayload('c1', 'a2', 'u')).not.toHaveProperty(
      'positionSeconds',
    );
  });

  it('clamps very long visits to the service maximum', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(true);
    fake.advance(MAX_STUDY_SECONDS + 500);

    expect(session.buildPayload('c1', 'a1', 'u')?.seconds).toBe(
      MAX_STUDY_SECONDS,
    );
  });

  it('stops tracking once cleared', () => {
    const fake = clock();
    const session = new StudyTimerSession(fake.now);

    session.start(true);
    fake.advance(10);
    session.clear();

    expect(session.isTracking).toBe(false);
    expect(session.buildPayload('c1', 'a1', 'u')).toBeNull();
  });
});
