# Janki 2.0 — Stage 1 Audit Report

**Date of Audit:** September 2026  
**Target Codebase:** `/Users/anoopdasvs/Downloads/Janki_M book_automation`  
**Application Version:** `0.1.0` (Tauri v2 + React 18 + TypeScript 5.7)  

---

# A. Current architecture

The current codebase is an interactive desktop prototype built with **Tauri v2 (`0.1.0`)**, **React 18**, **TypeScript 5.7**, **Tailwind CSS**, and a **Rust** backend. While presented as an autonomous AI desktop assistant, its operational topology is structured as follows:

```
[ User Input (Text / Web Speech API) ]
                 │
                 ▼
[ Intent Routing: CommandRouter (router.ts - 1,241 lines) ]
     └── Static keyword matching & regex branches
                 │
                 ├── Recognized Pattern ──► Static ActionPlan / WorkflowGraph
                 └── Unmatched Pattern  ──► "general_assistant" (No-op silent pass)
                 │
                 ▼
[ Safety & Policy Engine (policy-engine.ts & kill-switch.ts) ]
     └── Evaluates risk tiers (LOW / MEDIUM / HIGH / CRITICAL) & Kill Switch flag
                 │
                 ▼
[ Execution Coordinator (execution-loop.ts / useCommandStore.ts) ]
     ├── Dispatches to domain skills (skills/*) & tools (tools/*)
     └── Invokes NativeBridge (tauri-bridge.ts)
                 │
                 ├── Test Env (VITEST): Routes 100% to MockNativeDriver (in-memory)
                 ├── Browser Dev: HTTP fetch to Vite middleware (macos-bridge-plugin.ts)
                 └── Packaged App: Tauri IPC invoke() to Rust backend (src-tauri/src/commands/*)
                                       │
                                       ▼
                       [ macOS Native Bridge (Rust) ]
                       • osascript CLI subprocesses (control.rs, gui.rs, perception.rs)
                       • /usr/bin/open subprocesses (app_launch.rs)
                       • /usr/sbin/screencapture subprocesses (perception.rs)
                       • AXIsProcessTrusted FFI (permissions.rs)
```

### Architectural Realities:
1. **Frontend / State Layer**: UI views ([CommandCenterView](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/command/CommandCenterView.tsx), [TradingView](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/trading/TradingView.tsx), [SafetyCenterView](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/safety/SafetyCenterView.tsx)) driven by Zustand stores ([useCommandStore.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/state/useCommandStore.ts), [useSafetyStore.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/state/useSafetyStore.ts), [useAuditStore.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/state/useAuditStore.ts)). All views are gated behind [LicenseGate.tsx](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/licensing/LicenseGate.tsx) referencing local storage HMAC verification.
2. **Storage Layer**: [database.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/db/database.ts) runs `sql.js` (WebAssembly SQLite) in the renderer process. On every write transaction, the entire SQLite database buffer is exported as a binary blob and overwritten to disk or `localStorage`.
3. **Bridge Split**: System automation is implemented twice: once in Rust ([src-tauri/src/commands/](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/)) and once as Node.js Vite server middleware ([macos-bridge-plugin.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/server/macos-bridge-plugin.ts)). The Vite plugin is unavailable in production builds.
4. **Platform Binding**: 100% hardcoded to macOS Unix paths (`/usr/bin/osascript`, `/usr/bin/open`, `/Applications`). There is zero abstraction for Windows OS APIs.

---

# B. Phase 1–6 reality check

