/**
 * Port of legacy UpstreamRecordingSwitch: lets a caller opt out of
 * upstream-call recording while a callback runs. The connectivity probes use
 * it, since their failures ARE the diagnostic result.
 *
 * Counter based so overlapping callbacks do not re-enable recording early.
 * Recording of unrelated calls that overlap a suppressed callback is skipped
 * too, which is acceptable for short probes.
 */
export class UpstreamRecordingSwitch {
  private depth = 0;

  async withoutRecording<T>(callback: () => Promise<T> | T): Promise<T> {
    this.depth += 1;

    try {
      return await callback();
    } finally {
      this.depth -= 1;
    }
  }

  isSuppressed(): boolean {
    return this.depth > 0;
  }
}
