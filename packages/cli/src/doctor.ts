import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { delimiter } from "node:path";
import { homedir } from "node:os";
import pc from "picocolors";
import { capture } from "./process.js";
import { findProject, resolveCommunityCli } from "./project.js";
import { androidSdk, androidTool, javaTool } from "./sdk.js";
import { detectPackageManager } from "./packages.js";
import type { Platform } from "./config.js";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  optional?: boolean;
}
function installedVersions(directory: string | undefined, file: string): string[] {
  if (!directory) return [];
  try {
    return readdirSync(directory).filter((version) => existsSync(join(directory, version, file)));
  } catch {
    return [];
  }
}

function androidStudio(): string | undefined {
  const candidates = process.platform === "win32"
    ? [join(process.env.ProgramFiles ?? "C:\\Program Files", "Android", "Android Studio", "bin", "studio64.exe")]
    : process.platform === "darwin"
      ? ["/Applications/Android Studio.app", join(homedir(), "Applications", "Android Studio.app")]
      : ["/opt/android-studio/bin/studio.sh", "/usr/local/android-studio/bin/studio.sh"];
  const names = process.platform === "win32" ? ["studio64.exe"] : ["studio", "studio.sh"];
  candidates.push(...(process.env.PATH ?? "").split(delimiter).filter(Boolean).flatMap((dir) => names.map((name) => join(dir, name))));
  return candidates.find((candidate) => existsSync(candidate));
}
async function command(
  name: string,
  args: string[],
  label: string,
  advice: string,
  cwd: string,
  optional = false,
): Promise<Check> {
  try {
    return {
      name: label,
      ok: true,
      detail: (await capture(name, args, cwd)).split(/\r?\n/)[0] || "available",
      optional,
    };
  } catch (error) {
    return {
      name: label,
      ok: false,
      detail: `${advice} ${error instanceof Error ? error.message : String(error)}`,
      optional,
    };
  }
}
export async function diagnose(
  cwd = process.cwd(),
  target?: Platform,
): Promise<Check[]> {
  const project = findProject(cwd);
  const root = project?.root ?? cwd;
  const [major, minor] = process.versions.node.split(".").map(Number);
  const pm = project ? detectPackageManager(root) : "npm";
  const checks: Check[] = [
    {
      name: "Node.js",
      ok: major > 20 || (major === 20 && minor >= 19),
      detail: `${process.version} (RNX requires >=20.19; React Native may require newer)`,
    },
    await command(
      pm,
      ["--version"],
      `Package manager (${pm})`,
      `Install ${pm} or enable it with Corepack.`,
      root,
    ),
    {
      name: "React Native project",
      ok: !!project,
      optional: !project,
      detail: project
        ? `${project.name} (${project.reactNative}) at ${root}`
        : "No project here. Create one with rnx create MyApp.",
    },
  ];
  if (project) {
    const cli = resolveCommunityCli(project);
    checks.push({
      name: "Community CLI",
      ok: !!cli,
      detail:
        cli ??
        "Run rnx get; use a CLI version compatible with this React Native version.",
    });
    checks.push({
      name: "Metro configuration",
      ok: [
        "metro.config.js",
        "metro.config.cjs",
        "metro.config.mjs",
        "metro.config.ts",
      ].some((name) => existsSync(join(root, name))),
      optional: true,
      detail:
        "Keep the project Metro configuration; RNX uses its existing bundler.",
    });
  }
  if (target !== "ios") {
    if (project)
      checks.push({
        name: "Android project",
        ok: existsSync(join(root, "android")),
        detail: join(root, "android"),
      });
    checks.push(
      await command(
        javaTool(),
        ["-version"],
        "Java",
        "Install a JDK supported by the project and set JAVA_HOME.",
        root,
      ),
    );
    if (process.env.JAVA_HOME) {
      const validHome = existsSync(join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java"));
      checks.push({ name: "JAVA_HOME", ok: validHome, detail: validHome ? process.env.JAVA_HOME : `${process.env.JAVA_HOME} is invalid. Open a new terminal or set JAVA_HOME to your JDK.` });
    }
    checks.push(await command(javaTool("javac"), ["-version"], "JDK compiler", "Install a full JDK and set JAVA_HOME.", root));
    const studio = androidStudio();
    checks.push({
      name: "Android Studio",
      ok: !!studio,
      optional: true,
      detail: studio ?? "Not found in common locations or PATH. Install Android Studio, or ensure the SDK tools are installed separately.",
    });
    const sdk = androidSdk(root);
    checks.push({
      name: "Android SDK",
      ok: !!sdk,
      detail:
        sdk ??
        "Install Android Studio and set ANDROID_HOME to the SDK directory.",
    });
    const platforms = installedVersions(sdk && join(sdk, "platforms"), "android.jar");
    checks.push({
      name: "Android SDK platforms",
      ok: platforms.length > 0,
      detail: platforms.length ? platforms.join(", ") : "Install the project compile SDK in Android Studio SDK Manager.",
    });
    const tools = installedVersions(sdk && join(sdk, "build-tools"), process.platform === "win32" ? "aapt.exe" : "aapt");
    checks.push({
      name: "Android build-tools",
      ok: tools.length > 0,
      detail: tools.length ? tools.join(", ") : "Install the project build-tools version in Android Studio SDK Manager.",
    });
    const sdkManager = sdk && join(sdk, "cmdline-tools", "latest", "bin", process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager");
    checks.push({
      name: "Android SDK command-line tools",
      ok: !!sdkManager && existsSync(sdkManager),
      optional: true,
      detail: sdkManager && existsSync(sdkManager) ? sdkManager : "Install Android SDK Command-line Tools (latest) in SDK Manager.",
    });
    checks.push(
      await command(
        androidTool("adb", root),
        ["version"],
        "ADB",
        "Install SDK platform-tools.",
        root,
      ),
    );
    try {
      const avds = await capture(androidTool("emulator", root), ["-list-avds"], root);
      checks.push({ name: "Android emulators", ok: !!avds.trim(), optional: true, detail: avds.trim() || "Create an AVD in Android Studio Device Manager, or use a physical device." });
    } catch {
      checks.push({ name: "Android emulators", ok: false, optional: true, detail: "Install the Android emulator and create an AVD, or use a physical device." });
    }
  }
  if (target === "ios" || (!target && process.platform === "darwin")) {
    if (process.platform !== "darwin")
      checks.push({
        name: "iOS host",
        ok: false,
        detail: "Local iOS builds and devices require macOS and Xcode.",
      });
    else {
      if (project)
        checks.push({
          name: "iOS project",
          ok: existsSync(join(root, "ios", "Podfile")),
          detail: join(root, "ios", "Podfile"),
        });
      checks.push(
        await command(
          "xcode-select",
          ["-p"],
          "Xcode tools",
          "Select full Xcode in Xcode Settings > Locations.",
          root,
        ),
      );
      checks.push(
        await command(
          "xcodebuild",
          ["-version"],
          "Xcode",
          "Install and open Xcode to finish setup and accept its license.",
          root,
        ),
      );
      if (
        existsSync(join(root, "Gemfile")) ||
        existsSync(join(root, "ios", "Gemfile"))
      ) {
        const gemRoot = existsSync(join(root, "Gemfile"))
          ? root
          : join(root, "ios");
        checks.push(
          await command(
            "bundle",
            ["--version"],
            "Bundler",
            "Install Bundler for the project Ruby version.",
            gemRoot,
          ),
        );
        checks.push(
          await command(
            "bundle",
            ["exec", "pod", "--version"],
            "CocoaPods (Gemfile)",
            "Run rnx pods to install project gems and pods.",
            gemRoot,
          ),
        );
      } else
        checks.push(
          await command(
            "pod",
            ["--version"],
            "CocoaPods",
            "Install CocoaPods, preferably with a project Gemfile.",
            root,
          ),
        );
      try {
        const list = JSON.parse(
          await capture(
            "xcrun",
            ["simctl", "list", "devices", "available", "--json"],
            root,
          ),
        );
        const available = Object.entries(list.devices ?? {}).some(
          ([runtime, devices]) =>
            runtime.includes(".iOS-") &&
            Array.isArray(devices) &&
            devices.length > 0,
        );
        checks.push({
          name: "iOS simulators",
          ok: available,
          optional: true,
          detail: available
            ? "Available iOS simulators found"
            : "Install an iOS runtime in Xcode Settings > Components/Platforms.",
        });
      } catch (error) {
        checks.push({
          name: "iOS simulators",
          ok: false,
          optional: true,
          detail: String(error),
        });
      }
    }
  }
  return checks;
}
export function printChecks(checks: Check[], verbose = true): number {
  console.log(pc.cyan("RNX Doctor"));
  for (const check of checks)
    console.log(
      `  ${check.ok ? pc.green("✓") : check.optional ? pc.yellow("!") : pc.red("✗")} ${check.name}${verbose || !check.ok ? `: ${check.detail}` : ""}`,
    );
  return checks.some((check) => !check.ok && !check.optional) ? 1 : 0;
}
