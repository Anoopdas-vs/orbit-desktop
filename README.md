# Orbit - Local-First Voice & Workflow Desktop Assistant for macOS

> **Orbit** is a production-quality, local-first macOS desktop assistant engineered around **uncompromising safety, explicit user intent, minimal permissions, auditability, and user control**.

Orbit translates natural-language voice and text commands into safe, reviewed automations on macOS for local software development workflows and strictly gated paper/spot crypto trading.

---

## 1. Safety Philosophy: Advisory NLU, Deterministic Control

Unrestricted autonomous agents that can execute arbitrary bash scripts, touch production secrets, or place live financial bets represent severe operational and financial hazards. Orbit avoids these traps by strictly enforcing architectural boundaries:

1. **Advisory LLM, Never Raw Execution**: LLMs (local Ollama or cloud adapters) act strictly as advisory intent parsers. LLM outputs are compiled into immutable, Zod-validated `ActionPlan` objects.
2. **Deterministic Risk Tiers**:
   - **LOW**: Safe read operations (open approved apps, read git status, check market prices).
   - **MEDIUM**: Scoped local mutations (start dev servers, run test suites, create git branches). Requires single-click user confirmation.
   - **HIGH**: Outbound/destructive operations (git commit/push, prepare PR, staging deploy). Requires explicit diff review.
   - **CRITICAL**: Production deployments, live spot order submission, database migrations. Requires dual confirmation and typing exact verification phrases (e.g., `Confirm spot buy BTCUSDT for ₹1000`).
3. **Emergency Kill Switch**: A global software/hardware interrupt that immediately terminates active subprocesses, disarms trading APIs, and freezes execution into a read-only lock state.
4. **Zero Plaintext Secrets & Active Redaction**: Secrets (`.env` files, API keys, private keys, passwords) are filtered out via regex before entering logs, UI, or prompt contexts. Real credentials reside exclusively in the encrypted macOS Keychain.
5. **No Guessed Operations**: If any command parameter, project path, or trading intent is ambiguous, Orbit triggers a focused clarification question rather than guessing.

---

## 2. Architecture Overview

Orbit is built with a dual-ready desktop architecture:

```
                            [ User Input ]
               Push-to-Talk Voice  /  Text Fallback
                                 │
                                 ▼
                     [ Speech-to-Text Engine ]
            Web Audio / Local Whisper.cpp / Mock Adapter
                                 │
                                 ▼
                 [ Intent & NLU Understanding ]
              Local Ollama HTTP API  /  Rule Fallback
                                 │
                                 ▼
                 [ Deterministic Command Router ]
           • Zod ActionPlan Validation  • Ambiguity Filter
                                 │
                                 ▼
                   [ Risk & Policy Evaluator ]
             [LOW]       [MEDIUM]       [HIGH]       [CRITICAL]
          (Auto/Click)   (1-Click)   (Diff Review) (Exact Phrase)
                                 │ (Confirmed)
                                 ▼
                     [ Controlled Executors ]
      • Allowlisted Subprocess Runner    • Safe App Launcher
      • Guided Dev & Spec Generator     • Mock Deploy Adapter
      • Mock GitHub PR Adapter          • Gated Binance Desk
                                 │
                                 ▼
                [ Append-Only SQLite Audit Ledger ]
             Audit Feed, Execution Logs, Trade Journal
```

### Tech Stack
- **Desktop Shell**: Tauri 2 ready (`src-tauri` Rust manifest & configuration) + Vite local desktop bridge
- **Frontend**: React 18, TypeScript (strict mode), Tailwind CSS (macOS dark theme)
- **State Management**: Zustand
- **Schema Validation**: Zod
- **Persistence**: SQLite (via WebAssembly `sql.js` with local persistence and full schema migrations)
- **Testing**: Vitest + Testing Library (41/41 unit & integration tests passing)

---

## 3. Getting Started & Setup

