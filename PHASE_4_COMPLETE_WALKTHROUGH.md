# Janki AI — Phase 4 Complete Architectural Walkthrough
## Autonomous Goal Orchestration & Dynamic Workflow Engine (Phases 4A, 4B, 4C)

**Project**: Janki AI — Commercial-Grade Hands-Free Autonomous Desktop Assistant for macOS  
**Operating Environment**: macOS Sonoma / Sequoia (Tauri v2 + Rust Core + React 18 + Vite + TypeScript 5)  
**Authoritative Phase**: Phase 4 Complete (Phase 4A + Phase 4B + Phase 4C)  
**Date**: September 26, 2026  
**Audience**: AI Reviewers, Systems Architects, and Technical Leads (ChatGPT / External Evaluators)

---

## 1. Executive Summary & Purpose

Before Phase 4, Janki AI operated primarily on **single-turn commands** and localized single-skill workflows (e.g., launching an application, opening a specific URL, or running a single Spotlight query). While robust, it lacked the ability to:
1. Autonomously decompose compound, multi-intent natural language requests into structured multi-step dependency graphs.
2. Pipe runtime execution data across disparate macOS domains (e.g., taking the output file paths of a Finder search and feeding them directly into an extraction/document skill).
3. Autonomously diagnose environment failures (browser timeouts, element selector drift, missing files, unresponsive apps) and adaptively replan without human intervention.
4. Cleanly rollback partially executed side-effects (LIFO non-destructive compensating actions) when a workflow encounters an unrecoverable failure.
5. Provide deterministic state machine execution, real-time audio telemetry, and visual timeline observability with strict credential redaction and sub-10ms emergency kill-switch dominance.

**Phase 4** was executed across three sequential sub-phases:
- **Phase 4A**: Unified Workflow Engine, Multi-Step Orchestrator & Dataflow Pipeline
- **Phase 4B**: Context-Aware Failure Recovery & Adaptive Branching
- **Phase 4C**: Workflow State Machine, Observability & Lifecycle UX

### Key Verification Milestones
- **TypeScript**: Strict 0 errors (`npm run typecheck`) across the entire repository.
- **Vitest Unit & Integration**: **310 tests passed across 43 test files** (up from 229 tests across 33 files at Phase 3.5 baseline; +81 tests added).
- **Rust Native Engine**: 15 tests passed (`cargo test`).
- **Production Build**: Clean production bundle generated in 12.2s (`dist/index.html`, `dist/assets/index-*.js`).

---

## 2. High-Level Architecture & End-to-End Pipeline

The following diagram illustrates how a user command flows through the Phase 4 autonomous orchestration pipeline:

```mermaid
flowchart TD
    User([User Voice or Text Command\nEnglish / Malayalam / Manglish]) --> Decomposer[Tier 1 / Tier 2 Goal Decomposer\ngoal-decomposer.ts]
    
    Decomposer -->|Deterministic Templates\nor Local Ollama Fallback| WF[WorkflowDefinition\nZod Validated Graph]
    
    WF --> Engine[WorkflowEngine State Machine\nworkflow-engine.ts]
    
    subgraph Lifecycle [Execution Loop]
        Engine --> KS1{Kill Switch\nEngaged?}
        KS1 -->|Yes| Abort[ABORTED_BY_KILL_SWITCH\n<10ms Instant Halt]
        KS1 -->|No| RiskCheck{Step Risk Level\nHIGH / CRITICAL?}
        
        RiskCheck -->|Yes| Pause[PAUSED_FOR_APPROVAL\nAwaiting Explicit User Auth]
        RiskCheck -->|No| Resolve[VariableResolver\nSubstitute {{steps.id.output}}]
        
        Resolve --> Dispatch[SkillRegistry.dispatch\nFiles / Browser / System / Computer Control]
        
        Dispatch --> StepSuccess{Step Result\nSuccess?}
        
        StepSuccess -->|Success| Cache[Cache Output & Step Record\nTaskContextManager Checkpoint]
        Cache --> NextStep{More Steps?}
        NextStep -->|Yes| Engine
        NextStep -->|No| Complete[COMPLETED]
        
        StepSuccess -->|Failure| Catalog[RecoveryCatalog Diagnosis\nrecovery-catalog.ts]
        Catalog --> Replan{ReplanningEngine\nBudget <= 2 & Risk Clamped?}
        
        Replan -->|Viable Plan| Recover[RECOVERING\nInsert Remediation & Resume]
        Recover --> Engine
        
        Replan -->|Unrecoverable / Budget Exhausted| Rollback[RollbackCoordinator\nLIFO Compensating Actions]
        Rollback --> Fail[FAILED\nTruth-in-Failure Audit]
    end
    
    subgraph Observability [Telemetry & UI]
        Engine -.-> Voice[VoiceAnnouncer\nMilestones & 1.5s Throttling]
        Engine -.-> Store[useWorkflowStore\nReactive Zustand Store]
        Store -.-> HUD[ComputerStateHud & WorkflowInspectorModal\nTimeline, Progress & Redacted Parameters]
    end
```

