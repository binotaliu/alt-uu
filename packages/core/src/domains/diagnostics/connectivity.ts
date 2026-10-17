import { UserFacingHttpError } from '../../errors/errors';
import type { Clock, Fetch } from '../../platform';
import type { ConnectivityUrls } from './config';
import type { UpstreamRecordingSwitch } from './recordingSwitch';
import {
    CONNECTIVITY_SERVICES,
    connectivityServiceLabels,
    isReferenceService,
    type ConnectivityCheckResultViewModel,
    type ConnectivityService,
    type ConnectivityServiceListViewModel,
} from './types';

const PROBE_TIMEOUT_SECONDS = 5;

export interface ConnectivityCheckerDeps {
    fetch: Fetch;
    urls: ConnectivityUrls;
    clock: Clock;
    /** Probe failures ARE the result, so they are kept out of the event log. */
    recordingSwitch?: UpstreamRecordingSwitch;
    /** Monotonic-ish milliseconds, injectable for tests. */
    nowMs?: () => number;
}

/**
 * Ports legacy ListConnectivityServices / RunConnectivityCheck and the seven
 * `*ReachabilityCheck` classes (all a GET of a base URL; 4xx still counts as
 * reachable, 5xx and connection failures do not).
 */
export class ConnectivityChecker {
    private readonly nowMs: () => number;

    constructor(private readonly deps: ConnectivityCheckerDeps) {
        this.nowMs = deps.nowMs ?? Date.now;
    }

    listServices(): ConnectivityServiceListViewModel {
        return {
            services: CONNECTIVITY_SERVICES.map((service) => ({
                service,
                label: connectivityServiceLabels[service],
                isReference: isReferenceService(service),
            })),
        };
    }

    check(service: string): Promise<ConnectivityCheckResultViewModel> {
        if (!isConnectivityService(service)) {
            throw new UserFacingHttpError(404, '找不到此服務');
        }

        const probe = (): Promise<ConnectivityCheckResultViewModel> =>
            this.probe(
                service,
                this.urlFor(service),
                this.timeoutSecondsFor(service),
            );

        return this.deps.recordingSwitch === undefined
            ? probe()
            : this.deps.recordingSwitch.withoutRecording(probe);
    }

    private urlFor(service: ConnectivityService): string {
        const { urls } = this.deps;

        switch (service) {
            case 'hungu':
                return urls.hungu;
            case 'school_portal':
                return urls.schoolPortal;
            case 'nou_tools':
                return urls.nouTools;
            case 'iap':
                return urls.iap;
            case 'google':
                return urls.google;
            case 'cloudflare':
                return urls.cloudflare;
            case 'apple':
                return urls.apple;
        }
    }

    private timeoutSecondsFor(service: ConnectivityService): number {
        return service === 'iap'
            ? Math.min(PROBE_TIMEOUT_SECONDS, this.deps.urls.iapTimeoutSeconds)
            : PROBE_TIMEOUT_SECONDS;
    }

    private async probe(
        service: ConnectivityService,
        url: string,
        timeoutSeconds: number,
    ): Promise<ConnectivityCheckResultViewModel> {
        const startedAt = this.nowMs();
        const controller = new AbortController();
        const timer = setTimeout(
            () => controller.abort(),
            timeoutSeconds * 1000,
        );
        const result = (
            fields: Pick<
                ConnectivityCheckResultViewModel,
                'reachable' | 'statusCode' | 'error'
            >,
        ): ConnectivityCheckResultViewModel => ({
            service,
            label: connectivityServiceLabels[service],
            checkKind: 'reachability',
            latencyMs: Math.round(this.nowMs() - startedAt),
            checkedAt: this.deps.clock.now().toISOString(),
            ...fields,
        });

        try {
            const response = await this.deps.fetch(url, {
                method: 'GET',
                signal: controller.signal,
            });

            return result({
                reachable: response.status < 500,
                statusCode: response.status,
                error: null,
            });
        } catch (error) {
            return result({
                reachable: false,
                statusCode: null,
                error:
                    error instanceof Error ? error.message : '無法連線至服務',
            });
        } finally {
            clearTimeout(timer);
        }
    }
}

export function isConnectivityService(
    value: string,
): value is ConnectivityService {
    return (CONNECTIVITY_SERVICES as readonly string[]).includes(value);
}
