import type { CacheRepository } from '../../db/cache';
import { ExternalServiceUnavailableError } from '../../errors/errors';
import { decodeJson, isRecord } from '../../http/encoding';
import { HttpTransport, type UpstreamCallListener } from '../../http/transport';
import type { Fetch } from '../../platform';

export type JsonObject = Record<string, unknown>;

export const NOU_TOOLS_CACHE_TTL_DAYS = 14;
const SECONDS_PER_DAY = 86_400;
const DEFAULT_BASE_URL = 'https://nou-tools.binota.org';

export interface NouToolsClientConfig {
    /** Default `https://nou-tools.binota.org`. */
    baseUrl?: string;
    /** Default 10 seconds. */
    timeoutMs?: number;
    /** Legacy `Str::slug(app.name)/framework version`. */
    userAgent?: string;
    /** Pause between the two attempts; default 200 ms. */
    retryDelayMs?: number;
}

export interface NouToolsClientDeps {
    fetch: Fetch;
    cache: CacheRepository;
    config?: NouToolsClientConfig;
    sleep?: (milliseconds: number) => Promise<void>;
    /** Diagnostics hook (legacy UpstreamCallSubscriber covered NouToolsClient). */
    onUpstreamCall?: UpstreamCallListener;
}

/** Port of the legacy NouToolsClient: cached reads of nou-tools.binota.org. */
export class NouToolsClient {
    private readonly baseUrl: string;
    private readonly retryDelayMs: number;
    private readonly userAgent: string;
    private readonly transport: HttpTransport;

    constructor(private readonly deps: NouToolsClientDeps) {
        const config = deps.config ?? {};
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.retryDelayMs = config.retryDelayMs ?? 200;
        this.transport = new HttpTransport({
            fetch: deps.fetch,
            service: 'nou-tools',
            timeoutMs: config.timeoutMs ?? 10_000,
            onUpstreamCall: deps.onUpstreamCall,
        });
        this.userAgent = config.userAgent ?? 'alt-uu';
    }

    listCourses(term: string): Promise<JsonObject[]> {
        return this.remember(`nou-tools:courses:${term}`, async () => {
            const payload = await this.getJson(
                `/api/v1/courses?term=${encodeURIComponent(term)}`,
            );

            return toRecordList(payload);
        });
    }

    async getCourseDetail(courseId: number): Promise<JsonObject | null> {
        return this.remember<JsonObject | null>(
            `nou-tools:course-detail:${courseId}`,
            async () => {
                const payload = await this.getJson(
                    `/api/v1/courses/${courseId}`,
                );

                return isRecord(payload) ? (payload as JsonObject) : null;
            },
        );
    }

    getSchoolCalendar(): Promise<JsonObject[]> {
        return this.remember('nou-tools:school-calendar:current', async () =>
            toRecordList(await this.getJson('/api/v1/school-calendar')),
        );
    }

    private remember<T>(key: string, load: () => Promise<T>): Promise<T> {
        return this.deps.cache.remember(
            key,
            NOU_TOOLS_CACHE_TTL_DAYS * SECONDS_PER_DAY,
            load,
        );
    }

    /** Decoded body of a successful response, or null on a non-2xx status. */
    private async getJson(path: string): Promise<unknown> {
        const response = await this.sendWithRetry(`${this.baseUrl}${path}`);

        return response.status >= 200 && response.status < 300
            ? decodeJson(response.body)
            : null;
    }

    /** Laravel `retry(2, 200)`: two attempts, retrying only on connection failures. */
    private async sendWithRetry(url: string) {
        const attempts = 2;

        for (let attempt = 1; ; attempt += 1) {
            try {
                return await this.transport.send({
                    method: 'GET',
                    url,
                    headers: {
                        Accept: 'application/json',
                        'User-Agent': this.userAgent,
                    },
                });
            } catch (error) {
                if (
                    !(error instanceof ExternalServiceUnavailableError) ||
                    attempt >= attempts
                ) {
                    throw error;
                }

                await (this.deps.sleep ?? defaultSleep)(this.retryDelayMs);
            }
        }
    }
}

function defaultSleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** `array_values(array_filter($payload, 'is_array'))`; non-arrays become `[]`. */
function toRecordList(payload: unknown): JsonObject[] {
    if (!isRecord(payload)) {
        return [];
    }

    const values = Array.isArray(payload) ? payload : Object.values(payload);

    return values.filter((value): value is JsonObject => isRecord(value));
}
