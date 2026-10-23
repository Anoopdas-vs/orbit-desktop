# JANKI COMPREHENSIVE FORENSIC CODEBASE AUDIT REPORT

**Date of Audit:** September 2026  
**Auditor Roles:** Senior Product Architect, Senior macOS Engineer, AI Agent Engineer, QA Engineer, Security Engineer, UX Engineer, Code Auditor  
**Target Codebase:** `/Users/anoopdasvs/Downloads/Janki_M book_automation`  
**Application Version:** `0.1.0` (Tauri v2 + React 18 + TypeScript)  
**Verification Method:** Static inspection, AST and dependency graph tracing, AppleScript/macOS system command verification, build system (`tsc`) execution, and test suite execution (`vitest`).

---

## EXECUTIVE SUMMARY: WHY JANKI DOES NOT BEHAVE LIKE THE EXPECTED PRODUCT

All 6 planned development phases are marked complete in markdown reports, and all 51 test suites (371 tests) pass in Vitest. However, **Janki is currently an illusion of an autonomous desktop assistant.**

The core reasons Janki fails to function as a real hands-free desktop AI assistant are:

1. **No Real AI / LLM Reasoning Engine**: `cloud-adapters.ts` is an empty stub returning `null`. There is zero connection to OpenAI, Anthropic, Gemini, or any cloud API. The local Ollama adapter is only a dormant fallback in secondary helper files and is **never called** by the primary execution pipeline.
2. **Deterministic Hardcoded Keyword Router**: `router.ts` is a 1,241-line chain of `else if (lower.includes(...))` statements. Any natural user instruction that does not match predefined keywords falls into an unhandled `general_assistant` fallback, which logs "Executed action Review Request successfully" and **does absolutely nothing**.
3. **Broken macOS Mouse Automation**: Mouse clicking in `control.rs` uses `tell application "System Events" to click at {x, y}`. This is **invalid AppleScript** that macOS System Events rejects with runtime error `-600` / syntax failure.
4. **Browser-Dependent, Flawed Voice Stack**: Wake word and speech-to-text do not use local acoustic models or native macOS frameworks; they rely on browser `webkitSpeechRecognition`. In Tauri's macOS WKWebView, `SpeechRecognition` is either non-functional or severely restricted. Furthermore, language is hardcoded to `en-US`, making Malayalam voice recognition impossible.
5. **Missing macOS Info.plist Permissions**: The application lacks `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, and `NSAppleEventsUsageDescription`. On modern macOS, accessing the microphone or controlling other apps without these keys causes the OS to terminate or silently deny permission.
6. **Strict Network CSP Blocks Web Search**: `tauri.conf.json` restricts `connect-src` to `localhost` and `api.binance.com`. In production desktop mode, WebKit blocks all outbound fetches to DuckDuckGo or web search engines.
7. **Simulated Integrations and Hardcoded Stubs**: Google Workspace (Gmail and Calendar) is 100% mocked with in-memory arrays. YouTube song resolution is hardcoded to 6 predefined video IDs, defaulting all other music queries to Imagine Dragons' "Believer".
8. **100% Mocked Test Suite**: All 371 Vitest tests run against `MockNativeDriver` in memory. Not a single integration test ever executes real AppleScript, real audio, or real macOS commands.

---

# PART 1 — PROJECT INVENTORY

### Directory Tree & Structural Layout
```
Janki_M book_automation/
├── src-tauri/                  # Native Rust Layer (Tauri v2)
│   ├── Cargo.toml              # Rust crate dependencies
│   ├── tauri.conf.json         # Tauri app configuration, window specs, CSP
│   └── src/
│       ├── main.rs             # Tauri entrypoint & command registrations
│       └── commands/           # 10 Rust backend modules (AppleScript/CLI bridges)
│           ├── control.rs      # Window, mouse, keyboard, volume osascript
│           ├── app_launch.rs   # Allowlisted application & URL open via open CLI
│           ├── perception.rs   # UI tree inspection & screencapture
│           ├── permissions.rs  # AXIsProcessTrusted probe
│           ├── process.rs      # Allowlisted CLI execution (git, npm)
│           ├── filesystem.rs   # Sandboxed file read/write/trash
│           ├── gui.rs          # GUI action commands via osascript
│           ├── media.rs        # Chrome YouTube ad-skip JS & hardcoded song map
│           ├── system.rs       # Application availability scanner
│           └── mod.rs          # Module export aggregator
├── src/                        # Frontend UI & Core Engine (React + TypeScript)
│   ├── App.tsx                 # Root component wrapped in LicenseGate
│   ├── main.tsx                # React DOM mount
│   ├── core/                   # Planning, routing, safety, and language engines
│   │   ├── router.ts           # 1,241-line keyword/regex router
│   │   ├── dynamic-planner.ts  # Multi-step task generator
│   │   ├── execution-loop.ts   # Closed-loop execution & verification
│   │   ├── policy-engine.ts    # Risk classification (LOW/MEDIUM/HIGH/CRITICAL)
│   │   ├── kill-switch.ts      # Global emergency stop coordinator
│   │   ├── redactor.ts         # Sensitive pattern & PII masking
│   │   ├── multilingual-nlp.ts # Malayalam / Manglish regex classifier
│   │   ├── memory-engine.ts    # In-memory + SQLite preference manager
│   │   ├── persona-engine.ts   # Chameleon persona definitions & greetings
│   │   └── workflow/           # Goal decomposer, rollback coordinator
│   ├── adapters/               # External Bridges & Hardware Interfaces
│   │   ├── native/             # tauri-bridge.ts (IPC + MockNativeDriver)
│   │   ├── voice/              # Web Speech STT, TTS, and wake-word listener
│   │   ├── llm/                # cloud-adapters.ts (stub) & ollama-adapter.ts
│   │   ├── trading/            # Binance ticker & paper trading adapter
│   │   └── git/                # Git commit & branch workflow skills
│   ├── skills/                 # High-level domain skills (15 skill modules)
│   ├── tools/                  # Granular tools (web search, browser, screen)
│   ├── state/                  # Zustand stores (Command, Safety, Audit, ComputerState)
│   ├── db/                     # SQLite persistence via WebAssembly sql.js
│   ├── components/             # React UI views (CommandCenter, Approvals, Settings)
│   ├── licensing/              # Gumroad license & 7-day trial validator
│   └── integrations/           # Google Gmail & Calendar client stubs
└── tests/                      # 51 Vitest test suites (371 tests)
```

### Critical File Purposes & Reality Check

| File Path | Claimed Purpose | Actual Implementation Reality |
| :--- | :--- | :--- |
| `src/adapters/llm/cloud-adapters.ts` | Cloud LLM integration (OpenAI, Claude) | **Empty Stub**. Contains a class with `return null`. Zero network or SDK calls. |
| `src/core/router.ts` | Intent router & autonomous planner | **Brittle Regex Tree**. 1,241 lines of `if (lower.includes(...))`. Unmatched prompts trigger empty `general_assistant`. |
| `src-tauri/src/commands/control.rs` | macOS system computer control | **Broken Mouse AppleScript**. Coordinate clicks use invalid `System Events` syntax. Fails at runtime. |
| `src-tauri/src/commands/app_launch.rs` | Universal app launcher | **Hardcoded Allowlist**. Blocks any application not in an arbitrary 25-item array (e.g. Spotify, Slack, Discord fail). |
| `src-tauri/src/commands/media.rs` | YouTube & music playback | **Hardcoded Video IDs**. Matches 6 strings. All other search queries resolve to Imagine Dragons' "Believer". |
| `src/adapters/voice/wake-word-listener.ts` | "Hey Janki" wake word detection | **Browser Web Speech Hack**. Runs continuous `webkitSpeechRecognition`. Fails in native desktop WKWebView. |
| `src/adapters/voice/voice-provider.ts` | Speech-to-Text engine | **Hardcoded English Web Speech**. Uses `lang = 'en-US'`. Zero native Whisper or local STT integration. |
| `src/skills/screen/screen-skill.ts` | Multimodal vision & screen understanding | **Regex on UI Tree**. No vision model (VLM) or OCR. Queries AppleScript text fields and runs regex for `POL` / `INV`. |
| `src/integrations/google/gmail-client.ts` | Gmail integration | **Mocked In-Memory Array**. Hardcoded simulated inbox. "Send" simply unshifts to local array. |
| `src/adapters/native/tauri-bridge.ts` | Desktop IPC Bridge | **Mocked in Tests**. Automatically substitutes `MockNativeDriver` in all tests, masking all real macOS failures. |

---

# PART 2 — ARCHITECTURE AUDIT

### Architectural Deficiencies Identified
1. **No Orchestrating Agent Brain**: There is no dynamic reasoning loop. An agent must observe environment state, formulate hypotheses, call tools, and adjust. Janki generates a static `ActionPlan` up front based on regex pattern matching and attempts to execute it linearly.
2. **Missing Connections / Dead Code**:
   - `CloudLlmAdapter` in `cloud-adapters.ts` is imported nowhere and does nothing.
   - `goalDecomposer.decompose` (which holds the only Ollama LLM prompt generator) is bypassed in `router.ts:931` in favor of the synchronous `goalDecomposer.decomposeDeterministic`.
   - `general_assistant` action type in `router.ts:1204` has no execution handler in `useCommandStore.ts:680`.
3. **Dual-Bridge Divergence**:
   - The app has two completely parallel macOS bridge implementations: `src-tauri/src/commands/` (Rust) and `src/server/macos-bridge-plugin.ts` (Node.js Vite middleware).
   - The Vite plugin was written so the app could be developed and tested in Google Chrome without running Tauri. But when built as a native app, the Vite server does not exist.
4. **Single Point of Failure**:
   - The Web Speech API is the sole mechanism for both STT and wake word. If WebKit restricts microphone access in WKWebView, the entire voice interface is dead.

---

# PART 3 — CORE JANKI CAPABILITIES AUDIT

| Capability | Status | Code Location | Forensic Finding |
| :--- | :---: | :--- | :--- |
| **Microphone Input** | 🟡 PARTIAL | `voice-provider.ts:79` | Works via HTML5 `getUserMedia` in browser, but Info.plist lacks `NSMicrophoneUsageDescription`. |
| **Speech-to-Text (STT)** | 🔴 BROKEN | `voice-provider.ts:125` | Relies on `webkitSpeechRecognition`. Not supported in desktop Tauri WKWebView; hardcoded to `en-US`. |
| **Wake Word ("Hey Janki")** | 🔴 BROKEN | `wake-word-listener.ts:36` | Not an acoustic wake word engine. Runs continuous browser STT streaming to Google servers; conflicts with microphone locks. |
| **Continuous Listening** | 🔴 BROKEN | `wake-word-listener.ts:48` | `onend` restarts recognition in a tight loop. Chrome throttles or blocks continuous recognition after disconnects. |
| **Interruption / Barge-in** | 🟡 PARTIAL | `speech-synthesis.ts:150` | Cancels `window.speechSynthesis`. Works for UI button clicks, but cannot detect voice barge-in while speaking. |
| **TTS (Speech Synthesis)** | 🟡 PARTIAL | `speech-synthesis.ts:88` | Uses `window.speechSynthesis`. Indian English voices work if present on macOS. |
| **Malayalam Support** | 🔵 MOCKED | `multilingual-nlp.ts`, `speech-synthesis.ts:78` | NLP is a dictionary of 19 Manglish keywords. TTS assumes Malayalam voice is pre-installed; otherwise falls back to English phonetics. |
| **LLM Connection** | ⚪ MISSING | `cloud-adapters.ts` | No SDK or fetch calls to OpenAI/Claude. Stubbed with `return null`. |
| **Context & Conversation** | 🟡 PARTIAL | `conversational-context.ts` | Only handles hardcoded YouTube Chrome confirmation ("yes"/"no" to opening YouTube). |
| **Autonomous Planning** | 🔴 BROKEN | `dynamic-planner.ts:270` | Only has 4 hardcoded compound task templates (files->doc, browser->doc, system->report, organize). |
| **Mouse Control** | 🔴 BROKEN | `control.rs:387` | AppleScript `tell application "System Events" to click at {x, y}` fails on macOS with error `-600`. |
| **Keyboard Control** | 🟡 PARTIAL | `control.rs:498` | `keystroke` and `key code` via System Events work for simple ASCII, but fail on non-ASCII characters or without Accessibility permission. |
| **Screen Capture** | 🟡 PARTIAL | `perception.rs:227` | Invokes `/usr/sbin/screencapture -x`. Works, but hardcodes `width: 1920, height: 1080` in return payload. |
| **Screen Understanding** | 🔵 MOCKED | `screen-skill.ts:114` | No VLM/OCR. Queries front window buttons/fields via AppleScript and runs regex. Cannot read PDFs, web canvases, or images. |
| **Application Control** | 🟡 PARTIAL | `app_launch.rs:4` | Works via `/usr/bin/open -a`, but restricted to hardcoded list of 25 apps. |
| **Window Control** | ✅ WORKING | `control.rs:185` | Focus, minimize, zoom, resize, and close via System Events AppleScript work when granted Accessibility. |
| **File Operations** | ✅ WORKING | `filesystem.rs` | Native Rust filesystem operations (read, write, move to trash) enforce path safety policies. |
| **Browser Operations** | 🟡 PARTIAL | `open_url.rs`, `media.rs:20` | Opens URLs via `open`. Chrome JS execution for YouTube ad-skip works only if "Allow JavaScript from Apple Events" is enabled. |
| **Long-Term Memory** | 🟡 PARTIAL | `memory-engine.ts`, `database.ts` | Pure TS 3-gram vector similarity works, but SQLite layer writes entire WASM database to disk on every update. |
| **Web Research** | 🔴 BROKEN | `web-search-tool.ts` | DuckDuckGo Instant API returns empty text for complex queries; HTML scraper blocked by anti-bot; Tauri CSP blocks outbound traffic. |
| **Gmail & Calendar** | 🔵 MOCKED | `gmail-client.ts`, `calendar-client.ts` | 100% mocked with static in-memory data structures. Zero network communication with Google APIs. |
| **Trading Advisory** | 🟡 PARTIAL | `binance-adapter.ts` | Public ticker fetch works. Order execution is paper trading in memory. Live trading is intentionally blocked. |

---

# PART 4 — macOS NATIVE SYSTEM AUDIT

### 1. Permissions & TCC (Transparency, Consent, and Control)
- **Missing Info.plist Usage Descriptions**:
  The compiled bundle lacks `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, and `NSAppleEventsUsageDescription`. On macOS 10.15+, any attempt to trigger microphone capture or dispatch AppleEvents to other applications without these keys causes the OS to either immediately terminate the process or silently drop events.
