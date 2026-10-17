import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, CredentialCipher } from '../../src/db';
import { createTestContext, MemorySecureStorage } from './helpers';

describe('CredentialCipher', () => {
    it('roundtrips text and JSON', async () => {
        const { cipher } = await createTestContext();

        const sealed = await cipher.encrypt('密碼-secret', 'p');

        expect(sealed.startsWith('v1:')).toBe(true);
        expect(sealed).not.toContain('secret');
        expect(await cipher.decrypt(sealed, 'p')).toBe('密碼-secret');

        const json = await cipher.encryptJson({ a: [1, 2] }, 'p');
        expect(await cipher.decryptJson(json, 'p')).toEqual({ a: [1, 2] });
    });

    it('uses a fresh nonce per encryption', async () => {
        const { cipher } = await createTestContext();

        expect(await cipher.encrypt('x', 'p')).not.toBe(
            await cipher.encrypt('x', 'p'),
        );
    });

    it('persists one 256-bit data key in secure storage', async () => {
        const { cipher, secureStorage } = await createTestContext();

        await Promise.all([cipher.encrypt('a', 'p'), cipher.encrypt('b', 'p')]);

        expect(secureStorage.items.size).toBe(1);
        const [stored] = [...secureStorage.items.values()];
        expect(base64ToBytes(stored)).toHaveLength(32);

        const sibling = new CredentialCipher(secureStorage, {
            getRandomBytes: () => {
                throw new Error('key must be reused');
            },
        });
        const sealed = await cipher.encrypt('shared', 'p');
        expect(await sibling.decrypt(sealed, 'p')).toBe('shared');
    });

    it('rejects tampering, wrong purpose and wrong key', async () => {
        const { cipher } = await createTestContext();
        const other = (await createTestContext()).cipher;
        const sealed = await cipher.encrypt('secret', 'password');

        await expect(cipher.decrypt(sealed, 'session')).rejects.toThrow();
        await expect(other.decrypt(sealed, 'password')).rejects.toThrow();

        const bytes = base64ToBytes(sealed.slice(3));
        bytes[bytes.length - 1] ^= 1;
        await expect(
            cipher.decrypt(`v1:${bytesToBase64(bytes)}`, 'password'),
        ).rejects.toThrow();
        await expect(cipher.decrypt('plain', 'password')).rejects.toThrow();
    });

    it('base64 helpers roundtrip every padding length', () => {
        for (const length of [0, 1, 2, 3, 4, 31, 32]) {
            const bytes = Uint8Array.from({ length }, (_, i) => i * 7 + 1);
            const encoded = bytesToBase64(bytes);
            expect(encoded).toBe(Buffer.from(bytes).toString('base64'));
            expect(base64ToBytes(encoded)).toEqual(bytes);
        }
    });

    it('keeps the unused storage empty until first use', async () => {
        const storage = new MemorySecureStorage();
        new CredentialCipher(storage, {
            getRandomBytes: () => new Uint8Array(),
        });
        expect(storage.items.size).toBe(0);
    });
});
