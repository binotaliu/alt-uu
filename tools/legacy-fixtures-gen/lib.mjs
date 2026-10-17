import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const LEGACY_TESTS = path.join(
    process.env.LEGACY_DIR ?? path.resolve(HERE, '../../../alt-uu-legacy'),
    'tests',
);
export const OUT = path.resolve(HERE, '../../packages/core/test/fixtures');
export const registry = [];
export const phpCases = [];

/** Read a heredoc/nowdoc body from a legacy test; `line` is the 1-based line containing `<<<`. */
export function hd(file, line) {
    const lines = fs.readFileSync(path.join(LEGACY_TESTS, file), 'utf8').split('\n');
    const body = [];
    let i = line; // index of the next line (0-based = line)
    let closeIndent = 0;
    for (; i < lines.length; i++) {
        const m = lines[i].match(/^(\s*)(HTML|XML)\b/);
        if (m) {
            closeIndent = m[1].length;
            break;
        }
        body.push(lines[i]);
    }
    return body.map((l) => l.slice(Math.min(closeIndent, l.length - l.trimStart().length))).join('\n');
}

export function write(domain, name, ext, content) {
    const dir = path.join(OUT, domain);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}.${ext}`);
    fs.writeFileSync(file, typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content, null, 4) + '\n');
}

/**
 * Register a fixture: writes input file (optional) + <name>.expected.json and records README metadata.
 * expected.json envelope: { source, phpClass, cases: [{ name, input?, expected, partial? }] }
 */
export function fixture(o) {
    if (o.input !== undefined) write(o.domain, o.name, o.ext, o.input);
    for (const i of o.inputs ?? []) write(o.domain, `${o.name}.${i.suffix}`, i.ext, i.content);
    if (o.cases) {
        write(o.domain, `${o.name}.expected`, 'json', { source: o.source, phpClass: o.cls, ...(o.note ? { note: o.note } : {}), cases: o.cases });
    }
    registry.push({
        domain: o.domain,
        name: o.name,
        files: [o.input !== undefined ? `${o.name}.${o.ext}` : null, ...(o.inputs ?? []).map((i) => `${o.name}.${i.suffix}.${i.ext}`), o.cases ? `${o.name}.expected.json` : null, o.golden ? `${o.name}.golden.json` : null].filter(Boolean),
        source: o.source,
        cls: o.cls,
        note: o.note ?? '',
    });
    if (o.golden) phpCases.push({ domain: o.domain, name: o.name, cls: o.cls, ...o.golden });
}
