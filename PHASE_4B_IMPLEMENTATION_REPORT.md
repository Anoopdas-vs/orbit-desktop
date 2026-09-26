# Phase 4B Implementation Report: Context-Aware Failure Recovery & Adaptive Branching

**Project**: Janki AI — Commercial-Grade Autonomous Desktop Assistant for macOS  
**Architecture Phase**: Phase 4B (Autonomous Goal Orchestration & Dynamic Workflow Engine — Part B)  
**Date**: September 26, 2026  
**Status**: COMPLETE (Phase 4C Strictly Deferred)

---

## 1. Executive Summary

Phase 4B equips Janki with autonomous, domain-aware failure diagnosis, adaptive replanning, and non-destructive transactional rollbacks for multi-step automations. Prior to Phase 4B, automation failures on macOS (such as browser timeouts, accessibility selector drift, or missing file paths) resulted in hard stop errors without state recovery or clean compensating rollbacks.

Phase 4B delivers:
1. **Domain-Aware Recovery Catalog (`RecoveryCatalog`)**: Structured diagnostic rules covering Browser Navigation/Timeouts, Element Selector Drift & Accessibility Disconnects, Missing File Fallbacks (Spotlight `mdfind`), Window Minimized/Hidden states, and Unresponsive Application hangs, all while enforcing strict risk ceilings.
2. **Replanning Engine Hardening (`ReplanningEngine`)**: Full integration with the Recovery Catalog, strict enforcement of the maximum 2-replan budget cap (`replanCount <= 2`), absolute prohibition of risk escalation, and strict rejection of blind identical retries without intervening remediation.
3. **Step Rollback & Compensating Coordinator (`RollbackCoordinator`)**: Autonomous derivation and LIFO (last-in, first-out) execution of non-destructive compensating actions (e.g. moving created scratch files/documents to Trash via `files_skill:move_to_trash`, reverting moved/renamed files back to original paths). Safely skips non-reversible actions (financial trades, outbound URLs), enforces path security, respects kill-switch halts, and records detailed audit logs in `useAuditStore`.
4. **Execution Store Integration (`useCommandStore`)**: Connected compensating rollback directly into multi-step plan execution, so when a step fails mid-plan, previously completed actions are cleanly reverted and the user is truthfully informed.
5. **Comprehensive Automated Verification**: 40 Vitest test files passing (294 tests passed, up from 270 in Phase 4A), 15 Rust native unit tests passing, 0 TypeScript errors, and clean Vite production build.

---

## 2. Core Components Implemented

### 2.1 Domain-Aware Recovery Catalog
**File**: `src/core/workflow/recovery-catalog.ts`
- **Browser Navigation Timeouts (`BROWSER_TIMEOUT`)**: Diagnoses page load delays and network connection stalls in Safari and Google Chrome; generates a tab reload remediation step (`action: 'reload'`) before re-attempting navigation.
- **File Path Failures (`FILE_NOT_FOUND`)**: Diagnoses missing file errors (`ENOENT`, file not found); extracts target filename and triggers a Spotlight search (`files_skill:find_files`) constrained to safe directories (`~/Downloads`, `~/Documents`) before re-attempting the step.
- **Window Minimized / Hidden (`WINDOW_MINIMIZED`)**: Generates `zoom_window` step via `computer_control` to restore window to visible screen space.
- **Application Unresponsive / Beachball (`APP_UNRESPONSIVE`)**: Generates graceful application re-activation / restart step.
- **Element Selector Drift (`ELEMENT_NOT_FOUND`)**: Provides multi-level remediation:
  - If target is below the fold: issues `PageDown` scroll shortcut (`RETRY_SCROLL`).
  - Otherwise: issues application refocus via `Cmd + L` or Tab navigation (`REFOCUS`).
- **Security & Permission Violations (`PERMISSION_DENIED`)**: Immediately directs `FAIL_CLOSED` with zero recovery steps to prevent any attempt to bypass system security or sandbox policies.
- **Risk Ceiling Invariant**: Clamps recovery step risk to never exceed the task's approved risk level.

### 2.2 Hardened Replanning Engine
**File**: `src/core/replanning-engine.ts`
- Delegates diagnosis to `recoveryCatalog.diagnose(...)` while preserving backward compatibility.
- **Strict Budget Cap**: Replan attempts capped at `maxReplans ?? 2`. When budget is reached, fails closed (`return null`).
- **Risk Invariant**: Verifies all suggested recovery steps against `task.overallRisk`. If any suggested step escalates risk, the replan is rejected (`return null`).
- **No Blind Retries**: Checks if suggested steps merely repeat the exact failed action with identical parameters. Rejects blind retries without state remediation.
- Automatically re-sequences and re-numbers workflow steps.

