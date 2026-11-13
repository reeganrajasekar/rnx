# RNX --- Flutter-like Developer Experience for React Native

**Project name:** RNX\
**Meaning:** React Native eXperience\
**Scope:** CLI + reusable project templates\
**Platforms:** Android + iOS\
**Core principle:** Keep the official React Native ecosystem underneath
(React Native Community CLI, Metro, Gradle, Xcode, ADB). Make the
developer interact with RNX instead of managing individual tools.

------------------------------------------------------------------------

## 1. Product vision

RNX is an independent, open-source CLI and project toolkit that makes
React Native development feel as simple as Flutter.

It is not a new React Native framework and does not replace Metro. It is
a developer-experience and orchestration layer around standard React
Native projects.

### Primary goals

-   One-command project creation, development, debugging, and builds.
-   Automatically detect project configuration and installed tools.
-   Automatically manage the normal Metro development workflow.
-   Detect and select connected devices.
-   Provide clear diagnostics and actionable error messages.
-   Support standard React Native projects, not only RNX-created
    projects.
-   Work across Windows, macOS, and Linux where the underlying platform
    supports it.
-   Keep native configuration transparent and avoid unnecessary
    modifications.

### Example developer experience

``` bash
rnx create MyApp
cd MyApp

rnx doctor
rnx devices
rnx run

rnx build apk
rnx build aab
rnx clean
```

The developer should not need to remember long combinations of Community
CLI, ADB, Metro, and Gradle commands for common tasks.

------------------------------------------------------------------------

## 2. Design principles

  Principle            Implementation
  -------------------- --------------------------------------------------
  One command          `rnx run`
  Official tooling     Use Community CLI, Metro, Gradle, Xcode, and ADB
  Minimal setup        Detect tools and explain missing requirements
  Cross-platform       Windows, macOS, and Linux CLI
  Developer-friendly   Clear output, progress, and error explanations
  Extensible           Templates, build profiles, and future plugins
  Non-invasive         Avoid unnecessary native project modifications
  Compatible           Support ordinary React Native projects

RNX should reuse the project's installed tools and compatible versions.
It must not blindly install a second CLI or a different Metro version.

------------------------------------------------------------------------

## 3. High-level architecture

``` text
                         RNX CLI
             Commands · UI · Diagnostics
                           |
          +----------------+----------------+
          |                |                |
     Project Manager   Development      Build Engine
     Templates         Metro Manager     APK / AAB / iOS
     Config            Device Manager    Build Profiles
          |                |                |
          +----------------+----------------+
                           |
                     Tool Adapters
                           |
       +-------------------+--------------------+
       |                   |                    |
 React Native CLI        Metro            Native tooling
                                             |
                                +------------+-----------+
                                |            |           |
                               ADB         Gradle      Xcode
                                |            |           |
                             Android      Android       iOS
                             devices       builds      builds
```

### Core modules

  -----------------------------------------------------------------------
  Module                              Responsibility
  ----------------------------------- -----------------------------------
  CLI                                 Parse commands and arguments

  Core                                Shared context, logging, errors,
                                      process execution

  Project                             Detect React Native project roots
                                      and metadata

  Doctor                              Check development environment and
                                      dependencies

  Devices                             Discover and select Android/iOS
                                      devices

  Development                         Run applications and manage
                                      development sessions

  Metro                               Manage or inspect the Metro
                                      development server

  Build                               APK, AAB, iOS builds, and build
                                      profiles

  Templates                           Project creation and scaffolding

  Config                              Load and validate RNX configuration

  Cache                               Clean project and development
                                      caches

  Adapters                            Integrate Community CLI, Metro,
                                      ADB, Gradle, Xcode, CocoaPods
  -----------------------------------------------------------------------

### Adapter-based design

Commands should depend on interfaces/adapters rather than directly
invoking native tools throughout the codebase.

Example:

``` text
rnx run android
       |
       v
    RunCommand
       |
       v
   DeviceManager
       |
       v
 AndroidAdapter
       |
       v
 Community CLI
       |
       v
 Gradle + Metro + ADB
```

This makes internal implementations replaceable without changing the
public command interface.

------------------------------------------------------------------------