### Prerequisites
- macOS 14 Sonoma or later (Apple Silicon or Intel)
- Node.js v18+ (tested on Node.js v26.0.0)
- (Optional) [Ollama](https://ollama.ai) for local offline LLM reasoning
- (Optional for native binary packaging) Rust toolchain (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` or `brew install rust`)

### Installation
```bash
# Clone or navigate to the repository directory
cd "Janki_M book_automation"

# Install dependencies
npm install

# Copy environment example
cp .env.example .env
```

### Running the App
```bash
# Start Vite development server
npm run dev

# Open http://localhost:3000 in your browser or desktop container
```

### Running Tests and Build
```bash
# Run the complete Vitest test suite
npm run test:run

# Verify strict TypeScript types
npm run typecheck

# Build the production bundle
npm run build
```

---

## 4. macOS Permissions & Privacy Settings

Orbit interacts with macOS automation tools. Ensure you grant the necessary permissions when prompted:

1. **Microphone Access**: Required for push-to-talk voice recording. When you click the microphone button, Safari or the Tauri webview will request audio permissions.
2. **Accessibility & Automation (AppleScript)**:
   - Go to **System Settings > Privacy & Security > Accessibility**
   - Enable your terminal or Orbit desktop app
   - Go to **System Settings > Privacy & Security > Automation**
   - Allow Orbit to control Finder, Terminal, Safari, or VS Code

---

## 5. Integrating Local Ollama (Optional)

Orbit operates smoothly offline using its built-in rule-based classifier. If you want local neural network understanding:

1. Install Ollama:
   ```bash
   brew install ollama
   ```
2. Start the Ollama server:
   ```bash
   ollama serve
   ```
3. Pull a supported lightweight model:
   ```bash
   ollama pull llama3.2:latest
   ```
4. In Orbit's **Settings View**, confirm the URL `http://localhost:11434` and model name `llama3.2:latest`.

---

## 6. Binance & Trading Safety Warnings

> [!CAUTION]
> **Financial & Regulatory Disclaimer**:
> This tool does not provide financial or investment advice. Cryptocurrency assets are volatile. You are responsible for every submitted order.

### Strict Trading Rules:
- Live trading is **disabled by default** (mode: `OFF` or `PAPER_TRADING`).
- Live futures, margin, leverage, transfers, and withdrawals are **completely prohibited**.
- Per-order limit is strictly capped at **₹1,000 / $25** max.
- Daily cumulative limit is capped at **₹5,000 / $100** max.
- Vague prompts like *"Buy something promising"* are rejected by the ambiguity filter.
- Critical confirmation requires typing the exact phrase:
  `Confirm spot buy BTCUSDT for ₹1000` + checking the authorization checkbox + clicking the submission button.
- All executed orders are recorded to the local append-only `trade_journal` SQLite table.

---

## 7. Supported Voice & Text Commands

Try speaking or typing any of the following commands:
- `"Open my web app project"` → Opens the active registered project in VS Code.
- `"Start the development server"` → Runs allowlisted `npm run dev`.
- `"Run tests"` → Runs allowlisted `npm test` and captures stdout/exit code.
- `"Add a dark mode feature to my web app"` → Generates a structured `FeatureSpec` with acceptance criteria.
- `"Open Claude Code or Antigravity and prepare the feature task"` → Formulates a sandboxed agent prompt template.
- `"Create a Git branch and implement the feature"` → Validates slug and creates `feat/dark-mode`.
- `"Run tests, summarize changes, and prepare a pull request"` → Staged test verification, commit, branch push, and PR preparation.
- `"Open Binance"` → Opens Binance website in browser.
- `"Show BTC price"` → Fetches live public spot ticker for BTC/USDT.
- `"Prepare a BTC spot buy order for ₹1,000"` → Prepares spot paper order requiring double confirmation.
- `"Turn trading off"` → Instantly disarms all trading modules.
- `"Emergency stop"` or `"kill"` → Engages Emergency Kill Switch and halts all subprocesses.

---

## 8. Exporting Audit Records

Navigate to the **Audit Log** tab to view the complete chronological log of commands, transcriptions, approval decisions, executed tools, and sensitive redactions. Click **Export JSON Audit** to download an immutable JSON audit ledger.