| Phase | Stated / Documented Goal | Implemented Code Reality | Status |
| :--- | :--- | :--- | :---: |
| **Phase 1: Native Desktop Foundation** ([Report](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/PHASE_1_FINAL_VERIFICATION.md)) | Secure standalone desktop app on Tauri v2, native command execution, safe sandbox, and offline SQLite persistence. | Tauri v2 compiles and packages `Janki.app`. However, [Info.plist](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/target/release/bundle/macos/Janki.app/Contents/Info.plist) lacks privacy usage descriptions (`NSMicrophoneUsageDescription`, `NSAppleEventsUsageDescription`), causing macOS TCC to silently block or terminate audio/AppleEvents. Coordinate mouse clicking in [control.rs:416](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/control.rs#L416) uses invalid AppleScript syntax (`click at {x, y}`), generating runtime error `-600`. [database.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/db/database.ts) uses dynamic import of `@tauri-apps/plugin-fs`, which is marked `external` in [vite.config.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/vite.config.ts#L20). | 🟡 **PARTIAL / CRITICAL BUGS** |
| **Phase 2 / 2.5: Computer Control & Hardening** ([Report](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/PHASE_2_5_WALKTHROUGH.md)) | Autonomous hands-free mouse, keyboard, window, and application automation across macOS apps with closed-loop verification. | Window control and keystrokes work via AppleScript System Events. However, mouse coordinate clicks are broken (`tell application "System Events" to click at`). App launching in [app_launch.rs:4](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/app_launch.rs#L4) is restricted to a hardcoded 25-app array (blocks Slack, Spotify, Discord, etc.). All 371 Vitest tests pass because [tauri-bridge.ts:466](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/native/tauri-bridge.ts#L466) automatically intercepts test environments and swaps in [MockNativeDriver](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/native/tauri-bridge.ts#L254), testing zero real OS commands. | 🟡 **PARTIAL / BRITTLE** |
| **Phase 3 / 3.5: Task Automation & Experience** ([Plan](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/PHASE_3_IMPLEMENTATION_PLAN.md)) | Contextual memory, ambiguity resolution, multimodal router, and seamless multi-turn conversation. | [router.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/router.ts) is a 1,241-line chain of `if...else if (lower.includes(...))`. Unmatched prompts trigger `general_assistant`, which has no execution handler in [useCommandStore.ts:680](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/state/useCommandStore.ts#L680) and silently returns `Executed action Review Request successfully` while doing nothing. Ambiguity detector only triggers on a few hardcoded string patterns. | 🔴 **BRITTLE ILLUSION** |
| **Phase 4: Autonomous Goal Orchestration** ([Report](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/PHASE_4_COMPLETE_WALKTHROUGH.md)) | Multi-step DAG decomposition, adaptive replanning, rollback coordinator, and variable piping across domains. | State machine and variable resolver ([VariableResolver](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/workflow/workflow-variable-resolver.ts)) are well-structured TypeScript logic. However, dynamic planning bypasses LLM reasoning: [router.ts:931](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/router.ts#L931) calls synchronous deterministic templates ([decomposeDeterministic](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/workflow/goal-decomposer.ts#L62)) containing only 4 hardcoded compound workflows. Dynamic goal decomposition via LLM is bypassed. | 🟡 **PARTIAL / MOCKED BRAIN** |
| **Phase 5: Web Research, Trading & Malayalam** ([Plan/Docs](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/README.md)) | Web research engine, Binance technical trading advisory, and full Malayalam voice support. | [web-search-tool.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/tools/web/web-search-tool.ts) queries DuckDuckGo via HTTP `fetch`, but [tauri.conf.json:27](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/tauri.conf.json#L27) CSP strictly restricts `connect-src` to `localhost` and `api.binance.com`, failing all live web fetches in production. Binance market ticker works, but live order execution is intentionally disabled. Malayalam "NLP" ([multilingual-nlp.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/multilingual-nlp.ts)) is a static dictionary of 19 regex words; speech recognition is hardcoded to `lang = 'en-US'` in [voice-provider.ts:39](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/voice/wake-word-listener.ts#L39). | 🔴 **BROKEN / STUBBED** |
| **Phase 6: Production Intelligence & Memory** ([Report](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/PHASE_6_COMPLETE_WALKTHROUGH.md)) | Gmail & Calendar integrations with OAuth PKCE, multimodal screen vision, vector long-term memory, and prompt-injection defense. | **Cloud LLM**: [cloud-adapters.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/llm/cloud-adapters.ts) is an empty stub returning `null`.<br>**Google Integration**: [gmail-client.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/integrations/google/gmail-client.ts) and [calendar-client.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/integrations/google/calendar-client.ts) query a hardcoded in-memory array (`simulatedInbox`). [google-auth-provider.ts:45](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/integrations/google/google-auth-provider.ts#L45) generates a dummy string `ya29.simulated_oauth_*` with zero Google OAuth communication.<br>**Screen Vision**: [screen-skill.ts:115](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/skills/screen/screen-skill.ts#L115) has no OCR or VLM; it scans the AppleScript UI tree with regex for `POL` / `INV` strings.<br>**YouTube**: [media.rs:73](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/media.rs#L73) maps 6 songs to video IDs; any other song plays Imagine Dragons' "Believer".<br>**Voice Stack**: Relies on browser `webkitSpeechRecognition`, which is unavailable or crippled inside desktop Tauri WKWebView. | 🔴 **SIMULATED / MOCKED** |

---

# C. KEEP / MODIFY / REPLACE / REMOVE

### 1. KEEP (Solid, well-engineered foundations)
- **Safety Architecture**: [policy-engine.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/policy-engine.ts), [kill-switch.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/kill-switch.ts), [redactor.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/redactor.ts), and [prompt-injection-defense.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/prompt-injection-defense.ts). Deterministic risk tiers (LOW/MEDIUM/HIGH/CRITICAL), sub-10ms kill switch interrupt, credential masking, and untrusted input quarantining are sound.
- **Workflow State Machine & Observability**: [workflow-engine.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/workflow/workflow-engine.ts), [workflow-variable-resolver.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/workflow/workflow-variable-resolver.ts), and [rollback-coordinator.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/workflow/rollback-coordinator.ts). Clean DAG step lifecycle, variable interpolation (`{{steps.id.output}}`), and LIFO rollbacks.
- **UI Framework & Design System**: [DesktopFrame.tsx](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/layout/DesktopFrame.tsx), [Sidebar.tsx](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/layout/Sidebar.tsx), [KillSwitchBanner.tsx](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/layout/KillSwitchBanner.tsx), [PlanReviewCard.tsx](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/approval/PlanReviewCard.tsx). Clean modern dark UI with reactive Zustand state bindings.
- **Sandboxed Local Filesystem Driver (Rust)**: [filesystem.rs](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/filesystem.rs). Path-sanitized read, write, and trash operations preventing path traversal (`..`) and protected system directory mutation.
- **Process Sanitizer (Rust)**: [process.rs](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/process.rs). Strict vector argument validation blocking dangerous shell meta-characters.

### 2. MODIFY (Fundamentally good design, requires bug fixes or expansion)
- **Native OS Bridge**: [tauri-bridge.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/native/tauri-bridge.ts). Refactor to support multi-platform OS drivers behind an abstract interface (`IOsDriver`).
- **Rust Mouse/Keyboard Automation**: [control.rs](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/control.rs). Fix the fatal AppleScript bug by replacing coordinate mouse clicks with CoreGraphics `CGEventCreateMouseEvent` on macOS, and Windows `SendInput` on Windows.
- **App Launcher**: [app_launch.rs](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/app_launch.rs). Replace the static 25-item array with dynamic system application indexing (`NSWorkspace` on macOS; Registry / Start Menu on Windows).
- **Web Search Tool**: [web-search-tool.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/tools/web/web-search-tool.ts). Update [tauri.conf.json](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/tauri.conf.json) CSP or proxy web requests through the Rust native backend to bypass browser CSP and bot blocks.
- **Persistence Layer**: [database.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/db/database.ts). Migrate from in-memory WASM `sql.js` (which overwrites the entire binary on every write) to native Rust SQLite (`rusqlite` or `tauri-plugin-sql`) for incremental, ACID-compliant transactions.
- **Tauri Packaging & Permissions**: [tauri.conf.json](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/tauri.conf.json). Add native `Info.plist` usage descriptions for Microphone, Speech, Screen Recording, and AppleEvents. Configure NSIS/MSI targets for Windows.

### 3. REPLACE (Broken, insufficient, or synthetic implementations)
- **Deterministic Intent Router**: [router.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/router.ts) (1,241 lines of regex). Replace with an LLM-based ReAct / Tool-Calling Agent Loop with structured JSON schema outputs.
- **Cloud LLM Adapter**: [cloud-adapters.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/llm/cloud-adapters.ts) (empty stub). Replace with a multi-provider LLM client (Anthropic Claude, OpenAI, Google Gemini, and local Ollama) with streaming and native tool execution.
- **Voice Stack & Wake Word**: [wake-word-listener.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/voice/wake-word-listener.ts) and [voice-provider.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/voice/voice-provider.ts). Replace the browser `webkitSpeechRecognition` hack with native Rust audio capture (`cpal`), local acoustic wake word detection (openWakeWord / Porcupine), and real STT (Whisper via `whisper-rs` or native OS speech APIs).
- **Screen Perception**: [screen-skill.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/skills/screen/screen-skill.ts). Replace regex parsing of UI elements with real OCR (Apple Vision `VNRecognizeTextRequest` on macOS; Windows OCR on Windows) and VLM (multimodal vision prompting).
- **Google Workspace Integrations**: [gmail-client.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/integrations/google/gmail-client.ts) and [calendar-client.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/integrations/google/calendar-client.ts). Replace in-memory fixture arrays with a real OAuth 2.0 PKCE loopback client or local desktop protocol integration (e.g., Apple Mail / Calendar AppleScript and Windows MAPI).
- **YouTube Media Resolver**: [media.rs:73](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/media.rs#L73). Replace the 6-item hardcoded song map with dynamic YouTube search query dispatch (`https://www.youtube.com/results?search_query=...`).

### 4. REMOVE (Dead code, redundant layers, or premature distractions)
- **Vite Node.js Bridge Plugin**: [macos-bridge-plugin.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/server/macos-bridge-plugin.ts). Duplicates Rust automation logic, only exists in Vite dev mode, creates security exposure, and does not run in the packaged app.
- **Pre-mature Commercial Licensing Gate**: [LicenseGate.tsx](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/licensing/LicenseGate.tsx) and [license-validator.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/licensing/license-validator.ts). Blocks development and user testing of pre-alpha software with a cosmetic 7-day trial check.
- **Branding Divergence**: References to old naming ("Orbit") in [README.md](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/README.md), [EULA.md](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/EULA.md), [PRIVACY_POLICY.md](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/PRIVACY_POLICY.md), and storage keys (`orbit_activation`, `orbit_sqlite_data`).

---

# D. Critical risks/gaps

### 1. Architectural Risks
- **Absence of a Reasoning Agent Brain**: The system cannot think, infer, or adapt. If a user command varies even slightly from hardcoded keywords in [router.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/router.ts), it silently passes into a no-op handler without error or feedback.
- **Dual-Bridge Divergence**: Having automation routines split between Node.js Vite server and Rust backend means development in browser dev does not validate production behavior.
- **Whole-DB Blob Rewriting**: Storing SQLite via WASM `sql.js` and writing the entire file on every keystroke/log will corrupt data on sudden shutdown and degrade performance exponentially as logs grow.

### 2. Technical Debt & False Confidence
- **100% Mocked Test Illusion**: All 371 Vitest tests pass because [tauri-bridge.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/native/tauri-bridge.ts) routes every test call to `MockNativeDriver`. There is zero test coverage executing real AppleScript, native system commands, or external APIs.
- **Simulated External Services**: Google Workspace, YouTube music playback, screen OCR, and speech recognition are documented as production-grade features in Phase 6 documentation, but are entirely synthetic stubs in code.

### 3. Security & Platform Permission Risks
- **macOS TCC Blockade**: Packaged `.app` lacks `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, `NSAppleEventsUsageDescription`, and `NSScreenCaptureUsageDescription`. macOS will terminate or reject core capabilities without these declarations.
- **Strict Content Security Policy (CSP)**: `connect-src` in [tauri.conf.json](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/tauri.conf.json) blocks all outbound external HTTPS requests except Binance, preventing web search, cloud LLMs, and real OAuth.
- **AppleScript Coordinate Click Bug**: `control.rs` line 416 causes runtime syntax failure (`-600`) whenever coordinate mouse clicks are dispatched.

### 4. Cross-Platform Risks (macOS + Windows)
- **Zero Windows Native Support**: 100% of the native automation in [src-tauri/src/commands/](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/) relies on macOS binaries (`/usr/bin/osascript`, `/usr/bin/open`, `/usr/sbin/screencapture`) and the macOS `ApplicationServices` framework (`AXIsProcessTrusted`). Compiling for Windows currently fails or produces an inert shell where every automation command fails immediately.
- **Audio & Speech Incompatibility**: Web Speech API is non-functional in macOS WKWebView and heavily restricted/unreliable in Windows WebView2. Windows requires SAPI / Windows Media Speech or native Whisper.
- **Filesystem Paths & Bundle Targets**: Hardcoded macOS bundle target `["app"]`, POSIX path separators, and `/Applications` directory assumptions break on Windows.

### 5. Major Missing Capabilities
- True offline or acoustic wake word detection ("Hey Janki").
- True multilingual voice understanding (Malayalam ASR + TTS).
- Real vision / OCR screen comprehension (reading PDFs, non-accessible windows, canvas).
- Live cloud LLM connectivity with function/tool calling.
- Background menu bar / system tray daemon with global summon shortcut.

---

# E. Janki 2.0 target architecture

Janki 2.0 must be re-architected from a "deterministic keyword router with simulated fixtures" into an **Autonomous, Cross-Platform Desktop Intelligence Platform**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       JANKI 2.0 CORE RUNTIME                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                          PRESENTATION LAYER                                             │
│   React 18 + Tailwind CSS (Zustand Stores: Command, Safety, Audit, ComputerState)                       │
│   • Global System Tray Daemon & Global Hotkey (Cmd/Ctrl + Shift + Space)                                │
│   • Streaming Thought & Action Timeline • Interactive Approval & Diff Review Card                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                        INTELLIGENCE LAYER                                               │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                REASONING AGENT CORE (ReAct Loop)                                │   │
│   │   • Multi-Provider LLM Client: Anthropic Claude / OpenAI / Gemini / Local Ollama (Streaming)     │   │
│   │   • Structured Tool-Calling Orchestrator: Dynamic Plan Formulation & Replanning                 │   │
│   │   • Prompt Injection Defense & Untrusted Context Sanitizer                                       │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│   ┌───────────────────────────────┐  ┌────────────────────────────────┐  ┌──────────────────────────┐   │
│   │  Episodic & Long-Term Memory  │  │  Multi-Turn Anaphora Resolver  │  │  Deterministic Policy    │   │
│   │  Local Vector DB + SQLite     │  │  Active Context Blackboard     │  │  LOW/MED/HIGH/CRITICAL   │   │
│   └───────────────────────────────┘  └────────────────────────────────┘  └──────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                       PERCEPTION & AUDIO ENGINE                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │   Native Audio Pipeline (Rust CPAL)                                                             │   │
│   │   • Wake Word: Local acoustic model (openWakeWord / Porcupine) running in background thread     │   │
│   │   • STT Engine: Local Whisper (whisper-rs) + Cloud Fallback (OpenAI Whisper / Google Speech)    │   │
│   │   • Multilingual Parity: Full Malayalam (ML) + English (EN) speech recognition and synthesis    │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │   Screen Understanding & Vision Pipeline                                                        │   │
│   │   • macOS: Apple Vision Framework (VNRecognizeTextRequest) + CoreGraphics Screen Capture        │   │
│   │   • Windows: Windows.Media.Ocr + Desktop Duplication API Screen Capture                         │   │
│   │   • Multimodal VLM: Screen diff inspection & visual element ground truth resolution             │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                    OS ABSTRACTION LAYER (Rust IPC)                                      │
│                                           trait OsDriver                                                │
│                 ┌─────────────────────────────────┴─────────────────────────────────┐                   │
│                 ▼                                                                   ▼                   │
│   [ MacOSDriver (Rust) ]                                             [ WindowsDriver (Rust) ]           │
│   • Mouse/Keyboard: CGEvent FFI                                      • Mouse/Keyboard: SendInput API    │
│   • UI Accessibility: ApplicationServices AX                        • UI Automation: Windows UIAutomation│
│   • App Scanning: NSWorkspace                                        • App Scanning: Registry / Win32   │
│   • Shell: Vectorized Tokio Command                                  • Shell: Vectorized Tokio Command  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                      PERSISTENCE & SECURITY                                             │
│   • Native Rust SQLite (rusqlite / WAL mode) • Encrypted Keyring (macOS Keychain / Windows Credential) │
│   • Hardware / Software Emergency Kill Switch (<10ms dominant thread interrupt)                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# F. Ordered roadmap

The roadmap is structured in strict dependency order—ensuring that lower-level native stability and real intelligence precede high-level integrations.

### Stage 1: Native Desktop Stabilization & Cross-Platform Hardware Foundation
- **Prerequisite**: None.
- **Deliverables**:
  1. Fix macOS coordinate mouse click bug in [control.rs](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/control.rs) using `CGEventCreateMouseEvent`.
  2. Implement cross-platform OS trait (`OsDriver`) in Rust with separate `macos.rs` and `windows.rs` modules (using `SendInput` on Windows).
  3. Add macOS privacy permissions to `tauri.conf.json` (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, `NSAppleEventsUsageDescription`, `NSScreenCaptureUsageDescription`).
  4. Fix Tauri network CSP to allow outbound LLM and search APIs.
  5. Replace dynamic 25-app allowlist in [app_launch.rs](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/app_launch.rs) with native `NSWorkspace` / Windows Registry discovery.
  6. Remove redundant Vite plugin [macos-bridge-plugin.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/server/macos-bridge-plugin.ts).
  7. Migrate [database.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/db/database.ts) from WASM full-buffer rewrites to native Rust SQLite with WAL mode.

### Stage 2: Real LLM Reasoning Core & Agentic Tool Execution Loop
- **Prerequisite**: Stage 1.
- **Deliverables**:
  1. Build multi-provider LLM adapter in [cloud-adapters.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/llm/cloud-adapters.ts) supporting Anthropic, OpenAI, Gemini, and Ollama with streaming.
  2. Secure API key storage via native OS keyring (macOS Keychain / Windows Credential Manager).
  3. Replace the 1,241-line [router.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/router.ts) regex engine with an LLM ReAct agent loop supporting structured JSON tool calling.
  4. Wire tool execution directly into [skill-registry.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/skills/skill-registry.ts) and [execution-loop.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/execution-loop.ts) with full parameter validation and truth-in-failure verification.
  5. Remove the cosmetic [LicenseGate.tsx](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/licensing/LicenseGate.tsx) to enable friction-free developer and user testing.

### Stage 3: Real Voice Pipeline & Acoustic Wake-Word Engine
- **Prerequisite**: Stage 1 & Stage 2.
- **Deliverables**:
  1. Implement Rust native microphone capture stream using `cpal`.
  2. Embed local acoustic wake-word engine (openWakeWord / Porcupine) for offline "Hey Janki" detection.
  3. Replace Web Speech STT with embedded local Whisper (`whisper-rs`) or cloud fallback.
  4. Add genuine Malayalam language models (ASR and TTS voice routing) to fulfill multilingual parity.
  5. Implement reliable audio barge-in / interrupt handling during speech synthesis.

### Stage 4: Real Perception & Vision Engine
- **Prerequisite**: Stage 1 & Stage 2.
- **Deliverables**:
  1. Implement native OCR pipeline: Apple Vision `VNRecognizeTextRequest` on macOS; Windows Media OCR on Windows.
  2. Integrate VLM (Vision Language Model) capabilities for analyzing screenshots, PDFs, web canvases, and non-accessible application windows.
  3. Replace mocked regex searches in [screen-skill.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/skills/screen/screen-skill.ts) with real bounding-box OCR coordinate detection.

### Stage 5: Live External Integrations & Tool Realization
- **Prerequisite**: Stage 2.
- **Deliverables**:
  1. Implement genuine Google Workspace OAuth 2.0 PKCE loopback server in Rust and replace [gmail-client.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/integrations/google/gmail-client.ts) / [calendar-client.ts](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/integrations/google/calendar-client.ts) mocks with live REST calls.
  2. Replace hardcoded song dictionary in [media.rs](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/media.rs) with live YouTube search dispatch.
  3. Implement native web research tool utilizing SearXNG, Tavily, or DuckDuckGo API through the Rust backend.

### Stage 6: System Integration, Background Daemon & True Verification
- **Prerequisite**: Stages 1 through 5.
- **Deliverables**:
  1. Add system tray (menu bar) daemon mode with a global summon shortcut (Cmd/Ctrl + Shift + Space).
  2. Rewrite integration test suite to validate real OS actions without mocking out the driver layer.
  3. Clean up legacy "Orbit" branding artifacts across documentation and EULA/Privacy files.
  4. Build automated CI packaging for macOS (`.dmg`, `.app`) and Windows (`.msi`, `.exe`).

---

# G. Recommended next action

**Execute Stage 1 Item 1 & Item 3 immediately:**
Fix the broken mouse clicking AppleScript in [src-tauri/src/commands/control.rs:387-422](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/src/commands/control.rs#L387-L422) by replacing `tell application "System Events" to click at {x, y}` with native CoreGraphics `CGEventCreateMouseEvent` FFI calls, and update [src-tauri/tauri.conf.json](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src-tauri/tauri.conf.json) to declare required macOS usage descriptions (`NSMicrophoneUsageDescription`, `NSAppleEventsUsageDescription`) and relax the network CSP for outbound intelligence services.