## 4. Technology stack

  Technology       Purpose
  ---------------- ---------------------------------
  TypeScript       CLI implementation
  Node.js          Runtime
  pnpm             Monorepo and package management
  Commander.js     Command parsing
  @clack/prompts   Interactive terminal prompts
  Execa            Native process execution
  Ora              Progress indicators
  picocolors       Terminal colors
  Zod              Configuration validation
  Conf             Global settings
  find-up          Project discovery
  Vitest           Unit and integration tests

Keep version 1 deliberately small. Add abstractions only when they solve
a concrete problem.

### Dependency strategy

-   Prefer the project's local React Native Community CLI.
-   Respect the Community CLI / React Native compatibility matrix.
-   Detect the project's package manager and lockfile.
-   Resolve local project binaries before using global fallbacks.
-   Do not independently upgrade Metro or Community CLI.
-   Preserve the project's Metro configuration.
-   Do not replace the official native build systems.

------------------------------------------------------------------------

## 5. Repository structure

Use a pnpm monorepo. Initially, publish one CLI package and keep the
other packages internal workspace packages. Extract additional npm
packages only when useful.

``` text
rnx/
├── apps/
│   └── docs/
│
├── packages/
│   ├── cli/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── cli.ts
│   │   │   ├── commands/
│   │   │   │   ├── create.ts
│   │   │   │   ├── doctor.ts
│   │   │   │   ├── devices.ts
│   │   │   │   ├── run.ts
│   │   │   │   ├── build.ts
│   │   │   │   ├── clean.ts
│   │   │   │   ├── logs.ts
│   │   │   │   ├── info.ts
│   │   │   │   ├── upgrade.ts
│   │   │   │   └── metro.ts
│   │   │   └── ui/
│   │   │       ├── banner.ts
│   │   │       ├── prompts.ts
│   │   │       ├── progress.ts
│   │   │       └── output.ts
│   │   └── package.json
│   │
│   ├── core/
│   │   └── src/
│   │       ├── context.ts
│   │       ├── logger.ts
│   │       ├── errors.ts
│   │       ├── process.ts
│   │       └── config.ts
│   │
│   ├── doctor/
│   │   └── src/
│   │       ├── checks/
│   │       │   ├── node.ts
│   │       │   ├── java.ts
│   │       │   ├── android-sdk.ts
│   │       │   ├── xcode.ts
│   │       │   ├── cocoapods.ts
│   │       │   ├── watchman.ts
│   │       │   └── react-native.ts
│   │       └── runner.ts
│   │
│   ├── devices/
│   │   └── src/
│   │       ├── android.ts
│   │       ├── ios.ts
│   │       └── selector.ts
│   │
│   ├── adapters/
│   │   └── src/
│   │       ├── community-cli.ts
│   │       ├── metro.ts
│   │       ├── adb.ts
│   │       ├── gradle.ts
│   │       ├── xcode.ts
│   │       └── cocoapods.ts
│   │
│   ├── templates/
│   │   ├── default/
│   │   ├── minimal/
│   │   ├── production/
│   │   └── template.config.js
│   │
│   └── config/
│       └── src/
│           ├── schema.ts
│           └── loader.ts
│
├── examples/
│   └── basic-app/
├── scripts/
├── tests/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.config.ts
├── LICENSE
└── README.md
```

------------------------------------------------------------------------

## 6. Command specifications

### 6.1 Project creation

``` bash
rnx create MyApp
rnx create MyApp --template minimal
rnx create MyApp --platform both
rnx create MyApp --version <react-native-version>
```

Creation workflow:

1.  Validate project name and destination.
2.  Select React Native version.
3.  Select template.
4.  Detect package manager.
5.  Generate the project using the official Community CLI initialization
    mechanism and an RNX template.
6.  Install dependencies.
7.  Install iOS pods when running on macOS, if requested and applicable.
8.  Optionally initialize Git.
9.  Run basic project and environment validation.

Do not implement a separate native project generator. Use the official
Community CLI template mechanism.

### 6.2 Environment diagnostics

``` bash
rnx doctor
rnx doctor --verbose
rnx doctor --fix
```

Checks should include:

**General** - Node.js version - npm, pnpm, or Yarn - Project package
manager - React Native version - Community CLI compatibility - Required
project dependencies

**Android** - Java version - Android SDK - Android SDK environment
variables - ADB - Android build tools - Emulator availability

**iOS** - macOS availability - Xcode and command-line tools -
CocoaPods - iOS simulator availability

