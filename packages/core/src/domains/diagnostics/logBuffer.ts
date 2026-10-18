import type { LogLevel, Logger } from '../../platform';

export interface LogEntry {
  at: string;
  level: LogLevel;
  message: string;
}

/**
 * Bounded in-memory JS log, standing in for the legacy NativePHP shell log
 * tail in the exported bundle. Implements the core `Logger` platform
 * interface, so the app can route its logger here.
 */
export class JsLogBuffer implements Logger {
  private entries: LogEntry[] = [];

  constructor(
    private readonly capacity = 300,
    private readonly now: () => Date = () => new Date(),
  ) {}

  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    let line = message;

    if (context !== undefined) {
      try {
        line += ` ${JSON.stringify(context)}`;
      } catch {
        // Unserializable context is dropped.
      }
    }

    this.entries.push({
      at: this.now().toISOString(),
      level,
      message: line,
    });

    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
  }

  /** The newest lines, oldest first, capped to `maxCharacters` from the end. */
  tail(maxCharacters: number): string {
    const text = this.entries
      .map((entry) => `${entry.at} [${entry.level}] ${entry.message}`)
      .join('\n');
    const characters = Array.from(text);

    return characters.length > maxCharacters
      ? `…（已截斷）${characters.slice(-maxCharacters).join('')}`
      : text;
  }

  clear(): void {
    this.entries = [];
  }
}
