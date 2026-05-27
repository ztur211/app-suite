import { Client } from 'pg';
import { setupSuitePostgres, type SuitePostgres } from '../postgres';

jest.setTimeout(120_000);

describe('setupSuitePostgres', () => {
  let suite: SuitePostgres;

  afterEach(async () => {
    if (suite) await suite.stop();
  });

  it('provisions a single app DB + owner role and the owner can connect', async () => {
    suite = await setupSuitePostgres({ apps: ['auth'], authReader: false });

    const c = new Client({ connectionString: suite.urls.auth });
    await c.connect();
    try {
      const r = await c.query('SELECT current_database() AS db, current_user AS role');
      expect(r.rows[0].db).toBe('things_auth');
      expect(r.rows[0].role).toBe('auth_owner');
    } finally {
      await c.end();
    }
  });

  it('provisions all six per-app DBs by default and isolates them by role', async () => {
    suite = await setupSuitePostgres();

    for (const app of ['auth', 'do', 'say', 'buy', 'eat', 'send'] as const) {
      const url = suite.urls[app];
      expect(url).toMatch(new RegExp(`/things_${app}\\?`));
      const c = new Client({ connectionString: url });
      await c.connect();
      try {
        const r = await c.query('SELECT current_user AS role, current_database() AS db');
        expect(r.rows[0].role).toBe(`${app}_owner`);
        expect(r.rows[0].db).toBe(`things_${app}`);
      } finally {
        await c.end();
      }
    }
  });

  it('creates auth_reader role with CONNECT but no table SELECT until granted', async () => {
    suite = await setupSuitePostgres({ apps: ['auth'] });
    expect(suite.authReaderUrl).toContain('auth_reader');

    // Create a table as auth_owner so we can assert auth_reader's access
    const owner = new Client({ connectionString: suite.urls.auth });
    await owner.connect();
    await owner.query('CREATE TABLE public."User" (id text PRIMARY KEY)');
    await owner.end();

    const reader = new Client({ connectionString: suite.authReaderUrl });
    await reader.connect();
    try {
      await expect(reader.query('SELECT * FROM public."User"')).rejects.toThrow(
        /permission denied/i,
      );
    } finally {
      await reader.end();
    }

    await suite.grantAuthReaderOnAuthTables();

    const reader2 = new Client({ connectionString: suite.authReaderUrl });
    await reader2.connect();
    try {
      const r = await reader2.query('SELECT * FROM public."User"');
      expect(r.rows).toEqual([]);
    } finally {
      await reader2.end();
    }
  });

  it("rejects authReader=true when 'auth' is not in apps", async () => {
    await expect(setupSuitePostgres({ apps: ['do'], authReader: true })).rejects.toThrow(
      /requires 'auth'/,
    );
  });
});
