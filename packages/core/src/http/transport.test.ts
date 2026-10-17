import { describe, expect, it } from 'vitest';

import { ExternalServiceUnavailableError } from '../errors/errors';
import type { Fetch } from '../platform';
import { createFakeFetch } from './testing';
import { HttpTransport, type UpstreamCallEvent } from './transport';
import { resolveUrl } from './url';

describe('HttpTransport', () => {
    it('always asks the platform for manual redirects and follows them in JS', async () => {
        const { fetch, requests } = createFakeFetch([
            [
                'https://a.test/start',
                {
                    status: 302,
                    headers: { location: '/next' },
                    setCookies: ['hop=1; path=/'],
                },
            ],
            ['https://a.test/next', { body: 'done', setCookies: ['final=2'] }],
        ]);
        const transport = new HttpTransport({ fetch, service: 'test' });

        const response = await transport.send({
            method: 'GET',
            url: 'https://a.test/start',
            cookies: { sid: 'x' },
        });

        expect(response.status).toBe(200);
        expect(response.body).toBe('done');
        expect(response.url).toBe('https://a.test/next');
        expect(response.redirectCount).toBe(1);
        expect(response.setCookies).toEqual(['hop=1; path=/', 'final=2']);
        expect(requests.map((request) => request.redirect)).toEqual([
            'manual',
            'manual',
        ]);
        expect(requests[0].headers.cookie).toBe('sid=x');
        // A cookie set on the redirect is sent to the next hop, like a browser.
        expect(requests[1].headers.cookie).toBe('sid=x; hop=1');
    });

    it('rewrites a redirected POST to a body-less GET (Guzzle strict=false)', async () => {
        const { fetch, requests } = createFakeFetch([
            [
                'https://a.test/form',
                { status: 302, headers: { location: 'https://a.test/done' } },
            ],
            ['https://a.test/done', { body: 'ok' }],
        ]);

        await new HttpTransport({ fetch, service: 'test' }).send({
            method: 'POST',
            url: 'https://a.test/form',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'a=1',
        });

        expect(requests[1]).toMatchObject({ method: 'GET', body: null });
        expect(requests[1].headers['content-type']).toBeUndefined();
    });

    it('keeps the method and body on 307', async () => {
        const { fetch, requests } = createFakeFetch([
            [
                'https://a.test/form',
                { status: 307, headers: { location: '/again' } },
            ],
            ['https://a.test/again', { body: 'ok' }],
        ]);

        await new HttpTransport({ fetch, service: 'test' }).send({
            method: 'POST',
            url: 'https://a.test/form',
            body: 'a=1',
        });

        expect(requests[1]).toMatchObject({ method: 'POST', body: 'a=1' });
    });

    it('never sends the cookie jar to another host and ignores its Set-Cookie', async () => {
        const { fetch, requests } = createFakeFetch([
            [
                'https://a.test/out',
                { status: 302, headers: { location: 'https://cdn.test/file' } },
            ],
            ['https://cdn.test/file', { body: 'bytes', setCookies: ['cdn=1'] }],
        ]);

        const response = await new HttpTransport({
            fetch,
            service: 'test',
        }).send({
            method: 'GET',
            url: 'https://a.test/out',
            cookies: { sid: 'secret' },
        });

        expect(requests[1].headers.cookie).toBeUndefined();
        expect(response.setCookies).toEqual([]);
    });

    it('returns the 3xx itself when redirects are disabled', async () => {
        const { fetch, requests } = createFakeFetch([
            [
                'https://a.test/login',
                {
                    status: 302,
                    headers: { location: '/home' },
                    setCookies: ['JSESSIONID=post'],
                },
            ],
        ]);

        const response = await new HttpTransport({
            fetch,
            service: 'test',
        }).send({
            method: 'POST',
            url: 'https://a.test/login',
            followRedirects: false,
        });

        expect(response.status).toBe(302);
        expect(response.setCookies).toEqual(['JSESSIONID=post']);
        expect(requests).toHaveLength(1);
    });

    it('stops after five redirects like Guzzle', async () => {
        const { fetch, requests } = createFakeFetch([
            [
                'https://a.test/loop',
                () => ({ status: 302, headers: { location: '/loop' } }),
            ],
        ]);

        const response = await new HttpTransport({
            fetch,
            service: 'test',
        }).send({
            method: 'GET',
            url: 'https://a.test/loop',
        });

        expect(requests).toHaveLength(6);
        expect(response.status).toBe(302);
    });

    it('maps connection failures to ExternalServiceUnavailableError and reports them', async () => {
        const events: UpstreamCallEvent[] = [];
        const { fetch } = createFakeFetch([
            ['*', new TypeError('Network request failed')],
        ]);
        const transport = new HttpTransport({
            fetch,
            service: 'hungu',
            onUpstreamCall: (event) => events.push(event),
            now: () => 1000,
        });

        const error = await transport
            .send({ method: 'get', url: 'https://uu.test/x' })
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ExternalServiceUnavailableError);
        expect((error as Error).message).toBe(
            '外部服務暫時無法連線，請稍後再試。',
        );
        expect(events).toEqual([
            {
                service: 'hungu',
                method: 'GET',
                url: 'https://uu.test/x',
                host: 'uu.test',
                status: null,
                durationMs: 0,
                expectsJson: true,
                body: null,
                redirectCount: 0,
                error: { name: 'TypeError', message: 'Network request failed' },
            },
        ]);
    });

    it('aborts after the timeout', async () => {
        const hanging: Fetch = (_url, init) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () =>
                    reject(new Error('aborted')),
                );
            });

        await expect(
            new HttpTransport({
                fetch: hanging,
                service: 'test',
                timeoutMs: 5,
            }).send({
                method: 'GET',
                url: 'https://a.test/slow',
            }),
        ).rejects.toBeInstanceOf(ExternalServiceUnavailableError);
    });

    it('reports successful calls with status, body and timing', async () => {
        const events: UpstreamCallEvent[] = [];
        let clock = 0;
        const { fetch } = createFakeFetch([
            [
                '*',
                () => {
                    clock += 42;

                    return { status: 500, body: 'boom' };
                },
            ],
        ]);

        await new HttpTransport({
            fetch,
            service: 'school-portal',
            onUpstreamCall: (event) => events.push(event),
            now: () => clock,
        }).send({
            method: 'GET',
            url: 'https://p.test/page',
            expectsJson: false,
        });

        expect(events[0]).toMatchObject({
            status: 500,
            body: 'boom',
            durationMs: 42,
            expectsJson: false,
            error: null,
        });
    });

    it('resolves relative Location headers', () => {
        expect(resolveUrl('/x?y=1', 'https://a.test/a/b?c')).toBe(
            'https://a.test/x?y=1',
        );
        expect(resolveUrl('c.php', 'https://a.test/a/b.php')).toBe(
            'https://a.test/a/c.php',
        );
        expect(resolveUrl('//b.test/z', 'https://a.test/')).toBe(
            'https://b.test/z',
        );
        expect(resolveUrl('https://c.test/', 'https://a.test/')).toBe(
            'https://c.test/',
        );
    });
});