**Project** - React Native project detection - Dependencies installed -
Metro configuration present and valid - Native project directories
present

Example output:

``` text
RNX Doctor

Environment
  ✓ Node.js
  ✓ Package manager
  ✓ React Native detected

Android
  ✓ Java
  ✓ Android SDK
  ✓ ADB
  ✓ Emulator tools

iOS
  ! macOS not available
  ! Xcode not available

Result: Android environment ready.
```

`--fix` must only perform safe repairs and must explain proposed changes
before execution. It must not silently install or modify system-wide
tools.

### 6.3 Device management

``` bash
rnx devices
rnx devices android
rnx devices ios
rnx devices --emulators
```

Expected behaviour:

-   One connected device: select automatically.
-   Multiple devices: display an interactive picker.
-   No devices: explain how to start an emulator or connect a physical
    device.
-   `--device <id>`: select a specific device without prompting.

Example:

``` text
Connected devices

  1. Pixel 8       Android   USB
  2. Samsung S24   Android   USB
  3. Pixel_Emu     Android   Emulator

Select a device:
```

Use ADB for Android device discovery and supported Apple tooling for iOS
device/simulator discovery.

### 6.4 Development

``` bash
rnx run
rnx run android
rnx run ios
rnx run android --device <id>
rnx run --port 8082
rnx run --reset-cache
```

Expected workflow:

1.  Detect the React Native project root.
2.  Validate project dependencies.
3.  Resolve platform.
4.  Discover connected devices.
5.  Select a device.
6.  Invoke the official development workflow.
7.  Build the debug application.
8.  Install and launch it.
9.  Use the normal React Native Fast Refresh workflow.

**Metro ownership in the MVP:** Let the Community CLI manage Metro
during `run-android` and `run-ios`. Do not start a second Metro process.
Add a dedicated Metro manager later for advanced workflows.

`rnx run` should select the configured default platform or ask the
developer when it cannot determine one safely.

### 6.5 Build

``` bash
rnx build apk
rnx build aab
rnx build ios

rnx build apk --profile release
rnx build apk --profile staging
rnx build aab --profile production
```

Suggested implementation:

  Target                Underlying implementation
  --------------------- ----------------------------------
  Android debug         Community CLI / Gradle
  Android release APK   Gradle `assembleRelease`
  Android release AAB   Gradle `bundleRelease`
  iOS simulator         Community CLI / Xcode
  iOS archive/export    Xcode archive and export tooling

Expected output:

``` text
Building Android APK...

  ✓ Preparing build
  ✓ Compiling native code
  ✓ Packaging application

Build successful!

Output:
  android/app/build/outputs/apk/release/app-release.apk
```

RNX must report the actual artifact path discovered after a successful
build. Do not assume that an artifact exists just because the build
command exited successfully.

iOS native builds require macOS and Xcode. On Windows/Linux, RNX may
create and manage iOS project files, but it cannot locally perform
native iOS builds.

### 6.6 Logs and debugging

``` bash
rnx logs
rnx logs android
rnx logs ios
rnx metro status
rnx metro start
rnx metro stop
rnx metro restart
```

Logs should:

-   Detect the selected platform.
-   Stream native logs.
-   Support `--device`, `--filter`, and `--clear`.
-   Filter React Native messages when requested.
-   Preserve access to unfiltered native output.

Metro commands must operate on the official Metro server and project
configuration. Avoid launching duplicate servers or changing the
project's Metro configuration unexpectedly.

### 6.7 Maintenance

``` bash
rnx clean
rnx clean metro
rnx clean android
rnx clean ios
rnx clean all

rnx info
rnx upgrade
```

`rnx clean` should preview its actions and request confirmation for
destructive operations.

Safe defaults: - Clean Metro cache. - Clean Android build output. -
Clean iOS build output where supported.

Do not remove `node_modules`, lockfiles, Pods, signing files, or user
data by default. Require explicit options and confirmation for more
destructive cleanup.

### 6.8 Global commands

``` bash
rnx --version
rnx --help
rnx update
rnx config
```

Global preferences should be stored in the user's OS-specific
configuration directory, separately from project configuration.

------------------------------------------------------------------------

## 7. Project configuration

RNX may support an optional `rnx.config.ts` in the project root.

Example:

