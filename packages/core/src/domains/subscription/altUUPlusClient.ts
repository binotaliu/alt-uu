import { httpBuildQuery } from '../../http/encoding';
import { HttpTransport, type UpstreamCallListener } from '../../http/transport';
import type { Fetch } from '../../platform';
import type { SubscriptionConfig } from './config';
import type { IapServerResponse } from './types';

/**
 * Port of legacy AltUUPlusClient. Both calls return null whenever the backend
 * cannot give a definitive answer (offline, timeout, non-2xx); callers must
 * treat that as "unknown", never as "not subscribed".
 */
export class AltUUPlusClient {
  private readonly transport: HttpTransport;

  constructor(
    private readonly config: SubscriptionConfig,
    deps: { fetch: Fetch; onUpstreamCall?: UpstreamCallListener },
  ) {
    this.transport = new HttpTransport({
      fetch: deps.fetch,
      service: 'iap',
      timeoutMs: config.timeoutSeconds * 1000,
      onUpstreamCall: deps.onUpstreamCall,
    });
  }

  verify(
    platform: string,
    reference: Record<string, unknown>,
  ): Promise<IapServerResponse | null> {
    return this.call({
      method: 'POST',
      url: `${this.config.baseUrl}/api/iap/verify`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ platform, ...reference }),
    });
  }

  entitlement(
    platform: string,
    reference: Record<string, unknown>,
  ): Promise<IapServerResponse | null> {
    const query = httpBuildQuery({
      platform,
      ...(reference as Record<string, string>),
    });

    return this.call({
      method: 'GET',
      url: `${this.config.baseUrl}/api/iap/entitlement?${query}`,
      headers: { accept: 'application/json' },
    });
  }

  private async call(request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<IapServerResponse | null> {
    try {
      const response = await this.transport.send(request);

      if (response.status < 200 || response.status >= 300) {
        return null;
      }

      const decoded: unknown = JSON.parse(response.body);

      return typeof decoded === 'object' && decoded !== null
        ? (decoded as IapServerResponse)
        : null;
    } catch {
      return null;
    }
  }
}
