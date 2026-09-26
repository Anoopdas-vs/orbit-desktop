# Janki Phase 1 Implementation Plan — Core Native Desktop Foundation

**Target Milestone**: Phase 1 — Native Desktop Foundation & Hardening  
**Objective**: Transform Janki from a development-server web prototype into a genuine, secure, standalone, offline-capable macOS application whose existing capabilities execute through a reliable native Rust/Tauri architecture.  
**Rule**: Strict planning and architecture only. Zero feature creep.

---

## 1. Executive Summary

In Phase 0, the system audit revealed that Janki's system automation layer operates through an unauthenticated Node.js HTTP bridge inside the Vite development server on port 5173 (`src/server/macos-bridge-plugin.ts`), while the native Tauri backend (`src-tauri/src/main.rs`) is an empty boilerplate. Furthermore, `server.host = true` exposes the native execution endpoints to the local network (LAN), and skills return synthetic success mocks when the bridge is unreachable.

**Phase 1 resolves this foundational architecture gap.** It replaces the Vite dev-server HTTP bridge with a hardened, strongly typed **Tauri v2 IPC Native Bridge** implemented in Rust (`src-tauri`), binds the development server strictly to loopback (`127.0.0.1`), establishes reliable offline database persistence, eliminates deceptive testing mocks, unifies project identity to **Janki**, and produces an independently executable, standalone macOS `.app` bundle.

---

## 2. Phase 1 Scope

Phase 1 encompasses six core engineering pillars:
1. **Security Hardening**: Bind Vite dev server strictly to `127.0.0.1`; eliminate unauthenticated LAN access; implement strict input validation and boundary checks on all native commands.
2. **Native Tauri v2 IPC Bridge**: Implement native Rust command handlers (`#[tauri::command]`) for process execution, app launching, URL opening, system queries, and AppleScript automation.
3. **Standalone macOS Application**: Configure Tauri v2 to build an autonomous macOS application bundle (`.app`) that runs independently with zero external servers.
4. **Reliable Database Persistence**: Establish an offline-first, local database solution that operates with zero CDN dependencies and guarantees data durability across restarts.
5. **Truthful Testing Infrastructure**: Redesign the testing architecture to strictly decouple real native execution from simulated test mocks; ensure mocks never falsely claim `executed: true`.
6. **Brand & Identity Unification**: Eliminate legacy "Orbit" references across package configurations, Cargo manifests, storage keys, and UI components.

---

## 3. Explicitly Out of Scope

To prevent scope creep and ensure rock-solid stabilization, the following are strictly deferred to future phases:
- **No New AI Agent / LLM Planning**: No autonomous agent loops, ReAct engines, or multi-step planners (Phase 3).
- **No Local Whisper Audio Engine**: No `whisper.cpp` Metal integration or custom DSP models (Phase 2).
- **No Custom Offline Wake-Word**: No Picovoice/openWakeWord native integration (Phase 2).
- **No Screen Vision / Perception**: No OmniParser, screenshot OCR, or CoreGraphics coordinate mapping (Phase 4).
- **No New Trading Capabilities**: No live exchange order submission, API key management, or WebSocket order book feeds (Phase 5).
- **No New Skills or Domain Automations**: Only migrate and preserve existing skills.

---

## 4. Current Architecture Dependencies vs. Target Architecture

### Current Vulnerable Architecture (Phase 0)
```
[React 18 Frontend UI]
        │
        ▼ (HTTP fetch to http://localhost:5173/api/macos/*)
[Vite Dev Server Plugin] ◄── [EXPOSED TO ENTIRE LAN (0.0.0.0)]
        │
        ├─ Node.js child_process.execFile
        └─ osascript
                 │
                 ▼
          [macOS System]
```
*Failure Mode*: When packaged via `tauri build`, Vite does not exist; all `/api/macos/*` calls fail immediately.

