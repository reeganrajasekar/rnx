import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
export function androidSdk(root?: string): string | undefined {
  const local = root && join(root, "android", "local.properties");
  const property =
    local && existsSync(local)
      ? readFileSync(local, "utf8")
          .match(/^sdk\.dir\s*=\s*(.+)$/m)?.[1]
          ?.trim()
          .replace(/\\([\\: ])/g, "$1")
      : undefined;
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    property,
    process.platform === "win32"
      ? join(
          process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"),
          "Android",
          "Sdk",
        )
      : process.platform === "darwin"
        ? join(homedir(), "Library", "Android", "sdk")
        : join(homedir(), "Android", "Sdk"),
  ];
  return candidates.find((path): path is string => !!path && existsSync(path));
}
export function androidTool(name: "adb" | "emulator", root?: string): string {
  const sdk = androidSdk(root);
  const path =
    sdk &&
    join(
      sdk,
      name === "adb" ? "platform-tools" : "emulator",
      `${name}${process.platform === "win32" ? ".exe" : ""}`,
    );
  return path && existsSync(path) ? path : name;
}
export function androidEnvironment(root: string): NodeJS.ProcessEnv {
  repairJavaHome();
  const sdk = androidSdk(root);
  return {
    ...(sdk ? { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk } : {}),
    ...(process.env.JAVA_HOME ? { JAVA_HOME: process.env.JAVA_HOME } : {}),
  };
}
export function javaTool(name: "java" | "javac" = "java"): string {
  const java =
    process.env.JAVA_HOME &&
    join(
      process.env.JAVA_HOME,
      "bin",
      `${name}${process.platform === "win32" ? ".exe" : ""}`,
    );
  return java && existsSync(java) ? java : name;
}

export function repairJavaHome(): void {
  const current = process.env.JAVA_HOME;
  if (!current || existsSync(join(current, "bin", process.platform === "win32" ? "java.exe" : "java"))) return;
  if (process.platform === "win32") {
    try {
      const value = execFileSync("reg.exe", ["query", "HKCU\\Environment", "/v", "JAVA_HOME"], { encoding: "utf8", windowsHide: true });
      const saved = value.match(/^\s*JAVA_HOME\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/im)?.[1];
      if (saved && existsSync(join(saved, "bin", "java.exe"))) {
        process.env.JAVA_HOME = saved;
        console.log(`Using the current Windows user JAVA_HOME: ${saved}`);
        return;
      }
    } catch { /* Explain the invalid value below. */ }
  }
  throw new Error(`JAVA_HOME points to an invalid directory: ${current}. Set it to a valid JDK and open a new terminal, or run rnx boom on Windows.`);
}