``` typescript
import { defineConfig } from "rnx";

export default defineConfig({
  name: "MyApp",

  platforms: ["android", "ios"],

  development: {
    port: 8081,
    fastRefresh: true,
    resetCache: false,
  },

  devices: {
    autoSelect: true,
  },

  build: {
    defaultProfile: "debug",

    profiles: {
      debug: {
        mode: "debug",
      },

      staging: {
        mode: "release",
        applicationIdSuffix: ".staging",
      },

      production: {
        mode: "release",
      },
    },
  },
});
```

The `defineConfig` helper should provide TypeScript autocomplete and
validation.

Important: RNX configuration controls RNX behaviour. It must not replace
or duplicate actual Gradle, Xcode, or Metro configuration.

Example global configuration:

``` json
{
  "packageManager": "auto",
  "defaultPlatform": "android",
  "defaultDevice": "auto",
  "metroPort": 8081,
  "interactive": true,
  "colors": true,
  "telemetry": false
}
```

------------------------------------------------------------------------

## 8. Template system

Provide three initial templates.

### Default template

-   TypeScript
-   Android and iOS
-   Small starter screen
-   Sensible folder structure
-   Official Metro defaults
-   Minimal dependencies

### Minimal template

-   Bare React Native
-   TypeScript
-   No unnecessary libraries
-   Suitable for experienced developers

### Production template

-   Feature-oriented folder structure
-   Navigation
-   API client
-   Environment management
-   Error handling
-   Testing setup

Keep the default template small. Avoid making every app depend on a
large collection of third-party libraries.

Suggested application structure:

``` text
MyApp/
├── src/
│   ├── components/
│   ├── screens/
│   ├── navigation/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   ├── theme/
│   └── types/
├── android/
├── ios/
├── App.tsx
├── index.js
├── rnx.config.ts
├── metro.config.js
├── tsconfig.json
└── package.json
```

Templates should use the official Community CLI template mechanism so
that native project generation remains aligned with React Native.

------------------------------------------------------------------------

## 9. Error handling and developer experience

RNX should translate common failures into useful explanations without
hiding the original error.

Example raw error:

``` text
Execution failed for task ':app:installDebug'.
Process finished with non-zero exit value 1.
```

Improved RNX output:

``` text
Build failed: Application installation failed.

Possible causes:
  1. Insufficient device storage.
  2. Existing app has a different signing key.
  3. Device is disconnected.

Suggested actions:
  rnx devices
  rnx logs android

Run with --verbose to see the original native output.
```

Create a structured error catalog containing:

-   Error identifier
-   Original error and exit code
-   Human-readable explanation
-   Possible causes
-   Suggested commands
-   Documentation link

Do not claim a cause is certain unless it has been verified. Always
retain a way to access the original tool output.

------------------------------------------------------------------------

## 10. Testing strategy

  Test category   Validation
  --------------- ----------------------------------------------------
  Unit            Configuration, parsing, validation
  Integration     Community CLI adapters
  Process         Process execution, cancellation, exit codes
  Device          ADB and iOS device discovery
  Build           APK/AAB command invocation and output verification
  Template        Project generation and dependency installation
  E2E             Create → run → build
  Compatibility   Windows, macOS, Linux

Use Vitest for unit and integration tests.

Use CI environments with Android SDK for Android workflows and
macOS/Xcode runners for iOS workflows.

Test against a deliberate matrix of supported React Native and Community
CLI versions. Do not claim broad compatibility without testing.

------------------------------------------------------------------------

## 11. Implementation roadmap

### Phase 1 --- CLI foundation

-   Set up pnpm monorepo.
-   Configure TypeScript.
-   Create CLI entry point.
-   Add Commander.js.
-   Implement terminal UI and logging.
-   Implement project detection.
-   Implement `rnx --help`.
-   Implement `rnx --version`.

**Deliverable:** A working npm CLI package.

### Phase 2 --- Environment and devices

-   Implement `rnx doctor`.
-   Add Node, Java, Android SDK checks.
-   Add Xcode and CocoaPods checks.
-   Implement `rnx devices`.
-   Add device selection.
-   Add actionable diagnostics.

**Deliverable:** Reliable environment diagnostics and device discovery.

### Phase 3 --- Development engine

-   Implement `rnx run`.
-   Add Android launch.
-   Add iOS launch.
-   Integrate Metro through Community CLI.
-   Validate Fast Refresh.
-   Add logs and error handling.

**Deliverable:** A Flutter-like development workflow.

