# Phase 4A Implementation Report: Unified Workflow Engine, Multi-Step Orchestrator & Dataflow Pipeline

**Project**: Janki AI — Commercial-Grade Autonomous Desktop Assistant for macOS  
**Architecture Phase**: Phase 4A (Autonomous Goal Orchestration & Dynamic Workflow Engine — Part A)  
**Date**: September 26, 2026  
**Status**: COMPLETE (Phase 4B & Phase 4C Strictly Deferred)

---

## 1. Executive Summary

Phase 4A establishes Janki's foundational architecture for executing complex, multi-step compound workflows across disparate system domains (files, browser, documents, computer control). Prior to Phase 4A, Janki operated primarily on single-intent actions or fixed single-skill dynamic tasks without structured runtime data piping or compound goal decomposition. 

Phase 4A delivers:
1. **Dynamic Variable Resolution & Runtime Dataflow**: A resilient dot-notation and array-indexing parameter piping pipeline (`{{steps.step_id.output.property}}`) with prototype-pollution immunity and exact type preservation.
2. **Deterministic & Fallback Goal Decomposition**: A 2-tier compound goal planner supporting English, Malayalam script (`യുണികോഡ്`), and Manglish phonetic input for cross-domain orchestration, backed by a local Ollama fallback with Zod schema validation.
3. **Unified Skill Registry Execution**: Transition of `useCommandStore` from ad-hoc manual branching to standard `SkillRegistry.dispatch(...)`, integrating pre-execution parameter resolution, risk evaluation, and step output caching while preserving critical safety confirmation phrases and kill-switch aborts.
4. **Comprehensive Test Suite & Non-Regression**: 37 test suites with 270 tests passed (41 new tests added in Phase 4A), 15 Rust tests passed, 0 TypeScript errors, and clean production build.

---

## 2. Core Components Implemented

### 2.1 Variable Resolver & Dataflow Pipeline
**File**: `src/core/workflow/variable-resolver.ts`  
- **Syntax Supported**: `{{steps.<stepId>.output.<path>}}`, `{{workflow.inputs.<var>}}`, and `{{context.<key>}}`.
- **Object & Array Indexing**: Supports nested object traversal and array access using both dot-notation (`files.0.path`) and bracket-notation (`files[0].path`).
- **Exact Type Preservation**: When a parameter value is solely an expression token (e.g. `"{{steps.search.output.files}}"`), it resolves directly to the underlying object/array/number/boolean without serializing into a string.
- **Embedded String Interpolation**: Interpolates multiple tokens embedded in free text (e.g. `"Found {{steps.search.output.count}} files in {{steps.search.output.directory}}"`).
- **Security & Prototype Protection**: Explicitly blocks `__proto__`, `constructor`, and `prototype` paths at all nesting levels to prevent prototype pollution attacks from dynamic workflow payloads.

### 2.2 Workflow Data Types & Schemas
**File**: `src/types/workflow.ts`  
- Defines `WorkflowDefinition`, `WorkflowStep`, `WorkflowVariableBinding`, and `WorkflowStatus`.
- Reuses existing system types (`RiskLevel`, `DynamicVerificationMethod`) to ensure seamless interoperability with the Phase 2/3 safety and policy engines.
- Provides strict runtime validation schemas (`WorkflowStepSchema`, `WorkflowDefinitionSchema`) built on Zod.

### 2.3 Compound Goal Decomposer (Tier 1 & Tier 2)
**File**: `src/core/workflow/goal-decomposer.ts`  
- **Tier 1 (Deterministic Catalog)**: Instant (<5ms), zero-token decomposition for recurring compound operational patterns:
  - **Files $\rightarrow$ Document**: Search files by extension/name $\rightarrow$ extract text/summarize $\rightarrow$ open TextEdit / Notes and type report.
  - **Browser Research $\rightarrow$ Document**: Search web / open URL $\rightarrow$ scrape and extract summary $\rightarrow$ compile summary report in editor.
  - **System Diagnostics $\rightarrow$ Log**: Collect macOS battery/network/disk metrics $\rightarrow$ write diagnostics file $\rightarrow$ notify user.
  - **Safe File Organization**: Locate downloads matching patterns $\rightarrow$ sort into categorized folders $\rightarrow$ confirm moves.
- **Multilingual Support**: Supports English, Malayalam script (matching root forms like `ഫയലുകൾ`/`ഫയല`), and Manglish transliterations (`fileukal kandethuka`, `textedit-il summary ezhuthuka`).
- **Tier 2 (Local Ollama Fallback)**: Structured fallback using prompt engineering that queries local LLMs (`llama3` / `mistral` / `qwen`), validating output strictly against Zod schemas and rejecting any unapproved or unregistered `skillId`s.

### 2.4 Dynamic Planner Integration
**File**: `src/core/dynamic-planner.ts`  
- Integrated `goalDecomposer.decomposeDeterministic()` into the core planner ahead of single-app typing heuristics.
- Converts validated `WorkflowDefinition` steps directly into dynamic plan actions (`WorkflowStep` $\rightarrow$ `DynamicAction`) with `skillId`, parameters, verification requirements, and risk levels intact.
- Single-turn commands (e.g. "open Safari", "type hello") continue bypassing compound decomposition for zero-latency execution.