### 2.3 Step Rollback & Compensating Action Coordinator
**File**: `src/core/workflow/rollback-coordinator.ts`
- **Auto-Derivation of Compensating Actions**:
  - `files_skill:create_file` $\to$ `files_skill:move_to_trash` for the created path.
  - `files_skill:move_file` $\to$ `files_skill:move_file` swapping `path` and `newPath`.
  - `files_skill:rename_file` $\to$ `files_skill:rename_file` swapping `path` and `newPath`.
  - `document_skill:create_document` $\to$ `files_skill:move_to_trash` for the created document.
- **Non-Reversible Actions**: Identifies irreversible actions (`binance_spot_order`, `open_url`, `send_email`); marks `isReversible: false`, safely skips them, and records the boundary in `skippedSteps`.
- **LIFO Reverse Order**: Reverses completed step history so that actions are undone in reverse chronological order.
- **Path Protection**: Runs `validateSafeFilePath` before executing file rollbacks, preventing any rollback targeting forbidden system or credential paths.
- **Kill-Switch Dominance**: Halts rollback immediately if `killSwitch.isEngaged()`.
- **Audit Logging**: Persists each rollback execution into `useAuditStore.addExecutionLog(...)`.

### 2.4 Command Store Integration
**File**: `src/state/useCommandStore.ts`
- In `approveAllActions`, if an action verification fails mid-execution:
  - Halts execution of subsequent steps.
  - Invokes `rollbackCoordinator.rollback(completedActions, ...)` to safely revert state changes from earlier steps.
  - Reports rollback outcome via visual status and voice announcement.

---

## 3. Files Created & Modified

### Created Files
| File Path | Description |
|---|---|
| `src/core/workflow/recovery-catalog.ts` | Domain-aware failure diagnoser and remediation step generator. |
| `src/core/workflow/rollback-coordinator.ts` | LIFO compensating actions coordinator with safety checks and audit logging. |
| `tests/recovery-catalog.test.ts` | 11 unit tests covering domain diagnosis, remediation steps, security boundaries, and risk clamping. |
| `tests/replanning-engine-phase-4b.test.ts` | 6 unit tests covering budget caps, risk escalation rejection, and blind retry prevention. |
| `tests/rollback-coordinator.test.ts` | 7 unit tests covering compensating action derivation, LIFO rollback, path security, and kill-switch halts. |

### Modified Files
| File Path | Changes |
|---|---|
| `src/types/task-planning.ts` | Extended `FailureDiagnosis` root causes and recovery strategies. |
| `src/types/workflow.ts` | Added `CompensatingAction`, `RollbackResult` interfaces/schemas, and updated `WorkflowStep`. |
| `src/core/replanning-engine.ts` | Integrated `RecoveryCatalog`, enforced 2-replan budget, risk ceilings, and no-blind-retries. |
| `src/state/useCommandStore.ts` | Wired compensating rollback into `approveAllActions` upon step failure. |

---

## 4. Automated Verification Results

All automated test suites, typechecks, native tests, and production builds passed with 100% success.

```
======================================================================
1. TypeScript Strict Typecheck:
   Command: npm run typecheck
   Result: 0 errors (Passed)

2. Vitest Test Suite:
   Command: npm run test:run
   Files: 40 passed (40 total)
   Tests: 294 passed (294 total, 0 failures, 0 skipped)
   Duration: 31.02s

3. Rust Native Engine Tests:
   Command: cargo test --manifest-path src-tauri/Cargo.toml
   Result: 15 passed (0 failures)

4. Production Webpack/Vite Build:
   Command: npm run build
   Result: Built into dist/ in 13.52s (Passed)
======================================================================
```

### Breakdown of Test Suite Growth:
* **Pre-Phase 4B Baseline**: 270 Vitest tests across 37 files
* **Phase 4B Additions**: +24 tests across 3 new test files:
  - `recovery-catalog.test.ts`: 11 tests
  - `replanning-engine-phase-4b.test.ts`: 6 tests
  - `rollback-coordinator.test.ts`: 7 tests
* **Post-Phase 4B Status**: **294 Vitest tests across 40 files**

---

## 5. Scope Boundaries & Deferred Items

Phase 4B strictly focused on failure recovery, adaptive replanning, and compensating rollbacks. The following components are **STRICTLY DEFERRED** to Phase 4C:

### Deferred to Phase 4C (Workflow State Machine, Observability & Lifecycle UX)
- Durable workflow state machine (`WorkflowEngine`) managing lifecycle transitions (`PENDING_APPROVAL`, `RUNNING`, `PAUSED_FOR_APPROVAL`, `RECOVERING`, `COMPLETED`, `FAILED`, `ABORTED_BY_KILL_SWITCH`).
- Visual Workflow Inspector HUD modal (`WorkflowInspectorModal.tsx`) showing live DAG node progress, step parameters, verification status, and rollback logs.
- Step-by-step human-in-the-loop pause, edit, and resume controls.

---

## 6. Conclusion

Phase 4B is **fully implemented, tested, and validated**. Janki now features intelligent macOS domain failure recovery, strict replan safety invariants, and non-destructive transactional rollbacks.

Awaiting user approval before proceeding to **Phase 4C**.