---

## 3. Phase 4A: Unified Workflow Engine, Multi-Step Orchestrator & Dataflow Pipeline

Phase 4A established the foundation for compound goal decomposition and cross-step runtime variable passing.

### 3.1 Dynamic Variable Resolution Engine (`src/core/workflow/variable-resolver.ts`)
- **Expression Syntax**: Supports `{{steps.<stepId>.output.<path>}}`, `{{<stepId>.output.<path>}}`, `{{workflow.inputs.<var>}}`, and `{{context.<key>}}`.
- **Nested Traversal & Array Indexing**: Traverses deep object structures and array indices using both dot notation (`output.files.0.path`) and bracket notation (`output.files[0].path`).
- **Exact Type Preservation**: When a parameter value consists solely of a token expression (e.g., `"{{steps.search.output.files}}"`), it resolves directly to the actual runtime type (Array, Object, Number, or Boolean) without stringification.
- **Embedded String Interpolation**: Interpolates multiple tokens embedded in free text (e.g., `"Found {{steps.search.output.count}} files in {{steps.search.output.directory}}"`).
- **Prototype Pollution Defense**: Explicitly blocks `__proto__`, `constructor`, and `prototype` tokens at all nesting levels to prevent code injection via dynamic inputs.

### 3.2 Compound Goal Decomposer (`src/core/workflow/goal-decomposer.ts`)
- **Tier 1 (Deterministic Fast-Path)**: Zero-latency (<5ms), zero-token matching for recurring operational combinations across macOS:
  - **Files $\rightarrow$ Document**: Search files by extension/name $\rightarrow$ extract content $\rightarrow$ open TextEdit / Notes and type report.
  - **Browser Research $\rightarrow$ Document**: Navigate to URL / Search query $\rightarrow$ extract text $\rightarrow$ compile summary report.
  - **System Diagnostics $\rightarrow$ Log**: Collect macOS battery/network/disk metrics $\rightarrow$ write diagnostics file $\rightarrow$ notify user.
  - **Safe File Organization**: Locate downloads $\rightarrow$ categorize into folders $\rightarrow$ confirm moves.
- **Multilingual Support**:
  - English: *"find all pdfs in downloads and summarize them in textedit"*
  - Malayalam Script: *"ഡൗൺലോഡ്സിലെ എല്ലാ പിഡിഎഫുകളും കണ്ടെത്തി ടെക്സ്റ്റ് എഡിറ്ററിൽ സംഗ്രഹം എഴുതുക"*
  - Manglish (Phonetic Transliteration): *"downloads-il olla ellam pdf kandethuka ennit textedit-il summary ezhuthuka"*
- **Tier 2 (Local LLM Fallback)**: Structured fallback using Ollama (`llama3` / `mistral` / `qwen`). Strictly validates output against `WorkflowDefinitionSchema` (Zod), rejecting any unregistered `skillId`s.

### 3.3 Dynamic Planner & Unified Skill Dispatching
- Integrated `goalDecomposer` directly into `DynamicPlanner` (`src/core/dynamic-planner.ts`) ahead of single-app fallback heuristics.
- Refactored `useCommandStore` from ad-hoc manual branching to standard `SkillRegistry.dispatch(...)`, dynamically resolving step parameters against `executionStepOutputs`.

---

## 4. Phase 4B: Context-Aware Failure Recovery & Adaptive Branching