- **Accessibility (`AXIsProcessTrusted`)**:
  `permissions.rs:27` properly links `ApplicationServices` and invokes `AXIsProcessTrusted()`. However, it does not call `AXIsProcessTrustedWithOptions` with `kAXTrustedCheckOptionPrompt: true`, so it never automatically triggers the macOS system prompt asking the user to grant permission.
- **Screen Recording Permission**:
  `permissions.rs:37` probes screen recording by spawning `/usr/sbin/screencapture` to `/tmp/janki_perm_probe.jpg`. If denied, macOS captures only the desktop wallpaper, which Janki cannot distinguish from a blank screen.

### 2. AppleScript Execution Failures
- **The Fatal Coordinate Click Bug**:
  In `control.rs:396-418` and `gui.rs:52`:
  ```applescript
  tell application "System Events"
    click at {coord_x, coord_y}
  end tell
  ```
  `click at` is **not a command in AppleScript's System Events suite**. System Events only implements `click <UI element reference>`. Running this produces:
  `execution error: System Events got an error: Application isn’t running. (-600)` or `Syntax Error: Expected end of line but found class name.`

---

# PART 5 — REAL USER EXPERIENCE AUDIT (CLEAN MAC WALKTHROUGH)

1. **Install Janki.app**: Unsigned binary blocked by Gatekeeper ("damaged and cannot be opened").
2. **Open Janki**: Blocked by Gumroad `LicenseGate.tsx` screen.
3. **Grant Permissions**: Accessibility checked, but OS prompt not raised automatically.
4. **Configure AI**: No API key settings for OpenAI/Anthropic in UI.
5. **Configure Voice**: Lists browser voices; no Malayalam voice present on fresh Mac.
6. **Say "Hey Janki"**: Web Speech Recognition fails in desktop WKWebView.
7. **Ask "What is quantum computing?"**: Tauri CSP blocks DuckDuckGo fetch; returns network error.
8. **Ask "Open Spotify"**: Blocked because Spotify is not in the hardcoded 25-app allowlist.
9. **Coordinate Click**: Crashes with AppleScript syntax error `-600`.
10. **Read PDF on Screen**: Fails because PDF content is not exposed as accessible text fields.
11. **Potentially Dangerous Command (`rm -rf`)**: Successfully blocked by PolicyEngine.
12. **Emergency Stop**: Kill switch immediately cancels all tasks and speech.
13. **Give Unknown Instruction**: Silently executes a dummy "Review Request" plan that does nothing.
14. **Disconnect Internet**: Entire app ceases to function (Web Speech STT dies).
15. **Close Window**: App quits completely; no menu bar icon or background listener.

