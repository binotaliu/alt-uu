export interface OperationContextValue {
  op: string | null;
  requestId: string | null;
}

/**
 * Stand-in for legacy DiagnosticContext (Laravel Context). There is no
 * per-request scope in a single JS runtime, so the UI-initiated operations
 * that are currently running form a stack and the newest one is "current".
 * Upstream calls recorded while an operation runs are attributed to it.
 * With overlapping operations this is a best-effort attribution.
 */
export class OperationContext {
  private readonly active: Array<{
    token: symbol;
    value: OperationContextValue;
  }> = [];

  current(): OperationContextValue {
    return (
      this.active[this.active.length - 1]?.value ?? {
        op: null,
        requestId: null,
      }
    );
  }

  async run<T>(
    value: OperationContextValue,
    callback: () => Promise<T> | T,
  ): Promise<T> {
    const token = Symbol('operation');
    this.active.push({ token, value });

    try {
      return await callback();
    } finally {
      const index = this.active.findIndex((entry) => entry.token === token);

      if (index !== -1) {
        this.active.splice(index, 1);
      }
    }
  }
}
