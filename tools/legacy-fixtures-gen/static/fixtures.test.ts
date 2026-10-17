import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listFixtures, loadExpected, loadFixture, loadFixtureBytes, loadGolden } from './index';

const dir = path.dirname(fileURLToPath(import.meta.url));
const domains = fs.readdirSync(dir).filter((entry) => fs.statSync(path.join(dir, entry)).isDirectory());

describe('legacy fixtures integrity', () => {
    it('has every expected domain', () => {
        expect(domains.sort()).toEqual(['app-status', 'course', 'data-portability', 'diagnostics', 'discuss', 'hungu-transport', 'moderation', 'nou-tools', 'school-portal', 'study-time']);
    });

    it.each(domains)('%s: every json file parses and expected/golden files are well-formed', (domain) => {
        for (const file of fs.readdirSync(path.join(dir, domain)).filter((f) => f.endsWith('.json'))) {
            expect(() => JSON.parse(fs.readFileSync(path.join(dir, domain, file), 'utf8')), `${domain}/${file}`).not.toThrow();
        }
        for (const name of listFixtures(domain)) {
            if (fs.existsSync(path.join(dir, domain, `${name}.expected.json`))) {
                const expected = loadExpected(domain, name);
                expect(expected.cases.length, `${domain}/${name}`).toBeGreaterThan(0);
            }
            if (fs.existsSync(path.join(dir, domain, `${name}.golden.json`))) {
                expect(loadGolden(domain, name).cases.length, `${domain}/${name}`).toBeGreaterThan(0);
            }
        }
    });

    it('loads text and binary inputs', () => {
        expect(loadFixture('course', 'parse-material-html-only')).toContain('課程概覽');
        expect(Array.from(loadFixtureBytes('course', 'parse-material-malformed-utf8'))).toContain(0xc3);
    });
});
