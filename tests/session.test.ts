import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../packages/cli/src/project.js', () => ({ resolveCommunityCli: vi.fn(() => 'cli.js') }));
vi.mock('execa', () => ({ execa: vi.fn() }));
import { execa } from 'execa';
import { runSession } from '../packages/cli/src/session.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('reuses Metro, sends reload, rebuilds, and quits without stopping the existing server', async () => {
  const fetchMock = vi.fn(async (url: string | URL | Request) => ({ ok: true, text: async () => String(url).endsWith('/status') ? 'packager-status:running' : 'OK' }));
  vi.stubGlobal('fetch', fetchMock);
  const stdin = process.stdin;
  const original = Object.getOwnPropertyDescriptor(stdin, 'setRawMode');
  Object.defineProperty(stdin, 'setRawMode', { configurable: true, value: vi.fn() });
  const resume = vi.spyOn(stdin, 'resume').mockReturnValue(stdin);
  const pause = vi.spyOn(stdin, 'pause').mockReturnValue(stdin);
  const build = vi.fn().mockResolvedValue(0);
  let resolveLogs!: (value: { exitCode: number }) => void;
  const logs = Object.assign(new Promise<{ exitCode: number }>((resolve) => { resolveLogs = resolve; }), {
    kill: vi.fn(() => resolveLogs({ exitCode: 0 })),
  });
  vi.mocked(execa).mockReturnValue(logs as unknown as ReturnType<typeof execa>);
  try {
    const session = runSession({ root: process.cwd(), name: 'app', reactNative: '0.88' }, '8081', build, 'emulator-5554');
    await vi.waitFor(() => expect(stdin.setRawMode).toHaveBeenCalledWith(true));
    expect(build).toHaveBeenCalledTimes(1);
    stdin.emit('data', Buffer.from('r'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8081/reload', expect.anything()));
    await new Promise((resolve) => setImmediate(resolve));
    stdin.emit('data', Buffer.from('R'));
    await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setImmediate(resolve));
    stdin.emit('data', Buffer.from('q'));
    expect(await session).toBe(0);
    expect(execa).toHaveBeenCalledOnce();
    expect(execa).toHaveBeenCalledWith(expect.stringMatching(/adb(?:\.exe)?$/), ['-s', 'emulator-5554', 'logcat', '-T', '1', '-v', 'brief', 'ReactNativeJS:V', 'ReactNative:W', '*:S'], expect.objectContaining({ stdout: 'inherit', stderr: 'inherit' }));
    expect(logs.kill).toHaveBeenCalledOnce();
    expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
  } finally {
    resume.mockRestore(); pause.mockRestore();
    if (original) Object.defineProperty(stdin, 'setRawMode', original);
    else delete (stdin as unknown as { setRawMode?: unknown }).setRawMode;
  }
});
it('stops the Android log stream when the build fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'packager-status:running' })));
  let resolveLogs!: (value: { exitCode: number }) => void;
  const logs = Object.assign(new Promise<{ exitCode: number }>((resolve) => { resolveLogs = resolve; }), {
    kill: vi.fn(() => resolveLogs({ exitCode: 0 })),
  });
  vi.mocked(execa).mockReturnValue(logs as unknown as ReturnType<typeof execa>);
  expect(await runSession({ root: process.cwd(), name: 'app', reactNative: '0.88' }, '8081', async () => 7, 'phone')).toBe(7);
  expect(logs.kill).toHaveBeenCalledOnce();
});
it('stops the Metro it started when the native build fails', async () => {
  let requests = 0;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: ++requests > 1, text: async () => 'packager-status:running' })));
  let resolveMetro!: (value: { exitCode: number }) => void;
  const metro = Object.assign(new Promise<{ exitCode: number }>((resolve) => { resolveMetro = resolve; }), {
    kill: vi.fn(() => resolveMetro({ exitCode: 0 })),
  });
  vi.mocked(execa).mockReturnValue(metro as unknown as ReturnType<typeof execa>);
  const build = vi.fn().mockResolvedValue(7);
  expect(await runSession({ root: process.cwd(), name: 'app', reactNative: '0.88' }, '8081', build)).toBe(7);
  expect(build).toHaveBeenCalledOnce();
  expect(metro.kill).toHaveBeenCalledOnce();
});
