import { expect, it, vi } from 'vitest';
vi.mock('execa', () => ({ execa: vi.fn() }));
import { execa } from 'execa';
import { execute } from '../packages/cli/src/process.js';
it('retains inherited output, exit codes and conventional Ctrl-C cancellation status', async () => {
  vi.mocked(execa).mockResolvedValueOnce({ exitCode: 17 } as never);
  expect(await execute('native', ['argument with spaces'], process.cwd())).toBe(17);
  expect(execa).toHaveBeenLastCalledWith('native', ['argument with spaces'], { cwd: process.cwd(), stdio: 'inherit', reject: false });
  vi.mocked(execa).mockResolvedValueOnce({ signal: 'SIGINT' } as never);
  expect(await execute('native', [])).toBe(130);
});
it('explains missing executable errors', async () => {
  vi.mocked(execa).mockResolvedValueOnce({ code: 'ENOENT' } as never);
  await expect(execute('missing-tool', [])).rejects.toThrow('rnx setup');
});