Phase 4B introduced autonomous diagnostic intelligence, self-healing replanning, and non-destructive transaction rollbacks.

### 4.1 Domain-Aware Recovery Catalog (`src/core/workflow/recovery-catalog.ts`)
When an action fails, `RecoveryCatalog.diagnose(...)` evaluates the error message, target application, action type, and step parameters against domain-specific recovery rules:
1. **Browser Navigation Timeouts (`BROWSER_TIMEOUT`)**:
   - Diagnoses network stalls and page load hangs in Safari / Google Chrome.
   - Generates a remediation step to reload the active tab (`browser_skill:reload_tab`) before re-attempting navigation.
2. **Missing Files (`FILE_NOT_FOUND`)**:
   - Diagnoses `ENOENT` / missing path errors.
   - Extracts the target file basename and generates a Spotlight search step (`files_skill:find_files`) constrained to safe user directories (`~/Downloads`, `~/Documents`) before re-attempting the dependent step.
3. **Element Selector Drift & Accessibility Disconnects (`ELEMENT_NOT_FOUND`)**:
   - If the element is suspected below the fold, issues a `PageDown` scroll remediation step.
   - If obscured, issues an application refocus command (`Cmd + L` or window click).
4. **Window Minimized / Hidden (`WINDOW_MINIMIZED`)**:
   - Generates a `zoom_window` step via `computer_control` to restore visibility.
5. **Application Unresponsive / Beachballing (`APP_UNRESPONSIVE`)**:
   - Generates an application re-activation or restart remediation step.
6. **Security & Sandbox Violations (`PERMISSION_DENIED`)**:
   - Enforces immediate `FAIL_CLOSED` directive with 0 recovery steps. Never attempts to bypass permissions or sandbox policies.
7. **Risk Ceiling Clamping**:
   - Guarantees that no recovery step is ever assigned a higher risk level than the user-approved task risk level.

### 4.2 Hardened Replanning Engine (`src/core/replanning-engine.ts`)
- **Strict Budget Cap**: Replan attempts are capped at `maxReplans ?? 2`. Once exhausted, the engine immediately fails closed.
- **Risk Escalation Prevention**: If any recovery action proposed by the catalog or LLM exceeds `task.overallRisk`, the replan is rejected.
- **No Blind Retries**: Prohibits repeating the exact failed action with identical parameters without an intervening remediation step.
- **Dynamic Step Re-sequencing**: Preserves the original step identity (`failedStep.id`) for retried steps so that downstream variable bindings (`{{steps.step_1.output...}}`) remain valid.

### 4.3 Step Rollback & Compensating Coordinator (`src/core/workflow/rollback-coordinator.ts`)
When a workflow fails unrecoverably or is aborted, `RollbackCoordinator` derives and executes non-destructive compensating actions in reverse order (LIFO):
- **Auto-Derivation**:
  - `files_skill:create_file` $\to$ `files_skill:move_to_trash` (moves created file to Trash).
  - `files_skill:move_file` $\to$ `files_skill:move_file` (swaps `path` and `newPath`).
  - `files_skill:rename_file` $\to$ `files_skill:rename_file` (swaps `path` and `newPath`).
  - `document_skill:create_document` $\to$ `files_skill:move_to_trash` for the created artifact.
- **Irreversible Action Handling**:
  - Identifies irreversible operations (e.g., `binance_spot_order`, `open_url`, `send_email`). Safely marks `isReversible: false`, skips execution, and logs the boundary.
- **Path Security**: Runs `validateSafeFilePath` before executing file rollbacks. Strictly prohibits any rollback touching `~/.ssh`, `~/.aws`, system directories, or configuration roots.
- **Kill-Switch Dominance**: Halts rollback immediately if `killSwitch.isEngaged()`.
- **Audit Logging**: Logs every compensating step execution to `useAuditStore`.

---

## 5. Phase 4C: Workflow State Machine, Observability & Lifecycle UX

Phase 4C wrapped the workflow capabilities in a deterministic state machine, real-time audio feedback, and a visual HUD inspector.