---

# PART 6 — ORIGINAL PRODUCT VISION GAP

| Dimension | Expected Janki Product Vision | Current Janki Codebase Reality |
| :--- | :--- | :--- |
| **Identity** | An autonomous personal desktop AI assistant for macOS that can think, reason, and act. | A hybrid Tauri/Web app containing a deterministic keyword matching engine with mocked integrations. |
| **Intelligence** | LLM-powered (reasoning, tool-calling, intent understanding, error recovery). | A 1,241-line TypeScript `if...else if` statement. Cloud LLMs are completely unhooked stubs. |
| **Voice Interaction** | Hands-free, offline/near-line, natural conversation, reliable local wake word ("Hey Janki"). | WebKit browser speech recognition streaming to Google. Fails inside desktop Tauri WKWebView. |
| **Multilingual Voice** | True Malayalam and Manglish understanding and natural speech. | 19 hardcoded Manglish keyword tokens. Speech recognition is locked to `en-US`. |
| **Computer Control** | True OS-level mouse clicking, typing, window management, and application interaction. | Broken coordinate clicking in AppleScript (`click at` error -600). App launching restricted to 25 hardcoded apps. |
| **Perception / Vision** | Visual understanding of open documents, web pages, and screens using multimodal models / OCR. | Scans accessible UI elements with regex for `POL` and `INV`. Cannot perceive images, canvas, or PDFs. |
| **Integrations** | Real OAuth connectivity to Gmail, Calendar, and desktop software. | Simulated in-memory arrays. Hardcoded emails and calendar items. No live Google APIs. |
| **macOS Citizen** | Background menu bar daemon, global hotkey, proper TCC permissions handling. | Single foreground window. Quitting closes the app. Missing Info.plist privacy entries. |

