# CLAUDE.md - Janki Autonomous Desktop Platform Guide & Roadmap

This document serves as the master specification, architecture reference, and development guide for **Claude Code** and software engineers extending the Janki Automation Platform.

---

## 1. Project Overview & Vision

**Janki** is an autonomous, hands-free personal intelligence system and desktop automation platform engineered on macOS. It transitions natural voice and intent into deterministic, safety-reviewed system actions, market analytics, research reports, and media automation.

### Core Vision
1. **Zero-Touch Hands-Free Operation**: Voice-driven execution with zero mouse or keyboard requirement for low-risk actions.
2. **Context & Mood Empathy ("Mind Reader")**: Real-time mood detection and contextual response generation.
3. **Autonomous Multi-Tool Orchestration**: Chooses the right tools/software dynamically to deliver finished outputs (reports, data tables, actions).
4. **Domain Intelligence**: Professional technical trading level advisory (Binance) with strict financial risk gating.
5. **Chameleon Personas**: Adapts tone, philosophy, and expertise (Pioneer, Mentor, Psychologist, Father Figure, Spiritual Guide).
6. **Commercial Readiness**: Built-in licensing verification and audit logging designed for future SaaS commercialization.

---

## 2. Technology Stack & Directory Structure

```
Janki_M book_automation/
├── src/
│   ├── core/                  # Decision core & state machines
│   │   ├── router.ts          # Deterministic NLP intent router -> ActionPlan
│   │   ├── policy-engine.ts   # Risk tier evaluator (LOW, MEDIUM, HIGH, CRITICAL)
│   │   ├── persona-engine.ts  # Chameleon persona switcher (5 archetypes)
│   │   ├── ambiguity-detector.ts # Proactive clarifying question detector
│   │   ├── conversational-context.ts # Multi-turn dialog & confirmation memory
│   │   ├── kill-switch.ts     # Emergency subprocess & trading lock state
│   │   └── redactor.ts        # Regex credential & secret masker
│   ├── skills/                # Pluggable modular executors
│   │   ├── mood-intelligence.ts   # Emotional sentiment & mood soundtrack selector
│   │   ├── trading-advisory.ts    # Binance RSI, levels & trade timing recommendation
│   │   ├── autonomous-reporter.ts # Dynamic toolchain selector & report compiler
│   │   ├── youtube-ad-skipper.ts  # Background daemon for 500ms ad skipping
│   │   ├── youtube-launcher.ts    # Direct watch URL resolver & Chrome auto-play
│   │   ├── gui-controller.ts      # Native macOS AppleScript click/type automation
│   │   ├── app-availability.ts    # Fast application detector (native vs web fallback)
│   │   ├── terminal-runner.ts     # Allowlisted shell execution runner
│   │   ├── git-workflow.ts        # Git branch, commit, diff, push actions
│   │   └── ai-prompt-agent.ts     # Direct dispatch to ChatGPT / Claude apps
│   ├── adapters/
│   │   ├── trading/binance-adapter.ts # Live/paper spot desk & technical analysis
│   │   └── voice/                 # WebSpeech & SpeechSynthesis audio pipeline
│   ├── state/
│   │   ├── useCommandStore.ts     # Primary application Zustand store
│   │   ├── useSafetyStore.ts      # Kill switch & trading policy state
│   │   └── useAuditStore.ts       # Append-only execution audit log
│   ├── server/
│   │   └── macos-bridge-plugin.ts # Vite HTTP endpoints for macOS system control
│   ├── licensing/                 # HMAC-SHA256 license key validation & trial gate
│   └── components/                # React 18 UI components (Tailwind CSS)
├── scripts/
│   ├── test-janki.mjs             # Interactive voice & dialog terminal test runner
│   └── generate-license.mjs       # Commercial license key generator
└── tests/                         # Vitest unit & integration test suites (96 tests)
```

---

## 3. Essential Developer Commands

Run all commands inside the repository directory:

```bash
# 1. Start Local Development Server
npm run dev

# 2. Run Complete Test Suite (Vitest)
npm run test:run

# 3. TypeScript Typecheck (Strict Zero Errors)
npm run typecheck

# 4. Production Application Build
npm run build

# 5. Interactive Voice Terminal Verification
npm run test:janki

# 6. Generate Commercial License Keys
node scripts/generate-license.mjs user@example.com
```

---

## 4. Current Feature Implementation Status

