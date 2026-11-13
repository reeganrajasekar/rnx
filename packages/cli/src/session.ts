import { execa } from "execa";
import { setTimeout as delay } from "node:timers/promises";
import { resolveCommunityCli, type Project } from "./project.js";
import { androidEnvironment, androidTool } from "./sdk.js";

async function metroRunning(port: string): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(1000) });
    return response.ok && (await response.text()).trim() === "packager-status:running";
  } catch { return false; }
}

export async function runSession(project: Project, port: string, build: () => Promise<number>, androidDevice?: string): Promise<number> {
  const cli = resolveCommunityCli(project);
  if (!cli) throw new Error("Project Community CLI not found. Run rnx get.");
  let metro: ReturnType<typeof execa> | undefined;
  let stopped = false;
  if (await metroRunning(port)) {
    console.log(`Using the existing Metro server on port ${port}; make sure it belongs to this project.`);
  } else {
    console.log(`Starting Metro on port ${port} in this terminal...`);
    metro = execa(process.execPath, [cli, "start", "--port", port], {
      cwd: project.root, env: androidEnvironment(project.root), stdin: "ignore", stdout: "inherit", stderr: "inherit", reject: false,
    });
    void metro.then(() => { stopped = true; });
    const deadline = Date.now() + 60000;
    while (!stopped && Date.now() < deadline && !(await metroRunning(port))) await delay(250);
    if (stopped || !(await metroRunning(port))) {
      metro.kill();
      const result = await metro;
      throw new Error(`Metro did not start on port ${port}${result.exitCode ? ` (exit ${result.exitCode})` : ""}. Check its output and whether the port is available.`);
    }
  }

  let closingLogs = false;
  const logs = androidDevice ? execa(androidTool("adb", project.root), ["-s", androidDevice, "logcat", "-T", "1", "-v", "brief", "ReactNativeJS:V", "ReactNative:W", "*:S"], {
    cwd: project.root, stdin: "ignore", stdout: "inherit", stderr: "inherit", reject: false,
  }) : undefined;
  if (logs) {
    console.log(`Streaming React Native logs from ${androidDevice}...`);
    void logs.then((result) => {
      if (!closingLogs) console.error(`Android log stream stopped${result.exitCode != null ? ` (exit ${result.exitCode})` : ""}. Run rnx logs android --filter react-native to inspect logs.`);
    });
  }
  const stopLogs = async () => {
    if (logs) { closingLogs = true; logs.kill(); await logs; }
  };
  let buildCode: number;
  try { buildCode = await build(); }
  catch (error) {
    await stopLogs();
    if (metro) { metro.kill(); await metro; }
    throw error;
  }
  if (buildCode !== 0 || stopped) {
    await stopLogs();
    if (metro && !stopped) { metro.kill(); await metro; }
    return buildCode || 1;
  }

  console.log("\nRNX: r = reload JavaScript, R = rebuild and restart app, q = quit. Fast Refresh applies edits automatically.");
  let busy = false;
  let finish!: (code: number) => void;
  const completed = new Promise<number>((resolve) => { finish = resolve; });
  const onSignal = () => finish(0);
  const onData = (data: Buffer) => {
    const key = data.toString();
    if (key === "q" || key === "\u0003" || key === "\u0004") { finish(0); return; }
    if (busy) return;
    if (key === "r") {
      busy = true;
      console.log("Reloading JavaScript on connected apps...");
      void fetch(`http://127.0.0.1:${port}/reload`, { signal: AbortSignal.timeout(5000) })
        .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); })
        .catch((error) => console.error(`Reload failed: ${String(error)}`))
        .finally(() => { busy = false; });
    } else if (key === "R") {
      busy = true;
      process.stdin.setRawMode(false);
      process.stdin.pause();
      console.log("Rebuilding and restarting the app...");
      void build().then((code) => { if (code) console.error(`Restart failed (exit ${code}).`); })
        .catch((error) => console.error(`Restart failed: ${String(error)}`))
        .finally(() => { if (!stopped) { process.stdin.setRawMode(true); process.stdin.resume(); } busy = false; });
    } else if (key === "h" || key === "?") {
      console.log("r: reload JavaScript | R: rebuild and restart | q: quit");
    }
  };
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", onData);
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  if (metro) void metro.then((result) => { stopped = true; finish(result.exitCode || 1); });
  try { return await completed; }
  finally {
    stopped = true;
    process.stdin.off("data", onData);
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    await stopLogs();
    if (metro) { metro.kill(); await metro; }
  }
}
