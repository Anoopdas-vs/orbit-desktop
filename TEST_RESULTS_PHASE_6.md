# Test Results: Janki AI — Phase 6

## Test Execution Summary

- **Total Test Suites**: 51 suites
- **Total Tests Executed**: 371 tests
- **Tests Passed**: 371
- **Tests Failed**: 0
- **Pass Rate**: 100.0%
- **Execution Duration**: ~20.06s
- **Rust Unittests**: 15/15 passed

---

## Suite Breakdown

### 1. Phase 6 Security & Prompt Injection (`tests/phase-6-security-prompt-injection.test.ts`)
- `detects and flags system override instructions in untrusted external text` — PASSED
- `detects hidden developer mode and jailbreak evasion prompts` — PASSED
- `quarantines benign content safely inside boundary tags` — PASSED
- `detects hijacked user commands derived from untrusted contexts` — PASSED
- `redacts OAuth tokens, refresh tokens, and client secrets from logs and memory` — PASSED
- `refuses to store raw passwords or unredacted bearer tokens in long-term memory` — PASSED

### 2. Phase 6 Real Integrations (`tests/phase-6-integrations-gmail-calendar.test.ts`)
- `stores and retrieves OAuth tokens securely without plaintext leaks` — PASSED
- `handles Google authentication lifecycle and token validity` — PASSED
- `reads, searches, and summarizes Gmail inbox messages with injection defense` — PASSED
- `enforces human confirmation before dispatching emails (send_email)` — PASSED
- `reads calendar events and detects schedule conflicts` — PASSED
- `creates calendar events and enforces confirmation on deletion` — PASSED

### 3. Phase 6 Long-Term Memory & Vectors (`tests/phase-6-long-term-memory.test.ts`)
- `computes cosine similarity correctly for related texts` — PASSED
- `stores memories across new Phase 6 categories and performs semantic retrieval` — PASSED
- `supports temporary session lifecycle vs persistent storage` — PASSED
- `filters and ranks contextual memories to avoid LLM context bloat` — PASSED

### 4. Phase 6 Multimodal Screen Vision (`tests/phase-6-screen-understanding.test.ts`)
- `captures the current screen safely to disk` — PASSED
- `inspects visible active desktop window controls and dialog elements` — PASSED
- `locates specific text or invoice patterns on screen` — PASSED
- `explains screen state clearly for user queries ("What is on my screen?")` — PASSED
- `executes the Observe -> Act -> Observe Again -> Verify loop` — PASSED

### 5. Phase 6 Autonomous Planning & Checkpoint Recovery (`tests/phase-6-autonomous-workflow-recovery.test.ts`)
- `coordinates modular specialized agents under unified safety constraints` — PASSED
- `records execution checkpoints and evaluates recovery strategy` — PASSED
- `fails closed when an irrecoverable workflow failure occurs` — PASSED

### 6. Phase 6 Voice & Multilingual Experience (`tests/phase-6-multilingual-voice.test.ts`)
- `detects English vs Malayalam intents and selects appropriate voice language` — PASSED
- `announces long-task progress steps naturally in English and Malayalam` — PASSED
- `supports instant voice interrupt (barge-in) and task cancellation` — PASSED

### 7. Phase 1–5 Regression Tests (45 suites, 344 tests)
- All 344 tests passed with zero regressions.

### 8. Rust Backend Commands (`cargo test`)
- 15 tests passed across process, permissions, control, and filesystem modules.