### 5.1 Deterministic Workflow Engine Lifecycle (`src/core/workflow/workflow-engine.ts`)
Manages strict lifecycle state transitions:
$$\text{PENDING\_APPROVAL} \longrightarrow \text{RUNNING} \longleftrightarrow \text{PAUSED\_FOR\_APPROVAL} \longleftrightarrow \text{RECOVERING} \longrightarrow \begin{cases} \text{COMPLETED} \\ \text{FAILED} \\ \text{ABORTED\_BY\_KILL\_SWITCH} \end{cases}$$

- **Pre-Step Kill-Switch Evaluation**: Checks `killSwitch.isEngaged()` synchronously prior to starting every step and before variable substitution (<10ms abort latency).
- **Step-Level Risk Gating**: When a step has a risk level of `HIGH` or `CRITICAL`, execution halts and state transitions to `PAUSED_FOR_APPROVAL` until the user provides explicit authorization.
- **Milestone & Periodic Checkpointing**: Checkpoints execution state via `TaskContextManager.checkpointTask(...)` at each milestone transition to survive crashes.

### 5.2 Real-time Voice Milestone Announcer (`src/adapters/voice/voice-announcer.ts`)
- **Lifecycle Milestones**: Emits audio announcements for:
  - `WORKFLOW_STARTED`: *"Starting workflow: [Goal]"*
  - `STEP_COMPLETED`: *"Completed step X of Y: [Action]"*
  - `APPROVAL_REQUIRED`: *"Action requires your approval: [Action]"*
  - `RECOVERY_TRIGGERED`: *"Issue detected. Attempting recovery: [Reason]"*
  - `WORKFLOW_COMPLETED`: *"Workflow completed successfully: [Goal]"*
  - `WORKFLOW_FAILED`: *"Workflow failed at step X: [Error]"*
  - `WORKFLOW_ABORTED`: *"Workflow aborted by emergency stop"*
- **Throttling & Debouncing**: Routine progress updates (`STEP_COMPLETED`) are throttled to a minimum interval of 1500ms to prevent audio stutter during fast automation steps.
- **Urgent Bypass**: Critical alerts (`APPROVAL_REQUIRED`, `WORKFLOW_ABORTED`, `WORKFLOW_FAILED`) immediately bypass the throttle.
- **Phonetic Normalization**: Sanitizes technical terms and file paths through a macOS pronunciation dictionary.
- **Barge-In Dominance**: Speech synthesis stops immediately when the user speaks or hits the emergency stop.

### 5.3 Workflow State Store (`src/state/useWorkflowStore.ts`)
A global reactive Zustand store tracking:
- `activeWorkflow`: The active `WorkflowDefinition`.
- `status`: Current `WorkflowStatus`.
- `currentStepIndex`: 0-based pointer to the active step.
- `stepRecords`: Detailed array of `StepExecutionRecord` (status, inputs, output, error, timing, replan attempts).
- `lastResult`: Final `WorkflowExecutionResult`.
- `isInspectorOpen`: Modal visibility state.

### 5.4 Workflow Inspector Modal (`src/components/workflow/WorkflowInspectorModal.tsx`)
- **Visual Progress Bar & Status Badges**: Live color-coded progress indicator (`RUNNING` in amber, `COMPLETED` in green, `FAILED` in red, `PAUSED` in yellow).
- **Interactive Step Timeline**: Expandable step cards displaying action name, skill ID, duration, and parameter details.
- **Sensitive Credential Redaction**: Uses `sanitizeObject` and `redactSensitiveData` to guarantee that API keys, passwords, bearer tokens, and private paths are never rendered in cleartext.
- **Lifecycle Controls**: Interactive buttons to Pause, Resume, Abort, and Close the workflow directly from the UI.
- **HUD Mount**: Accessible from the persistent `ComputerStateHud` via the "Inspector" button.

---

## 6. End-to-End Execution Walkthrough (Concrete Example)

To illustrate how all three sub-phases collaborate, consider this real-world user scenario:

### User Prompt
> *"Find all financial reports in Downloads, extract the text, and write a summary in TextEdit."*