---

# PART 7 — BUG AND RISK AUDIT

### CRITICAL RISKS
1. **AppleScript Syntax Error Breaks All Coordinate Clicks** (`control.rs:387`)
2. **Missing macOS Privacy Usage Descriptions in Info.plist** (Microphone, AppleEvents, Speech)
3. **Tauri CSP Blocks External Web Search and APIs** (`tauri.conf.json:27`)
4. **Cloud LLM Adapter is Non-Existent / Dormant** (`cloud-adapters.ts:27`)
5. **Wake Word and STT Locked to Incompatible Web Speech API** (`wake-word-listener.ts:28`, `voice-provider.ts:128`)

### HIGH RISKS
6. **Hardcoded Application Allowlist Restricts Normal Mac Usage** (`app_launch.rs:4`)
7. **Simulated Integrations Posed as Implemented Features** (`gmail-client.ts`, `calendar-client.ts`)
8. **Hardcoded Music Playback** (`media.rs:73-81`)
9. **Screen Vision Incapable of Inspecting PDFs or Images** (`screen-skill.ts:114`)
10. **Silent No-Op on General Instructions** (`router.ts:1200`)

---

# PART 8 — CODE QUALITY AUDIT

- **Single-Responsibility Violations**: `router.ts` (1,241 lines), `useCommandStore.ts` (803 lines), `control.rs` (907 lines).
- **Code Duplication**: `src-tauri/src/commands/control.rs` duplicates `src/server/macos-bridge-plugin.ts` AppleScript strings.
- **Type Safety**: Compiles cleanly with TypeScript, but runtime dispatch uses unsafe `any` casts.
- **Cosmetic Completeness**: UI displays advanced badges ("Ad-Skipper: Ready", "App Pre-Check: Active"), but backend hooks connect to static mocks.

