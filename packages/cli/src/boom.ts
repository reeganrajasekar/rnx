import { createHash } from "node:crypto";
import { cpSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { diagnose, printChecks } from "./doctor.js";
import { capture, execute } from "./process.js";
import { findProject } from "./project.js";
import { androidSdk, javaTool } from "./sdk.js";

const archive = "commandlinetools-win-15859902_latest.zip";
const archiveSha256 = "90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a";

async function run(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<void> {
  const code = await execute(command, args, undefined, env);
  if (code !== 0) throw new Error(`${command} failed with exit code ${code}. Fix the error and run rnx boom again.`);
}

async function setUserVariable(name: string, value: string): Promise<void> {
  await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "[Environment]::SetEnvironmentVariable($env:RNX_VARIABLE_NAME, $env:RNX_VARIABLE_VALUE, 'User')"], { RNX_VARIABLE_NAME: name, RNX_VARIABLE_VALUE: value });
  process.env[name] = value;
}

async function javaHome(): Promise<string | undefined> {
  try {
    const compiler = (await capture(javaTool("javac"), ["-version"])).trim();
    if (!compiler) return undefined;
    if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, "bin", "javac.exe"))) return process.env.JAVA_HOME;
    const path = (await capture("where.exe", ["javac.exe"])).split(/\r?\n/)[0];
    if (path) return dirname(dirname(path));
  } catch { /* Look for the JDK installed during this run below. */ }
  const directory = join(process.env.ProgramFiles ?? "C:\\Program Files", "Microsoft");
  try {
    return readdirSync(directory).filter((name) => /^jdk-17/i.test(name)).map((name) => join(directory, name)).find((path) => existsSync(join(path, "bin", "javac.exe")));
  } catch { return undefined; }
}

function sdkVersions(root: string | undefined): { platform: string; buildTools: string } {
  const gradle = root && join(root, "android", "build.gradle");
  const contents = gradle && existsSync(gradle) ? readFileSync(gradle, "utf8") : "";
  return {
    platform: contents.match(/\bcompileSdkVersion\s*(?:=\s*)?["']?(\d+)/)?.[1] ?? "35",
    buildTools: contents.match(/\bbuildToolsVersion\s*(?:=\s*)?["']([\d.]+)["']/)?.[1] ?? "36.0.0",
  };
}

async function installCommandLineTools(sdk: string): Promise<void> {
  const latest = join(sdk, "cmdline-tools", "latest");
  if (existsSync(join(latest, "bin", "sdkmanager.bat"))) return;
  if (existsSync(latest)) throw new Error(`Incomplete command-line tools already exist at ${latest}. Repair or remove that directory and retry.`);
  if (!process.stdin.isTTY) throw new Error("Android SDK command-line tools are missing. Run rnx boom in an interactive terminal to review Google's SDK license.");
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let answer: string;
  try { answer = await prompt.question("Review https://developer.android.com/studio/terms . Do you accept the Android SDK license to download the command-line tools? [y/N] "); }
  finally { prompt.close(); }
  if (!/^y(?:es)?$/i.test(answer.trim())) throw new Error("Android SDK license was not accepted; command-line tools were not downloaded.");
  const temp = mkdtempSync(join(tmpdir(), "rnx-sdk-"));
  try {
    console.log("Downloading Android SDK command-line tools from Google...");
    const response = await fetch(`https://dl.google.com/android/repository/${archive}`);
    if (!response.ok || !response.body) throw new Error(`SDK download failed: HTTP ${response.status}`);
    const zip = join(temp, archive);
    const hash = createHash("sha256");
    await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), new Transform({ transform(chunk, _encoding, callback) { hash.update(chunk); callback(null, chunk); } }), createWriteStream(zip));
    if (hash.digest("hex") !== archiveSha256) throw new Error("Android SDK archive checksum did not match; download was discarded.");
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Expand-Archive -LiteralPath $env:RNX_ARCHIVE -DestinationPath $env:RNX_EXTRACT"], { RNX_ARCHIVE: zip, RNX_EXTRACT: temp });
    const unpacked = join(temp, "cmdline-tools");
    if (!existsSync(join(unpacked, "bin", "sdkmanager.bat"))) throw new Error("Downloaded Android SDK archive is missing sdkmanager.");
    mkdirSync(dirname(latest), { recursive: true });
    cpSync(unpacked, latest, { recursive: true, errorOnExist: true, force: false });
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

export async function boom(): Promise<number> {
  if (process.platform !== "win32") throw new Error("rnx boom currently installs Android tools on Windows only. Use rnx setup for platform instructions.");
  await capture("winget", ["--version"]);
  const root = findProject()?.root;
  const checks = await diagnose(process.cwd(), "android");
  if (!checks.find((check) => check.name === "Android Studio")?.ok) {
    console.log("Installing Android Studio with WinGet...");
    await run("winget", ["install", "--id", "Google.AndroidStudio", "--exact", "--source", "winget", "--no-upgrade"]);
  }
  let java = await javaHome();
  if (!java) {
    console.log("Installing JDK 17 with WinGet...");
    await run("winget", ["install", "--id", "Microsoft.OpenJDK.17", "--exact", "--source", "winget", "--no-upgrade"]);
    java = await javaHome();
  }
  if (!java) throw new Error("JDK installation completed, but javac could not be found. Open a new terminal and retry.");
  if (process.env.JAVA_HOME !== java) await setUserVariable("JAVA_HOME", java);
  const sdk = androidSdk(root) ?? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Android", "Sdk");
  mkdirSync(sdk, { recursive: true });
  if (process.env.ANDROID_HOME !== sdk) await setUserVariable("ANDROID_HOME", sdk);
  await installCommandLineTools(sdk);
  const manager = join(sdk, "cmdline-tools", "latest", "bin", "sdkmanager.bat");
  const { platform, buildTools } = sdkVersions(root);
  const packages = ["platform-tools", "emulator", `platforms;android-${platform}`, `build-tools;${buildTools}`];
  console.log("Installing Android SDK packages:", packages.join(", "));
  await run(manager, [`--sdk_root=${sdk}`, ...packages]);
  console.log("Setup finished. Open a new terminal to use the saved environment variables. Create an AVD in Android Studio or connect a physical device.");
  return printChecks(await diagnose(process.cwd(), "android"));
}