### Target Hardened Architecture (Phase 1)
```
[React 18 Frontend UI]
        │
        ▼ (Tauri IPC: window.__TAURI_INTERNALS__.invoke)
[Tauri v2 IPC Dispatcher] (Restricted to internal webview context)
        │
        ▼ (Strict Rust Struct Deserialization & Allowlist Validation)
[src-tauri/src/commands/*.rs]
        │
        ├─ process.rs    ──► tokio::process::Command (Allowlisted binaries)
        ├─ app_launch.rs ──► NSWorkspace / /usr/bin/open
        ├─ system.rs     ──► sysinfo / std::fs
        ├─ gui.rs        ──► osascript / System Events (Sanitized)
        └─ db.rs         ──► Local SQLite Persistence
                 │
                 ▼
          [macOS System]
                 │
                 ▼
   [Verified Output & Exit Code]
                 │
                 ▼
[Frontend Typed Result via IPC]
```

---

## 5. Workstreams

### Workstream 1: Security Hardening

#### 1. Vite Configuration Hardening
- **Target File**: `vite.config.ts`
- **Actions**:
  - Set `server.host = '127.0.0.1'` (strictly bind to IPv4 loopback; eliminate `host: true` / `0.0.0.0`).
  - Remove `cors: true` and `allowedHosts: true`.
  - Isolate the dev server so no external machine on the Wi-Fi/LAN can reach Vite or any dev endpoint.

#### 2. Native Command Security Model
Every Tauri command in Rust must implement defense-in-depth:
- **No Unrestricted Shell**: Never pass raw command strings to `/bin/sh -c` or `/bin/zsh -c`.
- **Argument Vectorization**: Commands must be parsed into an explicit executable path and a vector of arguments (`Vec<String>`), executed via `tokio::process::Command`.
- **Command Allowlisting**: The executable and initial subcommand must match the approved catalog:
  - `git` subcommands: `status`, `diff`, `branch`, `log`, `checkout`.
  - Package managers: `npm`, `pnpm`, `yarn`, `npx vitest`, `tsc`.