---

# PART 9 — TESTING AUDIT

- **Vitest Result:** 51 test files passed, 371 tests passed.
- **The Core Flaw:** When running under test environments (`VITEST`), `tauri-bridge.ts` redirects all system calls to `MockNativeDriver`. Zero real macOS commands or AppleScripts are ever tested.

---

# PART 10 — PRODUCT READINESS CLASSIFICATION

### Current Classification: **A. PROTOTYPE / CONCEPT DEMO**
Janki is an interactive UI demo that simulates an autonomous desktop assistant using hardcoded fixture data and mock drivers.

---

# PART 11 — REQUIRED FIXES BACKLOG

| ID | Priority | Problem | Required Change | Complexity | Order |
| :--- | :---: | :--- | :--- | :---: | :---: |
| **FIX-01** | **P0** | Coordinate mouse click AppleScript fails | Replace `osascript` mouse clicks with native `CGEventCreateMouseEvent` in Rust. | **M** | 1 |
| **FIX-02** | **P0** | Missing macOS Info.plist permissions | Add `Info.plist` with `NSMicrophoneUsageDescription` and `NSAppleEventsUsageDescription`. | **S** | 2 |
| **FIX-03** | **P0** | Connect real LLM API | Implement OpenAI / Anthropic / Ollama client with structured JSON function calling. | **L** | 3 |
| **FIX-04** | **P0** | Replace regex router with LLM Planner | Route user requests to LLM tool-calling agent instead of 1,200 lines of `if/else` checks. | **XL** | 4 |
| **FIX-05** | **P0** | Fix Tauri CSP blocking web requests | Update CSP `connect-src` to allow external search endpoints and LLM provider APIs. | **S** | 5 |
| **FIX-06** | **P1** | Replace browser STT with local Whisper | Embed `whisper-rs` or native macOS SFSpeechRecognizer in Rust backend. | **L** | 6 |
| **FIX-07** | **P1** | Replace wake word hack with acoustic model | Integrate local openWakeWord or Porcupine in Rust audio stream. | **L** | 7 |
| **FIX-08** | **P1** | Remove hardcoded app allowlist | Dynamically scan `/Applications` using `NSWorkspace` instead of 25-app array. | **M** | 8 |
| **FIX-09** | **P1** | Real OCR / Vision screen understanding | Use Apple's native Vision framework (`VNRecognizeTextRequest`) in Rust. | **L** | 9 |
| **FIX-10** | **P1** | Menu bar / Global shortcut integration | Configure Tauri system tray icon and global hotkey (Option+Space). | **M** | 10 |

