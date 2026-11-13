import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../packages/cli/src/process.js', () => ({ capture: vi.fn() }));
import { capture } from '../packages/cli/src/process.js';
import { diagnose, printChecks } from '../packages/cli/src/doctor.js';

it('reports SDK components and an empty emulator list outside a project', async () => {
  const root = mkdtempSync(join(tmpdir(), 'rnx-doctor-'));
  try {
    const sdk = join(root, 'sdk');
    mkdirSync(join(sdk, 'platforms', 'android-35'), { recursive: true });
    mkdirSync(join(sdk, 'build-tools', '36.0.0'), { recursive: true });
    writeFileSync(join(sdk, 'platforms', 'android-35', 'android.jar'), '');
    vi.stubEnv('ANDROID_HOME', sdk);
    vi.stubEnv('ANDROID_SDK_ROOT', '');
    vi.mocked(capture).mockImplementation(async (_command, args) => args[0] === '-list-avds' ? '' : 'available');
    const checks = await diagnose(root, 'android');
    expect(checks.find((check) => check.name === 'Android SDK platforms')).toMatchObject({ ok: true, detail: 'android-35' });
    expect(checks.find((check) => check.name === 'Android build-tools')).toMatchObject({ ok: false });
    expect(checks.find((check) => check.name === 'Android emulators')).toMatchObject({ ok: false, optional: true });
    expect(checks.find((check) => check.name === 'React Native project')).toMatchObject({ ok: false, optional: true });
    expect(printChecks(checks)).toBe(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
