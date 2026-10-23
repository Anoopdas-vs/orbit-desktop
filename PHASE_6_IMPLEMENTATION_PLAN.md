# Phase 6 Implementation Plan: Production Intelligence & Autonomous Desktop Assistant

## Overview
Phase 6 transforms Janki from an intelligent assistant architecture into a production-ready, autonomous personal desktop assistant running the full loop:
**UNDERSTAND → REMEMBER → PLAN → ACT → OBSERVE → VERIFY → RESPOND**

---

## 1. Architectural Components

### A. Real External Account Integrations
- **Credential Vault (`src/integrations/credential-vault.ts`)**: Secure OS keychain storage via macOS `security` CLI with encrypted in-memory cache; zero plaintext tokens in SQLite.
- **Google Auth Provider (`src/integrations/google/google-auth-provider.ts`)**: OAuth 2.0 PKCE flow, refresh tokens, expiry tracking, and scopes for Gmail and Google Calendar.
- **Gmail Client (`src/integrations/google/gmail-client.ts`)**: Full API client for reading, searching, summarizing, drafting, and sending emails.
- **Calendar Client (`src/integrations/google/calendar-client.ts`)**: Google Calendar integration with schedule conflict checking, meeting creation, and deletion gating.
- **Email & Calendar Tools (`src/tools/integrations/`)**: Safety-gated tools with `NEEDS_CONFIRMATION` and `HIGH` risk elevation for email dispatch and event removal.

### B. Long-Term Structured Memory & Privacy
- **Semantic Vector Search Engine (`src/core/memory/semantic-vector.ts`)**: Pure TypeScript cosine similarity over character 3-gram embeddings.
- **Categorized Memory (`src/core/memory-engine.ts`)**: `user_preference`, `personal_fact`, `project_context`, `recurring_workflow`, `business_context`, `frequent_application`, `previous_decision`, `historical_context`.
- **Temporal Lifecycle**: Differentiates between `temporary` (session) and `persistent` (SQLite) storage.
- **Strict Privacy Invariant**: Immediate rejection of raw API keys, bearer tokens, and passwords.

### C. Multimodal Screen / Vision Understanding
- **Native Screen Capture**: Rust backend command `cmd_capture_screen` invoking `/usr/sbin/screencapture -x`.
- **Perception & Accessibility Tree**: Integrates AXUIElement tree inspection with visual state analysis.
- **Screen Perception Skill (`src/skills/screen/screen-skill.ts`)**: Captures screen, inspects visible UI controls, extracts on-screen numbers/invoices, and explains active visual workspace.
- **Screen Understanding Tool (`src/tools/screen/screen-understanding-tool.ts`)**: Modular tool bridged to the registry with `screenRecording` permission enforcement.

### D. Autonomous Multi-Step Planning & Resilient Recovery
- **Checkpoint Manager (`src/core/workflow/checkpoint-manager.ts`)**: State snapshotting across all steps (`PENDING`, `RUNNING`, `WAITING_CONFIRMATION`, `SUCCESS`, `FAILED`, `BLOCKED`, `CANCELLED`, `RECOVERABLE`).
- **Resilient Recovery Analysis**: Determines whether a workflow can safely resume from the failed step or requires rollback/human confirmation.
- **Modular Specialized Agents (`src/core/agents/modular-agents.ts`)**: `PlannerAgent`, `ResearchAgent`, `ComputerAgent`, `MemoryAgent`, `VerificationAgent`, `FinalResponseAgent`.

### E. Prompt Injection Defense
- **Defensive Sanitizer (`src/core/prompt-injection-defense.ts`)**: Quarantines external web pages, emails, and OCR data inside `<untrusted_external_data>` tags.
- **Invariant**: External content is **DATA, NOT AUTHORITY**. Cannot override system instructions or bypass user confirmation gates.

### F. Voice-First & Multilingual Experience
- **Progress Voice Updates (`src/adapters/voice/voice-announcer.ts`)**: Natural spoken feedback ("Searching...", "Analyzing...", "Done.") in English and Malayalam (`ml-IN`).
- **Instant Interrupt (Barge-in) (`src/adapters/voice/wake-word-listener.ts`)**: Instant cancellation of speech synthesis on user barge-in.