| Feature Pillar | Implementation Details | Status |
| :--- | :--- | :--- |
| **Hands-Free Voice** | Continuous `"Hey Janki"` listening, text-to-speech feedback, auto-execution on `LOW` risk plans. | ✅ Production Ready |
| **Chameleon Personas** | 5 archetypes: Pioneer 🚀, Mentor 🎓, Psychologist 🧠, Father Figure 🛡️, Spiritual Guide ✨. | ✅ Production Ready |
| **Mood Music** | 5 mood profiles (Overloaded, Deep Flow, Tired, High Drive, Peaceful) mapped to YouTube playlists. | ✅ Production Ready |
| **YouTube Ad-Skipping** | 500ms background watcher daemon, DOM skip button trigger, 16x acceleration fallback. | ✅ Production Ready |
| **Binance Trade Advisory** | Real-time RSI-14, 24h high/low levels, Support/Resistance zones, entry verdict. | ✅ Production Ready |
| **Autonomous Reporter** | Auto-selects toolchain (data feeds, math engines, layout formatters) and generates reports. | ✅ Production Ready |
| **Licensing Gate** | Offline HMAC-SHA256 signature verification, 7-day trials, master key support. | ✅ Production Ready |

---

## 5. Architectural Rules & Engineering Principles

When implementing new features with Claude Code, strictly adhere to these architectural rules:

### Rule 1: Advisory NLU, Deterministic Risk Tiers
* Never execute raw unvalidated bash strings directly from an LLM.
* Every natural language intent must compile into an immutable, Zod-validated `ActionPlan` (`src/types/action-plan.ts`).
* Risk levels:
  * `LOW`: Safe read/launch operations (open apps, play music, check prices, compile reports). Auto-executes in Fast Mode.
  * `MEDIUM`: Scoped local mutations (run dev server, create branches). 1-click confirmation.
  * `HIGH`: Destructive or remote actions (git commit, git push, prepare PR). Explicit diff review.
  * `CRITICAL`: Financial orders (spot buy/sell). Requires dual-click and typing the exact verification phrase (e.g. `"Confirm spot buy BTCUSDT for ₹1000"`).

### Rule 2: Non-Blocking Web/Desktop Compatibility
* When using optional Tauri desktop plugins (e.g. `@tauri-apps/plugin-fs`), always use dynamic imports with `/* @vite-ignore */` so the app runs seamlessly in standard browsers without crashing Vite dev mode.

### Rule 3: Redaction & Plaintext Safety
* All prompts and logs must pass through `redactSensitiveData` (`src/core/redactor.ts`) before being stored or displayed.

---

## 6. Next Features Roadmap (For Claude Code Implementation)

Use Claude Code to pick up and build the following upcoming capabilities:

### Feature Task 1: Offline Local Speech-to-Text & Wake Word
* **Objective**: Replace browser Web Speech API with fully offline local models.
* **Stack**: Integrate **openWakeWord** or **Picovoice Porcupine** in Rust (`src-tauri`) + **Whisper.cpp (Metal accelerated)**.
* **File Targets**: `src-tauri/src/voice.rs`, `src/adapters/voice/native-whisper.ts`.

### Feature Task 2: Autonomous Screen Vision & Computer Use
* **Objective**: Allow Janki to read the screen visually, find UI buttons in any macOS application, and click them without requiring predefined AppleScript selectors.
* **Stack**: Local screenshot capture via `screencapture`, OmniParser or Claude Computer Use API, mouse dispatch via Rust `core-graphics` or `cliclick`.
* **File Targets**: `src/skills/gui-controller.ts`, `src/server/macos-bridge-plugin.ts`.

### Feature Task 3: Live Binance WebSocket & Order Book Depth Feed
* **Objective**: Upgrade public REST ticker polling to continuous real-time Binance WebSocket streaming (`wss://stream.binance.com:9443/ws/btcusdt@kline_15m`).
* **Capabilities**: Live order book imbalance detection (bids vs asks), liquidation spike warnings, and audio alerts when BTC crosses key support/resistance.
* **File Targets**: `src/adapters/trading/binance-adapter.ts`, `src/skills/trading-advisory.ts`.

### Feature Task 4: Long-Term Vector Memory & Episodic Graph
* **Objective**: Give Janki true long-term memory about the user’s life, mood history, project deadlines, and personal preferences.
* **Stack**: Local `sqlite-vec` extension on the existing SQLite database (`src/db/database.ts`).
* **File Targets**: `src/core/memory-engine.ts`, `src/db/database.ts`.

### Feature Task 5: Multimodal Generation Studio
* **Objective**: Hands-free creation of audio, images, and video recaps.
* **Engines**:
  * Voice: Kokoro-TTS or ElevenLabs WebSocket for natural voice synthesis.
  * Image: Flux.1 / DALL-E 3 for generating architecture diagrams and visual assets.
  * Video: Programmatic video generation with **Remotion** for daily work/market briefings.
* **File Targets**: `src/skills/multimodal-studio.ts`.

---

## 7. How to Add a New Skill (Checklist)

When instructing Claude Code to add a new skill:
1. Create `src/skills/[skill-name].ts` implementing the `SkillDefinition` interface.
2. Add routing patterns in `src/core/router.ts`.
3. Add the skill execution handler in `src/state/useCommandStore.ts` inside `approveAction`.
4. Add state properties to `CommandState` if UI rendering is required.
5. Add unit tests in `tests/[skill-name].test.ts`.
6. Run `npm run test:run` and `npm run typecheck` to verify zero regressions.