---

# PART 12 — WHAT NOT TO BUILD YET

1. **Live Cryptocurrency Trading**: Keep paper trading only.
2. **Google Workspace OAuth Integration**: Prioritize local desktop automation (Apple Mail, Calendar) before cloud OAuth.
3. **Chameleon Persona Switching**: Focus on core LLM intelligence first.
4. **Commercial Gumroad Licensing System**: Remove licensing gate until MVP is functional.

---

# PART 13 — RECOMMENDED ROADMAP

1. **STAGE 1 — Native macOS Stabilization**: Fix mouse clicking (`CGEvent`), add `Info.plist` permissions, fix CSP, add global shortcut.
2. **STAGE 2 — Core Brain / Real LLM**: Wire OpenAI / Claude API, replace `router.ts` with tool-calling agent.
3. **STAGE 3 — Robust Computer Control**: Dynamic application scanning via `NSWorkspace`, dynamic YouTube search.
4. **STAGE 4 — Voice Pipeline Overhaul**: Native macOS STT / Whisper, local wake word engine.
5. **STAGE 5 — Vision & Perception**: Native macOS OCR via Apple Vision framework.
6. **STAGE 6 — Packaging & Distribution**: Code signing and notarization.

---

# PART 14 — TOP 20 REAL-WORLD USER TESTS