### Step 1: Goal Decomposition (Phase 4A)
`GoalDecomposer` matches the **Files $\to$ Document** compound pattern:
- **Step 1 (`search_files`)**: `files_skill:find_files` with `{ query: "financial report", directory: "~/Downloads" }`.
- **Step 2 (`extract_text`)**: `document_skill:extract_text` with `{ path: "{{steps.search_files.output.files[0].path}}" }`.
- **Step 3 (`write_report`)**: `computer_control:open_app` + type text into TextEdit with `{ app: "TextEdit", text: "{{steps.extract_text.output.summary}}" }`.

### Step 2: Engine Initialization & Observability (Phase 4C)
- `WorkflowEngine` loads the definition.
- `useWorkflowStore` sets status to `RUNNING` and initializes step records.
- `VoiceAnnouncer` speaks: *"Starting workflow: Find all financial reports in Downloads and summarize in TextEdit"*.
- `ComputerStateHud` displays the active workflow badge with an "Inspector" button.

### Step 3: Step 1 Execution & Output Caching (Phase 4A)
- Pre-step kill switch evaluated (PASS).
- Step risk evaluated (`LOW` $\to$ PASS).
- `SkillRegistry.dispatch("files_skill:find_files", ...)` executes.
- Output cached: `{ files: [{ path: "/Users/user/Downloads/Q3_financial_report.pdf", name: "Q3_financial_report.pdf" }] }`.
- `VoiceAnnouncer` speaks: *"Completed step 1 of 3: find files"*.

### Step 4: Step 2 Failure & Adaptive Recovery (Phase 4B)
- Pre-step kill switch evaluated (PASS).
- `VariableResolver` resolves `{{steps.search_files.output.files[0].path}}` $\to$ `"/Users/user/Downloads/Q3_financial_report.pdf"`.
- Suppose the extraction skill fails with `FILE_NOT_FOUND` (e.g. file was moved to an archive subfolder).
- `RecoveryCatalog.diagnose(...)` identifies `FILE_NOT_FOUND`.
- `ReplanningEngine` checks budget (`replanCount: 0 < 2`) and risk level (matches `LOW`).
- Generates a Spotlight fallback search step (`search_archive`) followed by the retried `extract_text` step with retained ID.
- `WorkflowEngine` sets status to `RECOVERING`.
- `VoiceAnnouncer` speaks: *"Issue detected. Attempting recovery: Locate file via Spotlight"*.
- Spotlight locates the file at `/Users/user/Downloads/Archive/Q3_financial_report.pdf`.
- `extract_text` executes successfully. Output cached: `{ summary: "Q3 Revenue was $12M..." }`.

### Step 5: Step 3 Execution & Completion (Phase 4A & 4C)
- `VariableResolver` resolves `{{steps.extract_text.output.summary}}`.
- Step 3 opens TextEdit and types the summary.
- `WorkflowEngine` sets status to `COMPLETED`.
- `VoiceAnnouncer` speaks: *"Workflow completed successfully: Find all financial reports in Downloads and summarize in TextEdit"*.
- `TaskContextManager` writes final checkpoint.
- User can click "Inspector" on the HUD to review the execution timeline and exact step durations.

### Alternative Branch: Unrecoverable Failure & Rollback (Phase 4B)
- If an unrecoverable failure occurs (e.g., permission denied or 2-replan budget exhausted):
- `RollbackCoordinator` takes all completed steps in LIFO order.
- Any temporary scratch files or documents created during the workflow are safely moved to the macOS Trash (`files_skill:move_to_trash`).
- Path validation ensures system files are never touched.
- `useWorkflowStore` updates status to `FAILED`.
- `VoiceAnnouncer` speaks: *"Workflow failed. Executed compensating rollbacks."*
- Full rollback details are persisted in `useAuditStore`.

---

## 7. Key Architectural Invariants & Safety Guarantees