- **Forbidden Pattern Rejection**: Reject commands containing shell metacharacters (`|`, `;`, `&`, `>`, `<`, `` ` ``, `$()`), path traversal (`..`), or destructive sequences (`rm -rf`, `sudo`, `curl | sh`, reading `.env`).
- **Application Path Sanitization**: `open_app` must validate requested applications against a strict set of known productivity tools or verify bundle existence in `/Applications` or `/System/Applications`.

---

### Workstream 2: Tauri Native Bridge (Endpoint Migration)

#### 1. Endpoint to Tauri Command Mapping Table

| Current HTTP Endpoint | Current Purpose | Proposed Tauri Command | Rust Module | Risk Level | Callers in TypeScript |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /api/macos/open-app` | Launches macOS application | `cmd_open_app` | `commands/app_launch.rs` | LOW | `src/skills/open-application.ts:45` |
| `POST /api/macos/open-url` | Opens URL in browser | `cmd_open_url` | `commands/app_launch.rs` | LOW | `src/state/useCommandStore.ts:249, 526, 555`<br>`src/skills/youtube-launcher.ts:193` |
| `POST /api/macos/exec-command` | Runs allowlisted CLI tool | `cmd_exec_command` | `commands/process.rs` | MEDIUM | `src/skills/terminal-runner.ts:146` |
| `POST /api/macos/check-app` | Checks app installed & running | `cmd_check_app` | `commands/system.rs` | LOW | `src/skills/app-availability.ts:63` |
| `POST /api/macos/gui-action` | AppleScript click/keystroke | `cmd_gui_action` | `commands/gui.rs` | MEDIUM | `src/skills/gui-controller.ts:96` |
| `POST /api/macos/youtube-skip-ad` | Chrome tab AppleScript skip | `cmd_youtube_skip_ad` | `commands/media.rs` | LOW | `src/skills/youtube-ad-skipper.ts:48` |
| `POST /api/macos/resolve-youtube` | Resolves playable video ID | `cmd_resolve_youtube` | `commands/media.rs` | LOW | `src/state/useCommandStore.ts:225`<br>`src/skills/youtube-launcher.ts:161` |
| `POST /api/macos/prompt-ai` | Clipboard paste into AI apps | `cmd_prompt_ai` | `commands/gui.rs` | MEDIUM | `src/skills/ai-prompt-agent.ts:76` |
| `GET /api/macos/system-info` | Scans `/Applications` | *Deprecated* | — | — | Dead code (0 callers). Remove. |

#### 2. Typed Client-Side Bridge Adapter
Create `src/adapters/native/tauri-bridge.ts`:
```typescript
import { invoke } from '@tauri-apps/api/core';

export const isTauriAvailable = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export async function nativeInvoke<T>(command: string, args?: Record<string, any>): Promise<T> {
  if (isTauriAvailable()) {
    return await invoke<T>(command, args);
  }
  throw new Error(`Native execution unavailable: Tauri environment not detected.`);
}
```
This centralizes IPC, provides clear typing, and eliminates scattered, ad-hoc `fetch()` calls.

---

### Workstream 3: Standalone Application & Packaging

#### 1. Host Environment Prerequisite
> [!IMPORTANT]
> The audit identified that Rust/Cargo is not currently installed on the host development machine (`command not found: cargo`).
> Before building the native Tauri bundle, the Rust toolchain must be installed:
> ```bash
> curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
> ```

#### 2. Standalone Application Requirements
When compiled via `npm run tauri build`, the resulting `Janki.app`:
- Launches from `/Applications` or double-click with zero terminal windows.
- Operates entirely offline with no connection to port 5173.
- Embeds frontend static assets directly via Tauri's custom asset protocol.
- Contains all required Info.plist entitlements for microphone and automation access.

#### 3. Verification Test Matrix
1. **Development Mode Test**: `npm run dev` + `npm run tauri dev` loads UI, connects to native commands.
2. **Production Build Test**: `npm run tauri build` exits 0; generates `src-tauri/target/release/bundle/macos/Janki.app`.
3. **Fresh Installation Test**: Copy `Janki.app` to a clean folder without `node_modules`; launch; verify UI renders.
4. **Offline Test**: Disconnect Wi-Fi; launch app; verify app availability checks, database queries, and UI work with zero network.
5. **Permission Test**: Request microphone access via Web Audio; verify macOS permission prompt appears.
6. **Native Execution Test**: Dispatch "Run Tests" or "Open Terminal"; verify native binary spawns and returns real output.

---

### Workstream 4: Database Evaluation & Decision

#### 1. Comparison: Bundled `sql.js` WASM vs. Native SQLite (Rust / `rusqlite`)

| Criteria | Option A: Bundled `sql.js` WASM | Option B: Native SQLite (`rusqlite` / Tauri IPC) |
| :--- | :--- | :--- |
| **Reliability & Crash Safety** | **POOR**. Exports entire DB byte array on every mutation; process kill during export causes DB file corruption. | **EXCELLENT**. Full ACID transactions with OS write-ahead logging (WAL) and atomic commits. |
| **Offline Operation** | **GOOD** (if `.wasm` file is bundled locally in `public/`). | **EXCELLENT**. 100% native binary, zero webview dependencies. |
| **Performance** | **MODERATE**. In-memory only; full export/import overhead grows linearly with audit logs. | **VERY HIGH**. Indexed queries, streaming row iterators, sub-millisecond execution. |
| **Data Persistence** | **FRAGILE**. Tauri mode requires filesystem write of full blob; browser mode hits 5MB `localStorage` limit. | **ROCK SOLID**. Persisted directly to `~/Library/Application Support/com.janki.desktop/janki.db`. |
| **Implementation Complexity** | **LOW**. Minor fix to package `sql-wasm.wasm` locally. | **MODERATE**. Requires Rust command handlers for SQL queries. |
| **Future Scalability (Vector/Embeddings)** | **POOR**. Cannot easily load C extensions like `sqlite-vec`. | **EXCELLENT**. Can directly link vector search extensions in Rust for Phase 3/4. |

#### 2. Phase 1 Database Decision
> [!NOTE]
> **Definitive Recommendation for Phase 1: Two-Stage Hardening Strategy**
> 1. **Immediate Stabilization (Zero Disruption)**: Bundle `sql-wasm.wasm` locally inside `public/assets/sql-wasm.wasm` and update `database.ts` to locate it locally. This instantly fixes the remote CDN offline bug without altering database interfaces.
> 2. **Native Persistence Foundation**: Implement a native SQLite storage command in Rust (`src-tauri/src/commands/db.rs`) using `rusqlite` with WAL mode enabled. Wire the append-only audit log directly to native SQLite.
> This gives immediate offline capability while eliminating the 5MB browser quota crash risk.

---

### Workstream 5: Truthful Testing Philosophy

#### 1. The Core Rule
> **A mock must NEVER masquerade as a successful real execution.**

In Phase 0, skills caught network errors and returned:
```typescript
// INSECURE PRACTICE:
catch (err) {
  return { success: true, stdout: "✓ tests/action-plan.test.ts (6 tests) passed", executed: true };
}
```
In Phase 1, this is strictly prohibited.

#### 2. Separation of Test Modes
Every skill execution must return an explicit `executionMode`:
- `mode: 'native'` — Actually executed on macOS via native Tauri IPC.
- `mode: 'simulated'` — Executed under a test harness with explicit mock drivers.
- `mode: 'dry_run'` — Explicit policy preview with no side effects.

If a native command fails or the Tauri bridge is unavailable, the skill **must return `success: false` and `executed: false`**:
```typescript
catch (err) {
  return {
    success: false,
    executed: false,
    error: `Native bridge execution failed: ${err.message}`,
  };
}
```

#### 3. Test Layering
- **Unit Tests (`tests/*.test.ts`)**: Test pure logic (policy engine, redactor, ambiguity detector, persona engine, action plan validation) without mocking OS side effects.
- **Mock Integration Tests (`tests/mocks/*.ts`)**: Inject explicit, controllable mock drivers (e.g. `MockProcessRunner`) rather than having skills mock themselves internally.
- **Native Integration Tests (`tests/native/*.test.ts`)**: Run only when an environment variable `JANKI_TEST_NATIVE=1` is set; verify real macOS interaction.

---

### Workstream 6: Brand & Identity Unification

#### Comprehensive Replacement Map

| Current Reference | Location(s) | Phase 1 Unified Value | Reason |
| :--- | :--- | :--- | :--- |
| `"name": "orbit-desktop"` | `package.json:2`, `package-lock.json:2` | `"name": "janki-desktop"` | Package identifier alignment |
| `name = "orbit"` | `src-tauri/Cargo.toml:2` | `name = "janki"` | Rust binary crate name |
| `description = "Orbit..."` | `src-tauri/Cargo.toml:4` | `description = "Janki - Autonomous Desktop Platform"` | Product description |
| `"productName": "Janki"` | `src-tauri/tauri.conf.json:3` | Preserve `"Janki"` | Desktop app window title |
| `"identifier": "com.janki.desktop"` | `src-tauri/tauri.conf.json:5` | Preserve `"com.janki.desktop"` | macOS Bundle Identifier |
| `"orbit.db"` | `src/db/database.ts:29` | `"janki.db"` | App data SQLite filename |
| `'orbit_sqlite_data'` | `src/db/database.ts:61, 106, 124` | `'janki_sqlite_data'` | Storage key alignment |
| `'orbit_activation'` | `src/licensing/license-validator.ts:29` | `'janki_activation'` | Licensing storage key |
| `ORBIT-XXXX-XXXX-...` | `src/licensing/license-validator.ts:4` | `JANKI-XXXX-XXXX-...` | License key prefix |
| `orbitDb` / `OrbitDatabase` | `src/db/database.ts:129, 492` | `jankiDb` / `JankiDatabase` | Class & export naming |
| `bg-orbit-bg` | `tailwind.config.js:12`, `App.tsx:36` | `bg-janki-bg` (or alias) | Theme token alignment |
| `"Orbit Desktop Assistant"` | `src/components/licensing/LicenseGate.tsx:67` | `"Janki Desktop Assistant"` | UI Heading |
| `Command blocked by Orbit security...` | `src/skills/terminal-runner.ts:63` | `Command blocked by Janki security policy...` | User error message |

---

### Workstream 7: Existing Functionality Preservation

| Existing Feature | Must Preserve? | Current Native Dependency | Phase 1 Migration Action |
| :--- | :---: | :--- | :--- |
| **Voice Listening ("Hey Janki")** | **YES** | Browser `webkitSpeechRecognition` | Preserve Web Speech API for Phase 1. Ensure microphone permissions in `Info.plist`. |
| **Voice Synthesis (TTS)** | **YES** | Browser `window.speechSynthesis` | Preserve macOS voice synthesis with zero changes. |
| **Emergency Kill Switch** | **YES** | `src/core/kill-switch.ts` | Preserve centralized abort logic; wire to kill native child processes in Rust. |
| **Risk Policy Engine** | **YES** | `src/core/policy-engine.ts` | Preserve risk tiers (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) and typed confirmation modals. |
| **Sensitive Data Redactor** | **YES** | `src/core/redactor.ts` | Preserve credential masking with zero regressions. |
| **Chameleon Personas** | **YES** | `src/core/persona-engine.ts` | Preserve 5 persona archetypes and spoken greetings. |
| **YouTube Music Launcher** | **YES** | `/api/macos/open-url` | Migrate browser launch to Tauri `cmd_open_url`. |
| **YouTube Ad-Skipper** | **YES** | `/api/macos/youtube-skip-ad` | Migrate Chrome AppleScript to Tauri `cmd_youtube_skip_ad`; reduce polling frequency to 1500ms to save CPU. |
| **Application Launching** | **YES** | `/api/macos/open-app` | Migrate to Tauri `cmd_open_app`. |
| **App Availability Pre-Check** | **YES** | `/api/macos/check-app` | Migrate to Tauri `cmd_check_app`. |
| **Terminal Runner** | **YES** | `/api/macos/exec-command` | Migrate allowlisted execution to Tauri `cmd_exec_command`. |
| **Binance Public Ticker** | **YES** | Direct fetch to `api.binance.com` | Preserve public REST fetch; works in webview. |
| **Binance Paper Desk** | **YES** | In-memory limits & audit log | Preserve risk checks and paper journal entries. |
| **Audit Log UI** | **YES** | `src/db/database.ts` | Preserve SQLite audit schema with local WASM / native persistence. |

---

### Workstream 8: Implementation Order & Migration Sequence

```
Step 1: Security Baseline & Environment
        ├── Install Rust toolchain (if not present)
        └── Harden vite.config.ts (bind 127.0.0.1, remove host: true)

Step 2: Tauri Core Command Architecture
        ├── Create src-tauri/src/commands/ module structure
        └── Wire tauri::generate_handler! in src-tauri/src/main.rs

Step 3: Native Process & App Launch Commands
        ├── Implement cmd_open_app and cmd_open_url (NSWorkspace/open)
        └── Implement cmd_check_app (directory scan + running status)

Step 4: Controlled Terminal Execution Command
        ├── Implement cmd_exec_command with strict argument parsing
        └── Implement allowlist checking and pattern rejection in Rust

Step 5: GUI & Media Commands
        ├── Implement cmd_gui_action and cmd_prompt_ai (osascript runner)
        └── Implement cmd_youtube_skip_ad and cmd_resolve_youtube

Step 6: Frontend IPC Bridge Adapter
        ├── Create src/adapters/native/tauri-bridge.ts
        └── Wire skills to tauri-bridge (with graceful fallbacks)

Step 7: Database Autonomy
        ├── Bundle sql-wasm.wasm locally in public/assets/
        └── Update src/db/database.ts to load local WASM file

Step 8: Truthful Testing Overhaul
        ├── Remove fake success fallbacks from skills
        └── Update tests to verify honest failure when unmocked

Step 9: Brand Unification
        ├── Update package.json, Cargo.toml, tauri.conf.json
        └── Update storage keys, UI strings, and error messages to Janki

Step 10: Standalone Packaging & Build Verification
        ├── Run npm run tauri build
        └── Verify Janki.app launches standalone without Vite

Step 11: Regression Testing & Acceptance Sign-off
        ├── Run Vitest test suite (100% pass)
        └── Verify live desktop workflow
```

---

## 6. File-Level Change Map

```
Janki_M book_automation/
├── vite.config.ts                         # [MODIFY] Bind server to 127.0.0.1; remove host: true
├── package.json                           # [MODIFY] Rename to "janki-desktop"
├── tailwind.config.js                     # [MODIFY] Add janki color aliases
├── src-tauri/
│   ├── Cargo.toml                         # [MODIFY] Rename package to "janki", add tokio/serde dependencies
│   ├── tauri.conf.json                    # [MODIFY] Update title, security CSP, and bundle icons
│   └── src/
│       ├── main.rs                        # [MODIFY] Register Tauri command handlers
│       └── commands/                      # [NEW MODULE]
│           ├── mod.rs                     # [NEW] Command exports
│           ├── process.rs                 # [NEW] Allowlisted shell execution
│           ├── app_launch.rs              # [NEW] Open app and URL handlers
│           ├── system.rs                  # [NEW] Check app installed/running
│           ├── gui.rs                     # [NEW] AppleScript GUI automation
│           └── media.rs                   # [NEW] YouTube resolver & ad skipper
├── src/
│   ├── adapters/
│   │   └── native/
│   │       └── tauri-bridge.ts            # [NEW] Typed TypeScript wrapper for Tauri invoke
│   ├── skills/
│   │   ├── terminal-runner.ts             # [MODIFY] Call cmd_exec_command via bridge; remove fake stdout
│   │   ├── open-application.ts            # [MODIFY] Call cmd_open_app via bridge
│   │   ├── app-availability.ts            # [MODIFY] Call cmd_check_app via bridge
│   │   ├── gui-controller.ts              # [MODIFY] Call cmd_gui_action via bridge; remove fake success
│   │   ├── youtube-launcher.ts            # [MODIFY] Call cmd_open_url and cmd_resolve_youtube
│   │   ├── youtube-ad-skipper.ts          # [MODIFY] Call cmd_youtube_skip_ad via bridge
│   │   └── ai-prompt-agent.ts             # [MODIFY] Call cmd_prompt_ai via bridge
│   ├── db/
│   │   └── database.ts                    # [MODIFY] Load local WASM binary; rename keys to janki
│   ├── licensing/
│   │   └── license-validator.ts           # [MODIFY] Rename storage keys and prefix to JANKI
│   └── server/
│       └── macos-bridge-plugin.ts         # [MODIFY] Mark deprecated / fallback for pure browser mode
└── public/
    └── assets/
        └── sql-wasm.wasm                  # [NEW] Local bundled SQLite WebAssembly binary
```

---

## 7. Tauri Command Design (Rust Specification)

### 1. Process Execution: `cmd_exec_command`
```rust
#[derive(Debug, Deserialize)]
pub struct ExecCommandArgs {
    pub command: String,
    pub cwd: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ExecCommandResult {
    pub success: bool,
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn cmd_exec_command(args: ExecCommandArgs) -> Result<ExecCommandResult, String> {
    // 1. Sanitize & check blocked patterns (rm -rf, sudo, curl|sh)
    // 2. Validate against ALLOWED_COMMAND_PREFIXES (git status, npm test, etc.)
    // 3. Vectorize binary & args (no /bin/sh invocation)
    // 4. Execute via tokio::process::Command with timeout
    // 5. Return structured ExecCommandResult
}
```

### 2. App Launch: `cmd_open_app` & `cmd_open_url`
```rust
#[derive(Debug, Deserialize)]
pub struct OpenAppArgs {
    pub app_name: String,
    pub path: Option<String>,
}

#[tauri::command]
pub async fn cmd_open_app(args: OpenAppArgs) -> Result<bool, String> {
    // 1. Validate app_name against ALLOWED_APPS
    // 2. Execute /usr/bin/open -a with sanitized target path
}

#[derive(Debug, Deserialize)]
pub struct OpenUrlArgs {
    pub url: String,
    pub browser: Option<String>,
}

#[tauri::command]
pub async fn cmd_open_url(args: OpenUrlArgs) -> Result<bool, String> {
    // 1. Validate URL scheme (strictly http:// or https://)
    // 2. Execute /usr/bin/open -a [browser] [url]
}
```

### 3. System Query: `cmd_check_app`
```rust
#[derive(Debug, Serialize)]
pub struct CheckAppResult {
    pub app_name: String,
    pub available: bool,
    pub is_running: bool,
    pub app_path: Option<String>,
    pub fastest_mode: String,
}

#[tauri::command]
pub async fn cmd_check_app(app_name: String) -> Result<CheckAppResult, String> {
    // 1. Check /Applications, /System/Applications for [AppName].app
    // 2. Check running process status via pgrep or osascript
    // 3. Return structured status in <1ms
}
```

---

## 8. Risk Register

| Risk ID | Description | Severity | Probability | Mitigation Strategy |
| :--- | :--- | :---: | :---: | :--- |
| **R1** | Missing Rust/Cargo toolchain on host machine | HIGH | HIGH | Explicitly document install command (`rustup`); verify `cargo --version` in Step 1. |
| **R2** | Vite browser mode breaks when bridge is removed | MEDIUM | MEDIUM | Keep `macos-bridge-plugin.ts` as an optional fallback in dev mode only; skills try Tauri IPC first. |
| **R3** | AppleScript execution prompts for macOS Accessibility | HIGH | HIGH | Add clear user prompt guiding user to System Settings > Privacy > Accessibility when `osascript` returns permission error. |
| **R4** | Local WASM file path resolution fails in release bundle | MEDIUM | LOW | Place `sql-wasm.wasm` in `public/` so Vite automatically copies it to `dist/`, accessible via relative URL. |
| **R5** | Existing tests break when fake success fallbacks are removed | MEDIUM | HIGH | Update test assertions to test valid inputs against mock adapters rather than testing broken fallback strings. |

---

## 9. Git-Based Rollback & Commit Strategy

Phase 1 changes will be organized into atomic, isolated git commits:

```
commit 1: chore(security): bind vite dev server to 127.0.0.1 and harden network boundaries
commit 2: feat(tauri): initialize Rust command module structure in src-tauri
commit 3: feat(tauri): implement native process execution and app launching commands
commit 4: feat(tauri): implement system queries, media, and gui commands
commit 5: feat(bridge): add typed tauri-bridge adapter and migrate frontend skills
commit 6: fix(db): bundle sql-wasm locally for offline persistence
commit 7: test(truthful): decouple mocks from skills and eliminate fake success returns
commit 8: chore(branding): unify application naming, keys, and UI headers to Janki
commit 9: build(packaging): configure Tauri standalone release bundle and entitlements
```

If any step fails validation, the repository can be cleanly reset to the preceding commit with zero collateral damage.

---

## 10. Phase 1 Acceptance Checklist & Definition of Done

### 1. Security Checklist
- [ ] `vite.config.ts` binds strictly to `127.0.0.1`.
- [ ] LAN access to port 5173 is blocked.
- [ ] All native commands reject shell metacharacters and unapproved binaries.
- [ ] No unauthenticated HTTP endpoints exist on the host machine.

### 2. Native Bridge Checklist
- [ ] `open-application` launches apps via Tauri IPC.
- [ ] `terminal-runner` executes allowlisted commands via Tauri IPC.
- [ ] `app-availability` accurately checks installed/running apps via Tauri IPC.
- [ ] Chrome YouTube ad-skipping dispatches via Tauri IPC.
- [ ] Prompt dispatch to ChatGPT/Claude executes via Tauri IPC.

### 3. Standalone Packaging Checklist
- [ ] `npm run tauri build` completes with exit code 0.
- [ ] The generated `Janki.app` launches independently without running `npm run dev`.
- [ ] System automation features work in the packaged `.app`.

### 4. Database Checklist
- [ ] Application loads and persists SQLite data with 100% network disconnection (Airplane Mode).
- [ ] Zero requests made to `https://sql.js.org`.
- [ ] Audit logs and action plans persist across application restarts.

### 5. Truthful Testing Checklist
- [ ] `npm run test:run` passes 100% of unit tests.
- [ ] Tests assert against honest success/failure states.
- [ ] Mocks do not pretend to execute real native commands.
- [ ] `npm run typecheck` produces 0 TypeScript errors.

### 6. Branding Checklist
- [ ] `package.json` name is `janki-desktop`.
- [ ] `Cargo.toml` name is `janki`.
- [ ] All storage keys and window titles display **Janki**.
- [ ] Zero user-facing "Orbit" references remain in active code.

---

## 11. Claude Code Implementation Protocol

When instructing Claude Code to begin Phase 1 execution:
1. Provide the atomic task corresponding strictly to **one commit at a time** (e.g., Step 1 first).
2. For each task, require running `npm run typecheck` and `npm run test:run` to verify zero regressions.
3. Validate each step against the Acceptance Checklist before moving to the next.
