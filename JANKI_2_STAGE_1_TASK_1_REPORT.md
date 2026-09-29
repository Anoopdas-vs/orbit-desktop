# Janki 2.0 — Stage 1 Task 1 Report: Native Foundation Fix

**Date:** September 2026  
**Target Codebase:** `/Users/anoopdasvs/Downloads/Janki_M book_automation`  
**Task:** Stage 1 — Fix macOS Coordinate Mouse Click, Privacy Permissions, and Network CSP Configuration

---

## A. Changes Made

1. **Fixed macOS Coordinate Mouse Click (CoreGraphics CGEvent Integration)**
   - Replaced the broken AppleScript coordinate-clicking implementation (`tell application "System Events" to click at {px, py}`) in `src-tauri/src/commands/control.rs` which previously triggered AppleScript runtime error `-600`.
   - Implemented native macOS `CoreGraphics` C FFI bindings:
     - `CGEventCreate`: fetches current mouse cursor position when coordinates are omitted.
     - `CGEventGetLocation`: reads accurate display space coordinates (`CGPoint`).
     - `CGEventCreateMouseEvent`: constructs synthetic mouse down/up/move events.
     - `CGEventSetIntegerValueField`: configures click state (`1` for single click, `2` for double click).
     - `CGEventPost`: dispatches mouse events directly to `kCGHIDEventTap` (System HID tap).
     - `CFRelease`: prevents CoreFoundation object memory leaks.
     - `AXIsProcessTrusted`: verifies macOS Accessibility permission status before event dispatch.
   - Handled single click, double click (with 50ms interval and click state 2), and right click (secondary button).
   - Added pre-click cursor motion (`kCGEventMouseMoved`) to ensure UI hover and hit-testing states update accurately.
   - Implemented strict and truthful error reporting:
     - Rejects mismatched coordinate inputs (`(Some(x), None)` or `(None, Some(y))`) with `"Both x and y must be provided for coordinate clicks."`.
     - Returns explicit permission guidance if `AXIsProcessTrusted()` is false, preventing silent drops by macOS WindowServer.
   - Added cross-platform stubs for non-macOS targets to ensure platform-safe compilation.

2. **Fixed macOS Privacy Permissions Configuration**
   - Created `src-tauri/Info.plist` with all required macOS privacy usage descriptions:
     - `NSMicrophoneUsageDescription`: `"Janki uses your microphone to capture voice commands and enable hands-free voice interaction."`
     - `NSSpeechRecognitionUsageDescription`: `"Janki uses speech recognition to understand your spoken instructions and execute assistant commands."`
     - `NSAppleEventsUsageDescription`: `"Janki automates desktop tasks and controls applications via AppleEvents and System Events."`
     - `NSScreenCaptureUsageDescription`: `"Janki captures your screen to analyze active windows and provide contextual AI assistance."`
   - Configured `src-tauri/tauri.conf.json` under `bundle.macOS.infoPlist` to point to `Info.plist`.
   - Verified that the Tauri packaging pipeline merges these descriptions directly into the bundled application's `Info.plist` (`Janki.app/Contents/Info.plist`).

3. **Fixed Content Security Policy (CSP) & Network Configuration**
   - Updated `app.security.csp` in `src-tauri/tauri.conf.json` to allow planned legitimate outbound network services while maintaining strict security:
     - Preserved `default-src 'self'`, `script-src 'self'`, and `style-src 'self' 'unsafe-inline'`.
     - Broadened `connect-src` to include:
       - Local dev and local LLM runtime: `http://127.0.0.1:*`, `ws://127.0.0.1:*`, `http://localhost:*`, `ws://localhost:*`
       - Crypto market ticker: `https://api.binance.com`
       - Web search provider: `https://api.duckduckgo.com`, `https://html.duckduckgo.com`, `https://duckduckgo.com`
       - Cloud LLM adapters: `https://api.openai.com`, `https://api.anthropic.com`, `https://generativelanguage.googleapis.com`
       - Google Workspace OAuth & REST: `https://accounts.google.com`, `https://oauth2.googleapis.com`, `https://gmail.googleapis.com`, `https://www.googleapis.com`
       - Application Updater: `https://github.com`
     - Avoided overly permissive wildcards (`*` or `https:`) to preserve network isolation and prevent exfiltration vulnerabilities.

---

## B. Files Changed

| File | Status | Description of Modifications |
| :--- | :--- | :--- |
| `src-tauri/src/commands/control.rs` | Modified | Replaced AppleScript mouse click with native CoreGraphics `CGEvent` FFI, added coordinate validation, truthful accessibility checking, and unit tests. |
| `src-tauri/tauri.conf.json` | Modified | Updated CSP `connect-src` whitelist for legitimate outbound APIs; added `bundle.macOS.infoPlist`. |
| `src-tauri/Info.plist` | Created | Defined macOS privacy usage descriptions (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, `NSAppleEventsUsageDescription`, `NSScreenCaptureUsageDescription`). |
| `JANKI_2_STAGE_1_TASK_1_REPORT.md` | Created | Single comprehensive task report documenting Stage 1 Task 1. |

---

## C. Tests Executed and Results