### 2.5 Unified Skill Dispatching in Execution Loop
**File**: `src/state/useCommandStore.ts`  
- Replaced monolithic manual command dispatch with `skillRegistry.dispatch(action.skillId, resolvedParams, executionContext)`.
- Prior to step dispatch, `variableResolver.resolveStepParams()` resolves all step inputs using accumulated outputs stored in `executionStepOutputs`.
- Preserved all safety-critical checks: typed approval phrases for high-risk actions, policy verification, audio feedback, and emergency kill-switch halts.

---

## 3. Files Created & Modified

### Created Files
| File Path | Description |
|---|---|
| `src/core/workflow/variable-resolver.ts` | Dynamic parameter resolution engine with security guardrails and type preservation. |
| `src/types/workflow.ts` | TypeScript interfaces and Zod schemas for workflows, steps, and bindings. |
| `src/core/workflow/goal-decomposer.ts` | Tier 1 deterministic + Tier 2 LLM compound goal decomposer. |
| `tests/workflow-variable-resolver.test.ts` | 22 unit tests for parameter resolution, array indices, nesting, and prototype safety. |
| `tests/goal-decomposer.test.ts` | 13 unit tests for English, Malayalam, Manglish, and Ollama validation/rejection. |
| `tests/unified-dispatch.test.ts` | 5 integration tests verifying `SkillRegistry.dispatch` across multiple domain skills. |
| `tests/e2e-phase-4a.test.ts` | Full end-to-end integration test verifying multi-skill compound workflow dataflow. |

### Modified Files
| File Path | Changes |
|---|---|
| `src/core/dynamic-planner.ts` | Added `decomposeDeterministic` check and workflow action generator before generic typing fallback. |
| `src/state/useCommandStore.ts` | Integrated step output tracking, variable resolver parameter substitution, and `skillRegistry.dispatch`. |

---

## 4. Automated Verification Results

All automated test suites and compiler checks passed without warnings or errors.

```
======================================================================
1. TypeScript Strict Typecheck:
   Command: npm run typecheck
   Result: 0 errors (Passed)

2. Vitest Test Suite:
   Command: npm run test:run
   Files: 37 passed (37 total)
   Tests: 270 passed (270 total, 0 failures, 0 skipped)
   Duration: 24.01s

3. Rust Native Engine Tests:
   Command: cargo test --manifest-path src-tauri/Cargo.toml
   Result: 15 passed (0 failures)

4. Production Webpack/Vite Build:
   Command: npm run build
   Result: Built into dist/ in 12.12s (Passed)
======================================================================
```

### Breakdown of Test Suite Growth:
* **Pre-Phase 4A Baseline**: 229 Vitest tests across 33 files
* **Phase 4A Additions**: +41 tests across 4 new files:
  - `workflow-variable-resolver.test.ts`: 22 tests
  - `goal-decomposer.test.ts`: 13 tests
  - `unified-dispatch.test.ts`: 5 tests
  - `e2e-phase-4a.test.ts`: 1 test
* **Post-Phase 4A Status**: **270 Vitest tests across 37 files**

---

## 5. End-to-End Real-World Scenario Validation

The core end-to-end test (`tests/e2e-phase-4a.test.ts`) validates the canonical compound automation workflow:
> *"Find all quarterly PDF invoices in Downloads, summarize their totals, and type the summary into TextEdit"*

1. **Step 1 (`files:find`)**:
   - Executes `mdfind` via native macOS bridge.
   - Discovers matching PDF invoice files in `~/Downloads`.
   - Returns structured array `files: [{ path: '~/Downloads/invoice_q1.pdf', name: 'invoice_q1.pdf' }]`.
   - Output cached in runtime step store under `step_find_files`.
2. **Step 2 (`document:summarize`)**:
   - `variableResolver` resolves `{{steps.step_find_files.output.files}}` directly into the array of file objects.
   - Extracts metadata and calculates financial totals.
   - Returns formatted executive summary string.
   - Output cached under `step_summarize_docs`.
3. **Step 3 (`computer_control:type`)**:
   - `variableResolver` resolves `{{steps.step_summarize_docs.output.summary}}` into the `text` parameter.
   - Focuses TextEdit and executes keyboard typing events via native CGEvent bridge.
   - Closed-loop verification confirms successful text injection.

---

## 6. Scope Boundaries & Deferred Items

As specified in the architectural mandate, Phase 4A deliberately restricted implementation to the core dataflow and orchestrator. The following components are **STRICTLY DEFERRED** to subsequent phases:

### Deferred to Phase 4B (Context-Aware Failure Recovery & Adaptive Branching)
- Dynamic replanning engine triggering on runtime step execution failures.
- Compensating actions & transactional rollbacks (e.g. reverting file moves upon partial failure).
- Alternative fallback branch execution when a primary skill is unavailable.

### Deferred to Phase 4C (Workflow State Machine, Observability & Lifecycle UX)
- Visual workflow DAG canvas and node progress inspector in the HUD.
- Interactive step-by-step human-in-the-loop pause, edit, and resume controls.
- Comprehensive task execution replay and telemetry persistence.

---

## 7. Conclusion

Phase 4A is **fully implemented, tested, and validated**. Janki now possesses a multi-skill compound workflow orchestrator capable of planning and passing intermediate execution state dynamically across native macOS domains. 

Awaiting user approval before proceeding to **Phase 4B**.
