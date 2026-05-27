import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

export const APP_NAMES = ['auth', 'do', 'say', 'buy', 'eat', 'send'] as const;
export type AppName = (typeof APP_NAMES)[number];

export interface SuitePostgresOptions {
  /** Which app DBs to provision. Defaults to all six. */
  apps?: readonly AppName[];
  /** Postgres image tag. Defaults to postgres:16-alpine. */
  imageTag?: string;
  /**
   * If true, also create the cross-app `auth_reader` role with CONNECT on
   * things_auth. Table-level GRANTs must be applied after migrations via
   * `grantAuthReaderOnAuthTables()`. Defaults to true when 'auth' is provisioned.
   */
  authReader?: boolean;
}

export interface SuitePostgres {
  /** Per-app owner-role connection URLs, keyed by app name. */
  urls: Record<AppName, string>;
  /** Read-only connection URL into things_auth (auth_reader role). */
  authReaderUrl: string;
  host: string;
  port: number;
  /**
   * Grant SELECT on all existing things_auth tables to auth_reader. Call this
   * after `prisma migrate deploy` against `urls.auth`.
   */
  grantAuthReaderOnAuthTables(): Promise<void>;
  stop(): Promise<void>;
}

const ALL_APPS: readonly AppName[] = APP_NAMES;

/**
 * Spin up a Postgres container and provision the per-app DB+role topology
 * documented in foundation spec §3.5 (one database per app, each owned by a
 * dedicated role, optional auth_reader role for cross-app session lookup).
 */
export async function setupSuitePostgres(opts: SuitePostgresOptions = {}): Promise<SuitePostgres> {
  const apps = opts.apps ?? ALL_APPS;
  const wantAuthReader = opts.authReader ?? apps.includes('auth');
  if (wantAuthReader && !apps.includes('auth')) {
    throw new Error("setupSuitePostgres: authReader=true requires 'auth' in apps");
  }

  const image = opts.imageTag ?? 'postgres:16-alpine';
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(image)
    .withUsername('postgres')
    .withPassword('postgres')
    .withDatabase('postgres')
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const adminUrl = container.getConnectionUri();

  try {
    await provisionDatabasesAndRoles(adminUrl, apps, wantAuthReader);
  } catch (err) {
    await container.stop().catch(() => undefined);
    throw err;
  }

  const urls = Object.fromEntries(
    apps.map((app) => [
      app,
      connectionUrl(host, port, `${app}_owner`, `${app}_owner`, `things_${app}`),
    ]),
  ) as Record<AppName, string>;

  return {
    urls,
    authReaderUrl: wantAuthReader
      ? connectionUrl(host, port, 'auth_reader', 'auth_reader', 'things_auth')
      : '',
    host,
    port,
    grantAuthReaderOnAuthTables: async () => {
      if (!wantAuthReader) {
        throw new Error('grantAuthReaderOnAuthTables: authReader was not provisioned');
      }
      const ownerClient = new Client({ connectionString: urls.auth });
      await ownerClient.connect();
      try {
        await ownerClient.query('GRANT USAGE ON SCHEMA public TO auth_reader');
        await ownerClient.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO auth_reader');
        await ownerClient.query(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO auth_reader',
        );
      } finally {
        await ownerClient.end();
      }
    },
    stop: () => container.stop().then(() => undefined),
  };
}

function connectionUrl(
  host: string,
  port: number,
  user: string,
  password: string,
  db: string,
): string {
  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

async function provisionDatabasesAndRoles(
  adminUrl: string,
  apps: readonly AppName[],
  wantAuthReader: boolean,
): Promise<void> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    for (const app of apps) {
      const owner = `${app}_owner`;
      const db = `things_${app}`;
      await admin.query(`CREATE ROLE ${owner} WITH LOGIN PASSWORD '${owner}'`);
      await admin.query(`CREATE DATABASE ${db} OWNER ${owner}`);
    }
    if (wantAuthReader) {
      await admin.query(`CREATE ROLE auth_reader WITH LOGIN PASSWORD 'auth_reader'`);
      await admin.query(`GRANT CONNECT ON DATABASE things_auth TO auth_reader`);
    }
  } finally {
    await admin.end();
  }
}