### 1. Rust Test Suite (`cargo test`)
- **Command:** `cargo test`
- **Result:** **18 passed, 0 failed, 0 warnings** (Finished in 0.30s)
- **Tests Executed:**
  - `commands::control::tests::test_mouse_click_coordinate_validation` (Verified coordinate pair validation)
  - `commands::control::tests::test_mouse_click_permission_handling` (Verified truthful accessibility check)
  - `commands::control::tests::test_native_cgevent_location_and_allocation` (Verified native `CGEventCreate` and `CGEventCreateMouseEvent` memory allocation)
  - `commands::control::tests::test_volume_clamping`
  - `commands::control::tests::test_sanitize_applescript`
  - `commands::app_launch::tests::test_allows_approved_app_names`
  - `commands::app_launch::tests::test_rejects_invalid_url_schemes`
  - `commands::app_launch::tests::test_rejects_unapproved_apps`
  - `commands::filesystem::tests::test_allows_safe_user_paths`
  - `commands::filesystem::tests::test_rejects_forbidden_system_paths`
  - `commands::perception::tests::test_ui_element_parsing_structure`
  - `commands::permissions::tests::test_permission_structure`
  - `commands::process::tests::test_blocks_dangerous_patterns`
  - `commands::process::tests::test_blocks_shell_metacharacters`
  - `commands::process::tests::test_blocks_unauthorized_commands`
  - `commands::process::tests::test_allows_valid_command`
  - `commands::system::tests::test_system_app_detection`
  - `commands::system::tests::test_nonexistent_app_handling`

### 2. TypeScript Test Suite (`npm run test:run`)
- **Command:** `vitest run`
- **Result:** **51 test files passed, 371 tests passed** (Finished in 20.00s)
- **Status:** Zero regressions across all domain skills, workflow engines, safety policies, and components.

### 3. Production Frontend Build (`npm run build`)
- **Command:** `tsc && vite build`
- **Result:** Successfully compiled TypeScript and bundled assets with 0 errors.

### 4. macOS Application Packaging (`npm run tauri -- build`)
- **Command:** `PATH="$HOME/.cargo/bin:$PATH" tauri build`
- **Result:** Successfully compiled release binary and generated macOS bundle:
  - Binary: `src-tauri/target/release/janki`
  - Bundle: `src-tauri/target/release/bundle/macos/Janki.app`
- **Verification:** Inspected `Janki.app/Contents/Info.plist` and confirmed the merged presence of all 4 required `NS*UsageDescription` keys.

---

## D. Native / macOS Verification Performed

| Capability / Check | Verification Level | Verification Evidence |
| :--- | :--- | :--- |
| **Coordinate Mouse Click Logic** | Real Native FFI | Tested `CGEventCreate`, `CGEventGetLocation`, and `CGEventCreateMouseEvent` on macOS ARM64. Read current mouse position (`x=952.6, y=676.9`) and allocated events without error. |
| **Accessibility Enforcement** | Real Native FFI | Confirmed `AXIsProcessTrusted()` returned `0` in untrusted terminal execution, and verified that `mouse_click` truthfully reported the missing Accessibility permission instead of fabricating success. |
| **Packaging & Info.plist** | Real Native Packaging | Bundled `Janki.app` and inspected `Contents/Info.plist` to confirm injection of `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, `NSAppleEventsUsageDescription`, and `NSScreenCaptureUsageDescription`. |
| **TypeScript Automation Suite** | Mocked Driver (Vitest) | Note: Vitest tests run in Node/jsdom and interact with `MockNativeDriver` by design; real native operations were verified independently via Rust FFI and binary compilation. |

---

## E. Remaining Known Issues

1. **WASM SQLite Full-Buffer Rewrites:** `src/db/database.ts` still runs `sql.js` in the renderer, writing the entire SQLite database to disk as a blob on every mutation (needs migration to native Rust SQLite with WAL mode).
2. **Hardcoded 25-App Launch Allowlist:** `src-tauri/src/commands/app_launch.rs` still contains a static 25-app array blocking common desktop applications (Slack, Discord, Spotify, etc.) until dynamic `NSWorkspace` scanning is implemented.
3. **Redundant Vite Bridge Middleware:** `src/server/macos-bridge-plugin.ts` still exists in the repo and duplicates automation logic (to be removed in subsequent Stage 1 cleanup).
4. **Cross-Platform OS Abstraction:** Windows automation (`SendInput`, Win32 / UI Automation) has stub implementations in `control.rs` and requires a dedicated `OsDriver` trait.

---

## F. What is NOT Implemented Yet

In adherence to strict stage separation guidelines, the following Stage 2+ features were intentionally **not** implemented:
- **Stage 2 (Reasoning & Agent Brain):** Multi-provider cloud LLM adapters (Anthropic, OpenAI, Gemini), Ollama streaming loop, structured JSON tool execution loop, native OS keyring credential storage, and removal of `LicenseGate.tsx`.
- **Stage 3 (Voice Stack):** Rust native `cpal` audio stream, local acoustic wake-word engine (openWakeWord / Porcupine), embedded Whisper STT, and Malayalam language models.
- **Stage 4 (Vision & OCR):** Native Apple Vision framework OCR (`VNRecognizeTextRequest`) and VLM screenshot reasoning.
- **Stage 5 (Integrations):** Real OAuth 2.0 PKCE loopback flow for Gmail and Google Calendar, live YouTube search queries.
- **Stage 6 (Background Daemon):** Menu bar / system tray daemon with global summon shortcut.

---

## G. Recommendation for Next Stage 1 Task

**Proceed to Stage 1 Task 2: OS Driver Abstraction & Dynamic App Launcher**
1. Implement the Rust `OsDriver` trait to separate platform-specific automation into dedicated `macos.rs` and `windows.rs` modules.
2. Replace the static 25-app allowlist in `src-tauri/src/commands/app_launch.rs` with dynamic system application discovery (`NSWorkspace` on macOS and Registry/Start Menu on Windows).
3. Remove the redundant `src/server/macos-bridge-plugin.ts` dev middleware.
