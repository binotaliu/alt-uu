import type { AltUUDatabase } from './types';

export interface MigrationBundle {
    journal: {
        version?: string;
        dialect?: string;
        entries: {
            idx: number;
            version?: string;
            when: number;
            tag: string;
            breakpoints: boolean;
        }[];
    };
    /** `m0000`, `m0001`, ... → raw SQL text. */
    migrations: Record<string, string>;
}

/**
 * Applies pending migrations. Equivalent to drizzle's expo-sqlite `migrate`,
 * but free of React / expo imports so core stays driver-agnostic.
 */
export async function runMigrations(
    db: AltUUDatabase,
    bundle: MigrationBundle,
): Promise<void> {
    const migrations = bundle.journal.entries.map((entry) => {
        const sqlText =
            bundle.migrations[`m${String(entry.idx).padStart(4, '0')}`];

        if (sqlText === undefined) {
            throw new Error(`Missing migration: ${entry.tag}`);
        }

        return {
            sql: sqlText.split('--> statement-breakpoint'),
            bps: entry.breakpoints,
            folderMillis: entry.when,
            hash: '',
        };
    });

    // The dialect narrows its signature by run mode; the union type here
    // cannot express that, but both modes accept the same arguments.
    const internals = db as unknown as {
        dialect: {
            migrate(
                migrations: unknown,
                session: unknown,
            ): void | Promise<void>;
        };
        session: unknown;
    };

    await internals.dialect.migrate(migrations, internals.session);
}
