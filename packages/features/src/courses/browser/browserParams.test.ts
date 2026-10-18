import { encodeFormBody, parseBrowserParams } from './browserParams';

describe('parseBrowserParams', () => {
    it('accepts a plain http(s) url', () => {
        expect(
            parseBrowserParams({ url: 'https://uu.nou.edu.tw/x?a=1' }),
        ).toEqual({
            ok: true,
            request: {
                url: 'https://uu.nou.edu.tw/x?a=1',
                method: 'GET',
                postForm: {},
                cssPreset: null,
            },
        });
    });

    it('parses POST forms and the css preset', () => {
        const result = parseBrowserParams({
            url: 'https://uu.nou.edu.tw/post',
            method: 'post',
            postForm: JSON.stringify({
                b: 'x y',
                a: 2,
                skip: { nested: true },
            }),
            css: 'homework',
        });

        expect(result).toEqual({
            ok: true,
            request: {
                url: 'https://uu.nou.edu.tw/post',
                method: 'POST',
                postForm: { b: 'x y', a: '2' },
                cssPreset: 'homework',
            },
        });
    });

    it('falls back to GET for an empty or broken POST form', () => {
        for (const postForm of ['{}', 'not json', '[1]', undefined]) {
            const result = parseBrowserParams({
                url: 'https://a.test/',
                method: 'POST',
                postForm,
            });

            expect(result.ok && result.request.method).toBe('GET');
        }
    });

    it('ignores unknown css presets and takes the first of repeated params', () => {
        const result = parseBrowserParams({
            url: ['https://a.test/1', 'https://a.test/2'],
            css: 'evil',
        });

        expect(result.ok && result.request).toMatchObject({
            url: 'https://a.test/1',
            cssPreset: null,
        });
    });

    it.each([
        undefined,
        '',
        '  ',
        'javascript:alert(1)',
        'file:///etc/passwd',
        'tronclass://x',
    ])('rejects %p', (url) => {
        expect(parseBrowserParams({ url }).ok).toBe(false);
    });
});

describe('encodeFormBody', () => {
    it('sorts keys and form-encodes values like the legacy bridge', () => {
        expect(encodeFormBody({ b: 'a b', a: '中&=' })).toBe(
            'a=%E4%B8%AD%26%3D&b=a+b',
        );
    });
});