1. Launch on fresh Mac -> **FAIL** (Gumroad gate blocks app)
2. Summon via Hotkey -> **FAIL** (No global shortcut)
3. Say "Hey Janki" -> **FAIL** (Web Speech fails in desktop WKWebView)
4. Ask general question -> **FAIL** (No LLM connected)
5. Search weather -> **FAIL** (CSP blocks DuckDuckGo)
6. Open Spotify -> **FAIL** (Not in 25-app allowlist)
7. Open Safari -> **PASS** (Launches via `open -a`)
8. Coordinate click -> **FAIL** (AppleScript error -600)
9. Type text in TextEdit -> **PASS** (Keystroke via System Events)
10. Play "Bohemian Rhapsody" -> **PASS** (Hardcoded video ID)
11. Play "Hotel California" -> **FAIL** (Plays "Believer" by Imagine Dragons)
12. Read PDF policy number -> **FAIL** (No OCR / Vision)
13. Send Gmail -> **FAIL** (Mocks to in-memory array)
14. Set volume -> **PASS** (System Events volume script)
15. Close window -> **PASS** (System Events close script)
16. Create file -> **PASS** (Rust sandboxed file write)
17. Speak Malayalam -> **FAIL** (STT locked to `en-US`)
18. Emergency Stop -> **PASS** (Kill switch stops loop)
19. Close window -> **FAIL** (Quits app instead of staying in menu bar)
20. Offline mode -> **FAIL** (Web Speech STT dies without internet)

---

# PART 15 — FINAL EXECUTIVE REPORT

### JANKI CURRENT STATUS
**PROTOTYPE / DEMO (Grade: A)**

### TOP 10 PROBLEMS
1. No connected LLM reasoning brain.
2. Broken mouse coordinate clicking in AppleScript.
3. Browser-dependent STT & wake word failing in desktop WKWebView.
4. Missing Info.plist permissions.
5. Strict Tauri CSP blocking web requests.
6. Hardcoded 25-application allowlist.
7. Screen vision lacks OCR or VLM.
8. Mocked Google Workspace integrations.
9. No background daemon or global summon hotkey.
10. Hardcoded YouTube song IDs.

### THE BIGGEST GAP
**There is no AI reasoning in the loop.** The previous phases built an elaborate user interface and complex rule tables, but skipped connecting an actual Large Language Model. Because every action is governed by rigid keyword matching, Janki cannot adapt, cannot understand intent variations, cannot answer questions, and cannot plan tasks dynamically.

### THE ONE NEXT ACTION TO TAKE
**Replace the hardcoded keyword router (`router.ts`) with a real LLM function-calling agent (`cloud-adapters.ts`) using an Anthropic or OpenAI API key.**