### Phase 4 --- Build engine

-   Implement APK build.
-   Implement AAB build.
-   Implement iOS build on macOS.
-   Add build profiles.
-   Discover and verify output artifacts.
-   Document signing configuration.

**Deliverable:** One-command native builds.

### Phase 5 --- Templates and maintenance

-   Implement default template.
-   Implement minimal template.
-   Implement production template.
-   Add `rnx clean`.
-   Add `rnx info`.
-   Add `rnx upgrade`.

**Deliverable:** Complete project lifecycle.

### Phase 6 --- Release and ecosystem

-   Documentation website.
-   npm publishing.
-   GitHub Actions.
-   Cross-platform testing.
-   Version compatibility matrix.
-   Template and plugin ecosystem.

**Deliverable:** Public open-source project.

------------------------------------------------------------------------

## 12. MVP release scope

Do not wait for every planned feature before publishing the first usable
release.

### RNX v0.1.0

``` bash
rnx create MyApp
rnx doctor
rnx devices
rnx run
rnx run android
rnx run ios
rnx build apk
rnx build aab
rnx clean
rnx info
```

### Release acceptance criteria

-   [ ] CLI installs and runs on Windows, macOS, and Linux.
-   [ ] Android development works on all three operating systems when
    Android prerequisites are installed.
-   [ ] iOS development and native builds work on macOS with Xcode.
-   [ ] Existing standard React Native projects are supported.
-   [ ] No Expo dependency.
-   [ ] Metro remains the bundler.
-   [ ] Community CLI remains the React Native command implementation.
-   [ ] Clear errors are shown when tools are missing.
-   [ ] Create → run → build workflow passes in CI.
-   [ ] Build artifacts are verified before reporting success.
-   [ ] Original native tool output remains accessible.

### Compatibility strategy

Maintain a tested compatibility matrix rather than tying RNX to a single
React Native release.

  RNX version   React Native                 Community CLI
  ------------- ---------------------------- ------------------------
  0.1.x         Explicitly tested versions   Compatible versions
  0.2.x         Expanded tested versions     Compatible versions
  Future        Updated support              Verified compatibility

Use the official Community CLI compatibility matrix as the source of
truth. Test supported combinations in CI.

------------------------------------------------------------------------

## 13. Recommended implementation decisions

  Decision             Choice
  -------------------- ----------------------------------
  Project name         RNX
  CLI executable       `rnx`
  Language             TypeScript
  Runtime              Node.js
  Package manager      pnpm
  Architecture         Modular monorepo
  CLI framework        Commander.js
  Terminal UI          Clack
  Process execution    Execa
  Native tooling       Official React Native ecosystem
  Bundler              Metro
  Project generation   Community CLI template mechanism
  Configuration        Optional `rnx.config.ts`
  Telemetry            Disabled by default
  License              MIT
  Distribution         npm

Keep the executable name `rnx`, but verify npm package-name availability
before publishing. If needed, publish under an npm scope while retaining
the `rnx` executable name.

------------------------------------------------------------------------

## 14. First implementation milestone

Start by creating the monorepo and implementing a small but working CLI.

The first milestone must:

1.  Display an RNX banner.
2.  Detect the current React Native project.
3.  Run environment diagnostics.
4.  List connected Android devices.
5.  Execute `rnx run android`.
6.  Preserve original Community CLI output and exit codes.

Then expand the implementation based on real workflows.

**Prioritize `rnx run` and `rnx doctor`.** Those two commands will
determine whether RNX genuinely feels like Flutter or merely becomes
another CLI wrapper.

------------------------------------------------------------------------

## 15. Official references

-   React Native environment setup:
    https://reactnative.dev/docs/environment-setup
-   React Native Community CLI:
    https://github.com/react-native-community/cli
-   Metro documentation: https://reactnative.dev/docs/metro
-   Metro configuration: https://metrobundler.dev/docs/configuration
-   Node.js child processes: https://nodejs.org/api/child_process.html
-   pnpm workspaces: https://pnpm.io/workspaces
-   Commander.js: https://github.com/tj/commander.js
-   Execa: https://github.com/sindresorhus/execa

------------------------------------------------------------------------

## Final product statement

**RNX --- A Flutter-like developer experience for React Native, powered
by the official React Native ecosystem.**

Keep React Native. Keep Metro. Keep native tooling.

Make everyday development simple.