| Invariant | Implementation Mechanism | Enforcement Level |
|---|---|---|
| **Emergency Kill-Switch Dominance** | Synchronous check `killSwitch.isEngaged()` evaluated before every step and variable resolution in `WorkflowEngine`, and during `RollbackCoordinator` loops. | **Sub-10ms hard halt.** Halts execution immediately without executing pending steps. |
| **Risk Gating & Confirmation** | Step risk level verified against `HIGH` and `CRITICAL` thresholds. Automatically pauses workflow into `PAUSED_FOR_APPROVAL`. | **Strict zero-bypass.** High-risk actions cannot execute without affirmative user input. |
| **Strict Replan Budget Cap** | `ReplanningEngine` enforces `replanCount <= 2`. Rejects further replans when budget is reached. | **Fail-Closed.** Prevents infinite self-healing loops. |
| **Zero Risk Escalation** | `ReplanningEngine` validates all generated recovery steps against `task.overallRisk`. Clamps or rejects escalating steps. | **Inviolable Ceiling.** A low-risk task can never spawn a high-risk recovery action. |
| **Zero Blind Retries** | `ReplanningEngine` rejects recovery proposals that merely repeat the failed action without remediation. | **Diagnostic Guarantee.** Retries must be preceded by environmental remediation. |
| **Safe Path Protection** | All rollback file operations run through `validateSafeFilePath`. | **Filesystem Boundary.** Rollback operations targeting `~/.ssh`, `~/.aws`, or root dirs throw `FileValidationError`. |
| **Prototype Pollution Immunity** | `VariableResolver` blocks `__proto__`, `constructor`, and `prototype` in variable lookup tokens. | **Object Protection.** Prevents prototype poisoning via untrusted dynamic inputs. |
| **Sensitive Parameter Redaction** | `WorkflowInspectorModal` sanitizes and redacts all parameters before rendering. | **Credential Masking.** API keys, passwords, and tokens are replaced with `[REDACTED_CREDENTIAL]`. |
| **Audio Telemetry Throttling** | `VoiceAnnouncer` enforces 1.5s interval throttling on routine progress while allowing urgent bypass. | **UX Protection.** Prevents audio flooding and speech synthesis overlap during rapid execution. |

---

## 8. Complete Codebase Map (Phase 4 Deliverables)

### Files Created in Phase 4
| File Path | Phase | Purpose |
|---|---|---|
| `src/types/workflow.ts` | 4A / 4C | TypeScript types & Zod schemas for workflows, steps, bindings, records, and milestones. |
| `src/core/workflow/variable-resolver.ts` | 4A | Dynamic variable resolution engine with type preservation and prototype safety. |
| `src/core/workflow/goal-decomposer.ts` | 4A | 2-tier compound goal decomposer (deterministic templates + local Ollama fallback). |
| `src/core/workflow/recovery-catalog.ts` | 4B | Domain-aware failure diagnostic rules and remediation step generator. |
| `src/core/workflow/rollback-coordinator.ts` | 4B | LIFO compensating rollback coordinator with path validation and audit logging. |
| `src/core/workflow/workflow-engine.ts` | 4C | State machine lifecycle engine with risk gating, kill-switch checks, and recovery loops. |
| `src/state/useWorkflowStore.ts` | 4C | Reactive Zustand store for workflow execution state and inspector observability. |
| `src/components/workflow/WorkflowInspectorModal.tsx` | 4C | Visual observability HUD modal with timeline, credential masking, and lifecycle controls. |

### Test Suites Created in Phase 4
| Test Suite File | Phase | Tests | Description |
|---|---|---|---|
| `tests/workflow-variable-resolver.test.ts` | 4A | 22 | Parameter resolution, array indexing, nested paths, prototype pollution safety. |
| `tests/goal-decomposer.test.ts` | 4A | 13 | English, Malayalam script, Manglish transliteration, and Ollama validation. |
| `tests/unified-dispatch.test.ts` | 4A | 5 | Skill registry dispatching across files, browser, documents, and system skills. |
| `tests/e2e-phase-4a.test.ts` | 4A | 1 | Full end-to-end compound workflow dataflow pipeline. |
| `tests/recovery-catalog.test.ts` | 4B | 11 | Domain diagnoses (browser, files, selectors, windows, apps) and risk clamping. |
| `tests/replanning-engine-phase-4b.test.ts` | 4B | 6 | Budget cap enforcement, risk escalation rejection, blind retry prevention. |
| `tests/rollback-coordinator.test.ts` | 4B | 7 | Compensating action derivation, LIFO ordering, path security, kill switch halts. |
| `tests/workflow-engine.test.ts` | 4C | 6 | State machine lifecycle, kill switch aborts, risk pausing, recovery, and rollback. |
| `tests/voice-announcer-workflow.test.ts` | 4C | 4 | Spoken milestone templates, phonetic cleansing, throttling, and barge-in cancel. |
| `tests/workflow-inspector.test.tsx` | 4C | 6 | Modal rendering, status badges, progress bar, credential redaction, user controls. |
| **Total New Tests Added** | | **81** | **All 81 new tests passing with 0 failures.** |

