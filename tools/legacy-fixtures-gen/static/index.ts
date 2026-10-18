/**
 * Test-only helpers for loading the legacy-derived fixtures in this folder.
 * Uses node:fs, so import it from Vitest tests only (never from src/).
 *
 * File naming per fixture `<name>` in `<domain>/`:
 *   <name>.(html|xml|json|txt)   upstream payload (input)
 *   <name>.<suffix>.<ext>        additional inputs for multi-payload fixtures
 *   <name>.expected.json         assertions taken from the legacy Pest test
 *   <name>.golden.json           full output captured from the real PHP app
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES_DIR = path.dirname(fileURLToPath(import.meta.url));
const INPUT_EXTENSIONS = ['html', 'xml', 'json', 'txt'] as const;

/** One asserted scenario from a legacy Pest test. */
export interface ExpectedCase {
    name: string;
    /** Call arguments / scenario context, free-form per fixture. */
    input?: Record<string, unknown>;
    /** When true, `expected` lists only the fields the legacy test asserted. */
    partial?: boolean;
    expected: unknown;
}

export interface ExpectedFile {
    /** Legacy test file (relative to tests/) and line. */
    source: string;
    phpClass: string;
    note?: string;
    cases: ExpectedCase[];
}

export interface GoldenCase {
    name: string;
    input: unknown;
    /** Output as the frontend / caller received it (camelCase view models). */
    output?: unknown;
    /** Present on endpoint goldens that record the upstream HTTP traffic. */
    upstreamRequests?: Array<{ method: string; url: string; body: unknown }>;
}

export interface GoldenFile {
    generatedBy: string;
    phpClass: string;
    cases: GoldenCase[];
}

function resolveInputPath(domain: string, name: string): string {
    const direct = path.join(FIXTURES_DIR, domain, name);
    if (path.extname(name) !== '' && fs.existsSync(direct)) {
        return direct;
    }
    for (const ext of INPUT_EXTENSIONS) {
        const candidate = path.join(FIXTURES_DIR, domain, `${name}.${ext}`);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    throw new Error(`Fixture not found: ${domain}/${name}`);
}

/**
 * Upstream payload as UTF-8 text. `name` may omit the extension
 * (tries html, xml, json, txt) or include it, e.g. `tasks-count-merged.forum.html`.
 */
export function loadFixture(domain: string, name: string): string {
    return fs.readFileSync(resolveInputPath(domain, name), 'utf8');
}

/** Upstream payload as raw bytes (for the Big5 / malformed UTF-8 fixtures). */
export function loadFixtureBytes(domain: string, name: string): Uint8Array {
    return new Uint8Array(fs.readFileSync(resolveInputPath(domain, name)));
}

/** Upstream payload parsed as JSON. */
export function loadFixtureJson<T = unknown>(domain: string, name: string): T {
    return JSON.parse(loadFixture(domain, name)) as T;
}

/** Assertions extracted from the legacy Pest test (`<name>.expected.json`). */
export function loadExpected(domain: string, name: string): ExpectedFile {
    const file = path.join(FIXTURES_DIR, domain, `${name}.expected.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ExpectedFile;
}

/** Full output of the real PHP implementation (`<name>.golden.json`). */
export function loadGolden(domain: string, name: string): GoldenFile {
    const file = path.join(FIXTURES_DIR, domain, `${name}.golden.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8')) as GoldenFile;
}

/** Names of all fixtures in a domain (derived from `*.expected.json` / `*.golden.json`). */
export function listFixtures(domain: string): string[] {
    const names = new Set<string>();
    for (const file of fs.readdirSync(path.join(FIXTURES_DIR, domain))) {
        const match = file.match(/^(.*)\.(expected|golden)\.json$/);
        if (match) {
            names.add(match[1]);
        }
    }
    return [...names].sort();
}
