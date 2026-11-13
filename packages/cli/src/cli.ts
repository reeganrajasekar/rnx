import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { diagnose, printChecks } from "./doctor.js";
import { boom } from "./boom.js";
import { devicesFor } from "./devices.js";
import { run } from "./run.js";
import { platform, port, loadConfig } from "./config.js";
import { findProject, requireProject } from "./project.js";
import { community, execute, expo } from "./process.js";
import { isExpoRouter, pendingExpoRouter } from "./expo-router.js";
import { createProject } from "./create.js";
import { upgrade } from "./upgrade.js";
import {
  managePackages,
  detectPackageManager,
  validatePackages,
} from "./packages.js";
import { setup, installPods, androidConnection } from "./setup.js";
import { build } from "./build.js";
import { emulators } from "./emulators.js";
import { clean, logs } from "./maintenance.js";

async function status(result: Promise<number>): Promise<void> {
  process.exitCode = await result;
}
export function createProgram(): Command {
  const program = new Command();
  const version = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ).version;
  program
    .name("rnx")
    .description("RNX — React Native eXperience")
    .version(version)
    .enablePositionalOptions()
    .showHelpAfterError();
  program.addHelpText(
    "before",
    `${pc.cyan("RNX")} — React Native eXperience\n`,
  );
  program
    .command("create")
    .alias("init")
    .description("Create a bare React Native project")
    .argument("[name]")
    .option("--directory <path>")
    .option("--version <version>", "React Native version")
    .option("--cli-version <version>", "compatible Community CLI version/tag")
    .option("--template <source>", "official CLI-compatible template")
    .option("--pm <manager>", "npm, pnpm, yarn, or bun")
    .option("--router <router>", "none, react-navigation, or expo-router")
    .option("--store <store>", "none, zustand, redux, or jotai")
    .option("--styling <style>", "native or nativewind")
    .option("--no-install", "skip dependency installation")
    .option("--pods", "install iOS pods on macOS")
    .option("--no-git", "skip Git initialization")
    .action(async (name, options) => status(createProject(name, options)));
  program
    .command("upgrade")
    .description(
      "Stage a React Native dependency upgrade in a separate Git worktree",
    )
    .argument(
      "[version]",
      "exact target React Native version (default: latest)",
    )
    .option("--directory <path>", "new worktree directory outside the project")
    .action(async (version, options) => status(upgrade(version, options)));
  program
    .command("boom")
    .description("Install and configure Windows Android development tools")
    .action(async () => status(boom()));
  program
    .command("doctor")
    .description("Check general and platform prerequisites")
    .argument("[platform]")
    .option("--verbose", "include successful tool details")
    .action(async (value, options) => {
      const checks = await diagnose(
        process.cwd(),
        value ? platform(value) : undefined,
      );
      process.exitCode = printChecks(checks, options.verbose);
    });
  program
    .command("setup")
    .description(
      "Explain platform setup; optionally install project dependencies",
    )
    .argument("[platform]")
    .option(
      "--install",
      "install project dependencies; on iOS also install Gemfile dependencies and pods",
    )
    .option("--pm <manager>")
    .action(async (value, options) => status(setup(value, options)));
  program
    .command("pods")
    .description("Install project Ruby dependencies and iOS pods on macOS")
    .action(async () => status(installPods()));
  program
    .command("devices")
    .description("List Android devices and iOS devices/simulators")
    .argument("[platform]")
    .option("--json", "machine-readable device list")
    .option("--emulators", "show only emulators/simulators")
    .action(async (value, options) => {
      const targets = value
        ? [platform(value)]
        : process.platform === "darwin"
          ? (["android", "ios"] as const)
          : (["android"] as const);
      const results = await Promise.allSettled(
        targets.map((target) => devicesFor(target, findProject()?.root)),
      );
      const devices = results
        .flatMap((result) =>
          result.status === "fulfilled" ? result.value : [],
        )
        .filter((device) => !options.emulators || device.kind !== "device");
      for (const result of results)
        if (result.status === "rejected") console.error(String(result.reason));
      if (options.json) console.log(JSON.stringify(devices, null, 2));
      else {
        for (const device of devices)
          console.log(
            `${device.id}  ${device.name}  ${device.platform}  ${device.kind}  ${device.state}`,
          );
        if (!devices.length)
          console.log("No devices found. Run rnx emulators or rnx setup.");
      }
      process.exitCode = results.every((result) => result.status === "rejected")
        ? 1
        : 0;
    });
  program
    .command("emulators")
    .description("List or launch Android AVDs and iOS simulators")
    .argument("[platform]")
    .option("--launch <id>", "Android AVD name or iOS simulator UDID/name")
    .action(async (value, options) => status(emulators(value, options)));
  for (const action of ["connect", "pair", "disconnect"] as const)
    program
      .command(action)
      .description(`${action} an Android Wi-Fi device using ADB`)
      .argument(
        "<address>",
        "host:port from the Android Wireless debugging settings",
      )
      .action(async (address) => status(androidConnection(action, address)));
  program
    .command("run")
    .description("Build, install, and launch on an Android or iOS device")
    .argument("[platform]")
    .argument("[nativeArgs...]", "extra Community CLI options after --")
    .option("--device <id>", "ADB serial or iOS UDID")
    .option("--port <number>", "Metro port", port)
    .option("--release")
    .option("--mode <name>", "native variant/configuration")
    .option("--scheme <name>", "Xcode scheme")
    .option("--no-packager", "use an already-running Metro")
    .option("--verbose")
    .option(
      "--binary <path>",
      "install an existing APK or iOS .app instead of compiling",
    )
    .action(async (value, extra, options) =>
      status(run(value, options, extra)),
    );
  program
    .command("build")
    .description(
      "Build APK, AAB, iOS app, or signed IPA; verify output artifacts",
    )
    .argument("<target>")
    .argument("[nativeArgs...]", "extra Gradle/Xcode options after --")
    .option("--release")
    .option("--mode <name>")
    .option("--scheme <name>")
    .option("--device <name>", "iOS physical device build destination")
    .option("--module <name>", "Android app module", "app")
    .option("--export-options <plist>", "Xcode IPA export options")
    .action(async (target, extra, options) =>
      status(build(target, options, extra)),
    );
  const addPackages = (parent: Command) => {
    parent
      .command("add")
      .description("Add packages with the project package manager")
      .argument("<packages...>")
      .option("-D, --dev")
      .option("--pm <manager>")
      .action(async (packages, options) =>
        status(managePackages("add", packages, options)),
      );
    parent
      .command("remove")
      .description("Remove packages with the project package manager")
      .argument("<packages...>")
      .option("--pm <manager>")
      .action(async (packages, options) =>
        status(managePackages("remove", packages, options)),
      );
  };
  addPackages(program);
  program
    .command("get")
    .description("Install project dependencies")
    .option("--pm <manager>")
    .action(async (options) => status(managePackages("get", [], options)));
  program
    .command("exec")
    .description("Run a package executable with npx from the project root")
    .argument("<package>")
    .argument("[args...]")
    .allowUnknownOption()
    .action(async (pkg, args) => {
      validatePackages([pkg]);
      await status(
        execute("npx", ["--yes", "--", pkg, ...args], findProject()?.root),
      );
    });
  const start = async (
    options: { port?: string; resetCache?: boolean },
    extra: string[],
  ) => {
    const project = requireProject();
    const metroPort = options.port ?? loadConfig(project.root).port;
    if (isExpoRouter(project.root)) {
      if (pendingExpoRouter(project.root)) throw new Error("Run rnx get to finish Expo Router setup.");
      await status(expo(["start", ...(metroPort ? ["--port", port(metroPort)] : []), ...(options.resetCache ? ["--clear"] : []), ...extra], project));
      return;
    }
    await status(
      community(
        [
          "start",
          ...(metroPort ? ["--port", port(metroPort)] : []),
          ...(options.resetCache ? ["--reset-cache"] : []),
          ...extra,
        ],
        project,
      ),
    );
  };
  program
    .command("start")
    .description("Run the project Metro server in the foreground")
    .argument("[nativeArgs...]")
    .option("--port <number>", "Metro port", port)
    .option("--reset-cache")
    .action(async (extra, options) => start(options, extra));
  const metro = program
    .command("metro")
    .description("Official Metro workflows");
  metro
    .command("start")
    .argument("[nativeArgs...]")
    .option("--port <number>", "Metro port", port)
    .option("--reset-cache")
    .action(async (extra, options) => start(options, extra));
  metro
    .command("status")
    .option("--port <number>", "Metro port", port)
    .action(async (options) => {
      const selected =
        options.port ?? loadConfig(requireProject().root).port ?? "8081";
      try {
        const response = await fetch(`http://127.0.0.1:${selected}/status`, {
          signal: AbortSignal.timeout(2000),
        });
        if (
          !response.ok ||
          (await response.text()).trim() !== "packager-status:running"
        )
          throw new Error("Not a Metro server");
        console.log(`Metro is running on port ${selected}.`);
      } catch {
        console.log(
          `No Metro server detected on port ${selected}. Run rnx start.`,
        );
        process.exitCode = 1;
      }
    });
  program
    .command("logs")
    .description("Stream Android logcat or iOS simulator/device console")
    .argument("[platform]")
    .option("--device <id>")
    .option(
      "--filter <text>",
      "logcat filters, react-native, or simulator message text",
    )
    .option("--clear", "clear Android logcat before streaming")
    .option("--bundle-id <id>", "physical iOS app console (relaunches app)")
    .action(async (value, options) => status(logs(value, options)));
  program
    .command("clean")
    .description("Preview and remove generated project builds/caches")
    .argument("[target]", "all, android, ios, metro", "all")
    .option("-y, --yes", "confirm displayed cleanup")
    .action(async (target, options) => status(clean(target, options)));
  program
    .command("info")
    .description(
      "Show project metadata and official React Native environment info",
    )
    .action(async () => {
      const project = requireProject();
      console.log(
        `${project.name}\nRoot: ${project.root}\nReact Native: ${project.reactNative}\nPackage manager: ${detectPackageManager(project.root)}`,
      );
      await status(community(["info"], project));
    });
  program
    .command("config")
    .description("Show the project native configuration from Community CLI")
    .action(async () => status(community(["config"])));
  for (const [command, script] of [
    ["test", "test"],
    ["analyze", "typecheck"],
  ] as const)
    program
      .command(command)
      .description(`Run the project ${script} script`)
      .argument("[args...]")
      .allowUnknownOption()
      .action(async (args) => {
        const project = requireProject();
        const manifest = JSON.parse(
          readFileSync(join(project.root, "package.json"), "utf8"),
        );
        if (!manifest.scripts?.[script])
          throw new Error(
            `Add a ${script} script to package.json to use rnx ${command}.`,
          );
        const pm = detectPackageManager(project.root);
        await status(
          execute(
            pm,
            [
              "run",
              script,
              ...(args.length && pm === "npm" ? ["--"] : []),
              ...args,
            ],
            project.root,
          ),
        );
      });
  return program;
}

