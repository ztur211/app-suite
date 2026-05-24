import { spawn } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');

interface EslintMessage {
  ruleId: string | null;
  message: string;
}

interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
}

function runEslintOn(filePath: string, source: string): Promise<EslintMessage[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules/eslint/bin/eslint.js'),
        '--no-warn-ignored',
        '--no-color',
        '--format',
        'json',
        '--stdin',
        '--stdin-filename',
        filePath,
      ],
      { cwd: repoRoot },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', () => {
      // ESLint exits non-zero on errors; both 0 and 1 are valid here.
      if (!stdout.trim()) {
        reject(new Error(`eslint produced no stdout (stderr: ${stderr})`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as EslintResult[];
        resolve(parsed[0]?.messages ?? []);
      } catch (e) {
        reject(
          new Error(`failed to parse eslint json: ${(e as Error).message}; stdout: ${stdout}`),
        );
      }
    });
    child.stdin.end(source);
  });
}

describe('ESLint provider-SDK boundary', () => {
  it('rejects @anthropic-ai/sdk import in a non-providers file', async () => {
    const filePath = path.join(repoRoot, 'packages/ai/src/__boundary_probe_outside.ts');
    const source = `import Anthropic from '@anthropic-ai/sdk';\nconsole.warn(Anthropic);\n`;
    const messages = await runEslintOn(filePath, source);
    expect(
      messages.some(
        (m) =>
          m.ruleId === 'no-restricted-imports' && (m.message ?? '').includes('@anthropic-ai/sdk'),
      ),
    ).toBe(true);
  }, 60000);

  it('allows @anthropic-ai/sdk import inside providers/', async () => {
    const filePath = path.join(repoRoot, 'packages/ai/src/providers/__boundary_probe_inside.ts');
    const source = `import type Anthropic from '@anthropic-ai/sdk';\nexport type Probe = Anthropic;\n`;
    const messages = await runEslintOn(filePath, source);
    expect(messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(false);
  }, 60000);
});