### Existing Files Modified in Phase 4
| File Path | Phase | Changes Made |
|---|---|---|
| `src/core/dynamic-planner.ts` | 4A | Integrated deterministic compound goal decomposition into the main planning loop. |
| `src/state/useCommandStore.ts` | 4A / 4B | Integrated step output tracking, variable resolver parameter substitution, and compensating rollback on failure. |
| `src/types/task-planning.ts` | 4B | Extended `FailureDiagnosis` root causes and recovery strategy enums. |
| `src/core/replanning-engine.ts` | 4B | Integrated `RecoveryCatalog`, enforced 2-replan budget cap, risk ceiling, and no blind retries. |
| `src/adapters/voice/voice-announcer.ts` | 4C | Added `announceMilestone(...)` with milestone dispatch, phonetic formatting, and 1.5s throttling. |
| `src/components/command/ComputerStateHud.tsx` | 4C | Added "Inspector" HUD button and mounted `<WorkflowInspectorModal />`. |

---

## 9. Verification & Quantitative Metrics Summary

### Cumulative Test Progression
```
Phase 3.5 Baseline: 229 tests passed across 33 test files
Phase 4A Complete:  270 tests passed across 37 test files (+41 tests)
Phase 4B Complete:  294 tests passed across 40 test files (+24 tests)
Phase 4C Complete:  310 tests passed across 43 test files (+16 tests)
----------------------------------------------------------------------
Total Test Suite:   310 tests passed (100% pass rate, 0 failures)
Native Rust Tests:  15 tests passed (100% pass rate, 0 failures)
TypeScript Linter:  0 errors across all source files
Production Build:   Clean compilation into dist/ in 12.22s
```

### Verification Commands Run
```bash
# 1. TypeScript Strict Typecheck
npm run typecheck
# Output: Found 0 errors.

# 2. Vitest Test Runner
npm run test:run
# Output: Test Files  43 passed (43)
#         Tests       310 passed (310)
#         Time        4.88s

# 3. Rust Native Unit Tests
cargo test --manifest-path src-tauri/Cargo.toml
# Output: test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out

# 4. Vite Production Build
npm run build
# Output: ✓ built in 12.22s
```

---

## 10. Guidance for ChatGPT / Technical Evaluator

When evaluating this implementation, focus on these architectural design patterns:

1. **State Machine Rigor**: Review [`src/core/workflow/workflow-engine.ts`](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/workflow/workflow-engine.ts) for how asynchronous execution is synchronized with user approvals, kill switch interrupts, and dynamic replanning without race conditions.
2. **Dataflow Security & Correctness**: Examine [`src/core/workflow/variable-resolver.ts`](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/workflow/variable-resolver.ts) to verify how prototype pollution attacks are blocked while still supporting both object dot-notation and array bracket indexing.
3. **Safety & Compensating Transactions**: Examine [`src/core/workflow/rollback-coordinator.ts`](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/workflow/rollback-coordinator.ts) for how filesystem changes are safely reverted via Trash rather than destructive unlinks, and how non-reversible actions are handled.
4. **Resilience & Bounded Self-Healing**: Review [`src/core/workflow/recovery-catalog.ts`](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/workflow/recovery-catalog.ts) and [`src/core/replanning-engine.ts`](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/core/replanning-engine.ts) for the strict 2-replan cap, risk ceiling preservation, and no-blind-retry invariants.
5. **Observability & User Privacy**: Inspect [`src/components/workflow/WorkflowInspectorModal.tsx`](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/components/workflow/WorkflowInspectorModal.tsx) and [`src/adapters/voice/voice-announcer.ts`](file:///Users/anoopdasvs/Downloads/Janki_M%20book_automation/src/adapters/voice/voice-announcer.ts) to observe how audio throttling, phonetic cleansing, and sensitive credential masking operate in production.
