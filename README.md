# RNX

A Flutter-style command-line workflow for standard React Native projects, powered by the project's Community CLI, Metro, Gradle, ADB, and Xcode.

## Quick start

RNX requires Node.js 20.19 or newer. Your selected React Native version may require a newer Node version. Develop RNX with pnpm 10:

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
node packages/cli/dist/index.js --help
```

To use the local package without publishing it:

```sh
pnpm --filter @rnx/cli pack
# Use the absolute path of the tarball printed by pack:
npm install --global /path/to/rnx-cli-0.2.0.tgz
# Or run without a global install:
npx --yes --package /path/to/rnx-cli-0.2.0.tgz rnx --help
```

The npm scope is provisional; this repository has not been published to npm. The binary is `rnx`.

```sh
rnx create MyApp
cd MyApp
rnx setup android
rnx doctor android
rnx emulators android
rnx emulators android --launch Pixel_API_35
rnx run android
```

`create` (also `init`) generates Android and iOS projects with the official Community CLI. In a terminal, choose a router, state store, React Native version, and package manager; the newest version is marked **Latest**. App code and selected stores live under `src`. Expo Router is added to this bare project using Expo modules and Expo's Metro tooling. Its stable SDK compatibility currently covers React Native 0.83, 0.85, 0.86 and 0.88. React Navigation supports React Native 0.76–0.88. Custom templates keep their own setup. Non-interactive defaults are no router, no store, and npm.

Interactive project creation also asks whether to use standard React Native styles or NativeWind (Tailwind CSS classes). NativeWind installs and configures NativeWind 4, Tailwind CSS, Babel, Metro, and TypeScript types. Select it with `--styling nativewind`; standard styles remain the default for non-interactive creation. NativeWind requires React Native 0.76 or newer.

With `--no-install`, Expo Router's native integration is deferred; run `rnx get` to finish it. On macOS, Expo's installer runs CocoaPods; run `rnx pods` after router dependencies are installed. `rnx start` and `rnx run` use Expo CLI for Expo Router projects. Extra Community CLI arguments and `--verbose` are not supported by this adapter. Projects keep their native Android and iOS directories; Expo prebuild is not required.

```sh
rnx create MyApp --pm pnpm
rnx create MyApp --router react-navigation --store redux --pm pnpm
rnx create MyApp --router expo-router --store jotai --pm pnpm
rnx create MyApp --version 0.85.0
rnx create MyApp --template some-community-template --directory ./apps/MyApp
rnx create MyApp --pods                 # macOS only
```

Explicit RN versions 0.76–0.89 select the matching CLI major from the [official compatibility matrix](https://github.com/react-native-community/cli/tree/main/packages/cli#compatibility). Other RN versions or tags require an explicit `--cli-version`. Without `--version`, RNX looks up the latest stable React Native version to select a compatible initializer. RNX never upgrades the CLI inside an existing project independently.

## Staging a React Native upgrade

```sh
rnx upgrade 0.88.1
rnx upgrade 0.88.1 --directory ../MyApp-upgrade
```

The project must be the root of a clean Git repository, with no untracked files or conflicting lockfiles. RNX generates the official target template, creates a separate Git worktree and branch, updates existing React Native core dependencies to the template's versions, and resolves dependencies there with lifecycle scripts disabled. The original worktree stays unchanged; ignored files such as local secrets and configuration are not copied. The command prints the worktree location and an Upgrade Helper link.

This is a **staged dependency upgrade**, not a complete application upgrade. Review and apply native/template changes, investigate third-party package compatibility and any installer errors, run a normal install and iOS pods as appropriate, and test the app on its supported platforms before merging. No CLI can guarantee that application behavior or all packages remain compatible. Expo projects use the [Expo SDK upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/); `rnx upgrade` does not modify them.

See [tooling analysis](docs/tooling-analysis.md) for Ignite, Community CLI, Metro, debugging, and boilerplate tradeoffs.

## Everyday commands

| Task | Command |
| --- | --- |
| Diagnose host/project | `rnx doctor [android\|ios] --verbose` |
| Install Windows Android tools | `rnx boom` |
| Setup instructions | `rnx setup [android\|ios]` |
| Install project dependencies and iOS gems/pods | `rnx setup ios --install` |
| List physical/virtual devices | `rnx devices [android\|ios]` |
| Device JSON | `rnx devices --json` |
| List/start virtual devices | `rnx emulators android --launch <AVD>` / `rnx emulators ios --launch <UDID>` |
| Build/install/launch | `rnx run [android\|ios] --device <id>` |
| Release run | `rnx run ios --release --scheme MyApp` |
| Install an existing build | `rnx run android --binary ./app-debug.apk` |
| Start Metro | `rnx start --port 8082 --reset-cache` |
| Check Metro | `rnx metro status --port 8082` |
| Native logs | `rnx logs android --device <id> --filter react-native` |
| Android build | `rnx build apk --release` / `rnx build aab` |
| iOS build | `rnx build ios --scheme MyApp --release` |
| Signed IPA | `rnx build ipa --scheme MyApp --export-options ./ExportOptions.plist` |
| Clear generated files | `rnx clean [all\|android\|ios\|metro]` |
| Environment/native config | `rnx info` / `rnx config` |
| Tests / static analysis | `rnx test` / `rnx analyze` (project scripts) |

`rnx boom` installs and configures Android development tools on Windows, even outside a project. It uses WinGet to install Android Studio and JDK 17 when missing, installs Google's SDK command-line tools if needed, and uses SDK Manager to install platform-tools, emulator, a platform and build-tools. It saves `JAVA_HOME` and `ANDROID_HOME` for the current user. Open a new terminal afterward. Installer elevation and license prompts may require interaction. It reads literal SDK versions from `android/build.gradle` when available; otherwise it uses platform 35 and build-tools 36.0.0. Create an Android virtual device in Android Studio or connect a physical device. Run `rnx doctor` for diagnostics without installing anything. macOS and Linux automatic installation are not yet supported.

Commands can run from any directory inside a React Native project. One ready device is selected automatically; several devices prompt interactively. Non-interactive sessions require `--device`. Devices that are offline, unauthorized, or unavailable are shown and rejected for runs. `run` without a platform uses saved defaults, the sole supported platform, or a prompt. Use `--` for additional native options:

```sh
rnx run android --device emulator-5554 -- --active-arch-only
rnx run ios -- --force-pods
rnx build apk --mode stagingRelease
rnx build apk --module mobile -- --stacktrace
rnx test -- --watch
```

For standard React Native projects, interactive debug `rnx run` keeps Metro in the same terminal: `r` reloads JavaScript, `R` rebuilds and restarts the app, `h` shows the keys, and `q` or Ctrl-C ends the session. Android runs also stream React Native JavaScript logs and native warnings from the selected device; the stream can include messages from other React Native apps on that device. React Native Fast Refresh updates supported edits automatically; `r` is a full JavaScript reload and may reset state. RNX reuses an existing Metro on the selected port without stopping it, so ensure it belongs to the same project. `--no-packager`, release builds, and non-interactive runs do not start Metro or the log stream. Expo Router runs use Expo CLI's own terminal controls and logs. `start`/`metro start` remain foreground official Metro sessions. Builds retain native output/exit codes and verify the resulting artifact paths. APK defaults to debug, AAB and IPA to release. Android signing and flavors remain in Gradle; iOS signing and schemes remain in Xcode. Custom Android app modules use `--module`; automatic discovery assumes standard native directories. IPA export expects one workspace/project under `ios`.

## Packages and npx

```sh
rnx add react-native-device-info
rnx add -D prettier
rnx remove old-package
rnx get
rnx exec some-package -- --help         # npx downloads/runs its executable
```

Package commands use the selected package manager, preserving its lockfile and autolinking. RNX detects project/workspace `packageManager` and lockfiles, and refuses conflicting lockfiles. Override with `--pm npm|pnpm|yarn|bun`. Native package changes require a rebuild; on macOS, run `rnx pods` for iOS. `exec` runs code from the named package via npx.

## Android devices

Install Android Studio, the project JDK, Android SDK/platform-tools/build-tools, and emulator images. RNX looks for the SDK in environment variables, project `android/local.properties`, and common OS locations, so ADB/emulator need not be on PATH when found in the SDK. RNX passes the discovered SDK location to native child processes, and recognizes JAVA_HOME for Java diagnostics. Gradle keeps its normal Java and signing configuration.

For USB, enable Developer options and USB debugging, then accept the authorization prompt. For Android Wireless debugging, pair and connect with the distinct addresses displayed by the device:

```sh
rnx pair 192.168.1.20:37123
rnx connect 192.168.1.20:40211
rnx devices android
rnx run android --device 192.168.1.20:40211
rnx disconnect 192.168.1.20:40211
```

The pairing code is entered directly into ADB's prompt. Android Studio Device Manager creates AVDs; RNX lists and launches them.

## iOS setup and devices

iOS native commands run on **macOS with full Xcode**. Android commands run on Windows, macOS, and Linux with the native prerequisites. Shared code and both native project directories can be created on any of these hosts.

1. Install/open Xcode, finish its initial setup/license steps, and select its command-line tools in Xcode Settings > Locations.
2. Install an iOS simulator runtime in Xcode Settings > Components/Platforms.
3. Install the Ruby/Bundler version required by the project Gemfile. `rnx setup ios --install` installs JS dependencies, runs `bundle install`, then `bundle exec pod install`. With no Gemfile it uses installed CocoaPods.
4. For a physical iPhone/iPad: connect or pair through Xcode, trust the Mac, enable Developer Mode, and configure a signing team and bundle ID in Xcode Signing & Capabilities. RNX preserves those settings.

```sh
rnx doctor ios
rnx devices ios
rnx emulators ios --launch <simulator-UDID>
rnx run ios --device <simulator-or-physical-device-UDID>
rnx pods
rnx build ios --device 'My iPhone' --scheme MyApp --release
```

Simulators, iPhones, and iPads are selected by UDID; shutdown available simulators can be started by the Community CLI during `run`. Physical devices must be paired, trusted, unlocked, and provisioned. Setup explains missing system tools; it does not silently install global software or change shell profiles, Xcode selection, licenses, or signing.

```sh
rnx logs ios --device <booted-simulator-UDID> --filter MyMessage
rnx logs ios --device <physical-UDID> --bundle-id com.example.MyApp
```

Physical console streaming relaunches the app and requires Xcode 16+ `devicectl --console`; it captures app stdout/stderr. Use Apple's Console app for physical-device system logs. Simulator logs use `simctl log stream`. Android log filters accept `react-native` or logcat filters such as `ReactNativeJS:V *:S`; `--clear` clears Android logcat first.

## Project defaults and cleanup

Optional `rnx.config.json`:

```json
{
  "defaultPlatform": "android",
  "port": 8081,
  "packageManager": "pnpm"
}
```

RNX validates platform/port and uses this optional package-manager preference before lockfile detection. Existing standard React Native projects need no RNX config. RNX does not replace native or Metro configuration. TypeScript config/build profiles and managed background Metro sessions from the blueprint are not implemented yet.

`clean` previews project build/cache paths and asks for confirmation. `--yes` confirms that preview in scripts. It preserves dependencies, lockfiles, Pods, signing, and device/user data, rejects symlink escapes, and leaves system-wide caches alone. Metro cache reset uses `rnx start --reset-cache`.

## Validation

Unit/integration tests cover command parsing, project and device discovery, package managers, Android/iOS adapter arguments, CocoaPods errors, process exits, artifact verification, and cleanup containment. CLI CI is configured for Windows, macOS, and Linux. The manual Native workflow smoke test creates RN 0.85 projects and exercises Android emulator and iOS simulator run/build workflows; it has not been executed from this checkout. Real initializer smoke checks use the official template. Native Android/iOS builds, signing, and hardware runs still require validation with actual SDK/Xcode installations and devices; a comprehensive React Native version/device matrix is not claimed.

References: [RNX blueprint](RNX-Project-Blueprint.md), [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment), [Community CLI commands](https://github.com/react-native-community/cli/blob/main/docs/commands.md), [Apple command-line tools](https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference).
