# JANKI AI — PHASE 3 IMPLEMENTATION PLAN
## Intelligent Task Automation & User Experience

**Document Version**: 3.0.0-PROPOSAL  
**Author**: Antigravity AI Engineering Team  
**Date**: September 26, 2026  
**Status**: APPROVED DESIGN — PLANNING ONLY (No Production Code Modified)

---

## 1. Executive Summary & Objective

Phase 2 established and validated Janki's autonomous macOS computer-control foundation, and Phase 2.5 hardened this engine through real-world macOS testing (Safari, Calculator, TextEdit, Finder, System Settings) with 100% test pass rates and strict truth-in-failure verification.

**Phase 3 Objective**: Transform Janki from a reliable autonomous computer-control engine into a context-aware, extensible desktop automation platform.

The target execution lifecycle across Phase 3 is:

$$\text{User Goal} \longrightarrow \text{Understand Intent} \longrightarrow \text{Understand Context} \longrightarrow \text{Create Dynamic Plan} \longrightarrow \text{Select Skill} \longrightarrow \text{Execute} \longrightarrow \text{Observe} \longrightarrow \text{Verify} \longrightarrow \text{Recover / Re-plan} \longrightarrow \text{Update Context} \longrightarrow \text{Respond}$$

### Core Invariants Maintained
1. **Zero Phase 2 Rebuild**: Phase 2 computer control remains the foundational native driver.
2. **Zero False-Success Reporting**: Truth in failure is strictly enforced; actions are only reported as successful if post-state verification succeeds.
3. **Deterministic Safety Gating**: Risk tiers (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), Emergency Stop kill switch, and permission verification remain inviolable.
4. **Multilingual Parity**: English, Malayalam, Manglish, and mixed-language commands are first-class citizens.

---

## 2. Integrated Phase 3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                       JANKI AI — INTEGRATED PHASE 3 ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                                 ┌─────────────────────────┐
                                 │   User Voice / Text     │
                                 │ (EN / ML / Manglish)    │
                                 └────────────┬────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3A: ADVANCED INTENT UNDERSTANDING & MULTILINGUAL PARSER                                    │
│ ┌──────────────────────┐  ┌────────────────────────┐  ┌───────────────────────────────────┐ │
│ │ Deterministic Router │  │ Context-Aware Follow-up│  │ Ambiguity & Clarification Resolver│ │
│ │ (Phase 1/2 Preserved)│  │ Resolver (Anaphora)    │  │ (Proactive Dialogue)              │ │
│ └──────────┬───────────┘  └───────────┬────────────┘  └─────────────────┬─────────────────┘ │
└────────────┼──────────────────────────┼─────────────────────────────────┼───────────────────┘
             │                          │                                 │
             ▼                          ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3C: TASK CONTEXT & WORKING MEMORY LAYER                                                     │
│ ┌───────────────────────┐  ┌────────────────────────┐  ┌──────────────────────────────────┐ │
│ │ Ephemeral Working Mem │  │ Task Context Store     │  │ Redaction Engine                 │ │
│ │ (Active App/Window)   │  │ (Multi-Turn Entities)  │  │ (Credential & PII Masker)        │ │
│ └───────────────────────┘  └────────────────────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3B: DYNAMIC TASK PLANNER & RE-PLANNER                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Dynamic Task Decomposition (Action, Skill, Target, Expected Result, Verification, Risk)  │ │
│ └────────────────────────────────────┬────────────────────────────────────────────────────┘ │
│                                      │ (When unexpected state detected)                     │
│                                      ▼                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Adaptive Re-Planning Engine (State delta analysis, step pruning, alternative recovery)  │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3G: HUMAN APPROVAL & SAFETY POLICY ENGINE                                                   │
│ ┌───────────────────────┐  ┌────────────────────────┐  ┌──────────────────────────────────┐ │
│ │ Policy Engine         │  │ Risk Classifier        │  │ Emergency Stop / Kill Switch     │ │
│ │ (LOW/MED/HIGH/CRIT)   │  │ (Blast Radius Metric)  │  │ (Subprocess & Hardware Freeze)   │ │
│ └───────────────────────┘  └────────────────────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3D: EXTENSIBLE SKILLS & TOOLS REGISTRY                                                      │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐ │
│ │ ComputerSkill │ │ BrowserSkill  │ │  FilesSkill   │ │ DocumentSkill │ │ EmailSkill      │ │
│ ├───────────────┤ ├───────────────┤ ├───────────────┤ ├───────────────┤ ├─────────────────┤ │
│ │ OfficeSkill   │ │  SystemSkill  │ │  MediaSkill   │ │ ReporterSkill │ │ TradingSkill    │ │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └─────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ EXECUTION, OBSERVATION & VERIFICATION LOOP                                                  │
│ ┌──────────────────────┐  ┌────────────────────────┐  ┌───────────────────────────────────┐ │
│ │ Native Bridge / TCC  │─▶│ State Observation      │─▶│ Verification & Truth in Failure   │ │
│ │ (macOS CoreGraphics) │  │ (AXUIElement / Title)  │  │ (Strict post-state match)         │ │
│ └──────────────────────┘  └────────────────────────┘  └─────────────────┬─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┼───────────────────┘
                                                                          │
                                  ┌───────────────────────────────────────┴───────────────┐
                                  │                                                       │
                                  ▼                                                       ▼
┌────────────────────────────────────────────────────────┐ ┌──────────────────────────────────┐
│ 3H: COMMERCIAL VOICE & PERSONA EXPERIENCE              │ │ 3I: TASK HISTORY & AUDIT SYSTEM  │
│ ┌────────────────────────────────────────────────────┐ │ │ ┌──────────────────────────────┐ │
│ │ Decoupled Voice Pipeline (SpeechSynth / WebAudio)  │ │ │ │ SQLite / IndexedDB Audit Log │ │
│ │ Young Indian Female Voice Profile (en-IN / ml-IN)  │ │ │ │ Step Snapshots & Retries     │ │
│ │ Real-Time Progress Cues & Immediate Barge-in       │ │ │ │ Truthful Execution Diffs     │ │
│ └────────────────────────────────────────────────────┘ │ │ └──────────────────────────────┘ │
└────────────────────────────────────────────────────────┘ └──────────────────────────────────┘
```

---

## 3. Detailed Subsystem Specifications (3A – 3J)

---

### 3A — Advanced Intent Understanding & Multilingual Parser

#### 1. Objective
Design an extensible, multi-language intent-understanding engine capable of parsing natural English, Malayalam, Manglish, mixed-language queries, follow-up commands, context-dependent actions, and anaphora ("it", "the first result", "go back", "do the same thing again") without removing or degrading the sub-millisecond deterministic routing established in Phases 1 and 2.

#### 2. Existing Components Affected
- `src/core/router.ts`: Extend `CommandRouter.route()` to invoke a contextual pre-processor prior to general fallbacks.
- `src/core/action-planner.ts`: Expose tokenization and verb extraction helpers.
- `src/core/conversational-context.ts`: Expand from a single-proposal pending object to a multi-turn conversational session.
- `src/core/ambiguity-detector.ts`: Incorporate linguistic reference ambiguity (e.g. anaphoric pronouns with no antecedents).

#### 3. New Components / Files Required
- `src/core/contextual-intent-resolver.ts`: Core resolver evaluating relative terms and anaphora against the active task session.
- `src/core/multilingual-nlp.ts`: Dedicated multilingual normalizer, script detector, and verb slot-filler for English, Malayalam (Unicode `0D00-0D7F`), and Manglish phonetic variations.
- `tests/contextual-intent.test.ts`: Vitest suite testing single-turn, multi-turn, and cross-lingual intent resolution.

#### 4. Architecture Changes & Integration
The routing flow executes in four deterministic stages:
1. **Linguistic Normalization**: Strip wake words, clean punctuation, and identify language (`'en' | 'ml' | 'manglish' | 'mixed'`).
2. **Emergency Interruption Check**: Instant bypass for `"Stop"`, `"Cancel"`, `"Emergency Stop"`.
3. **Contextual Anaphora & Follow-up Resolution**:
   - Detect follow-up markers (e.g., `"now search for..."`, `"open the first result"`, `"go back"`, `"do the same thing again"`, `"aduthatheth nokku"`, `"ithu thanne pinneyum cheyyu"`).
   - If detected, retrieve active entity blackboard (`activeApp`, `lastUrl`, `lastQuery`, `lastTarget`).
   - Reconstruct canonical command (e.g., `"Now search for Oksy Healthcare"` + active app Safari $\rightarrow$ `"Search Safari for Oksy Healthcare"`).
4. **Deterministic Fast-Path**: Match compiled intent against fast allowlists (P0–P3, A1–A6, B–K in `router.ts`).

#### 5. Dependencies
- Native `Intl` API and regex tokenizers; zero external heavyweight NLP runtime required, preserving < 1ms dispatch.

#### 6. Risks & Mitigation
- **Risk**: Anaphora hijacking an unrelated new command.  
  **Mitigation**: Enforce a strict 120-second context TTL. Clear entity context whenever the user introduces explicit app switches or says `"New task"` / `"Reset"`.

#### 7. Testing Strategy
- Evaluate 50 test inputs covering English, Malayalam script, and Manglish variations.
- Verify 4-step sequence:
  - Turn 1: `"Open Safari."` $\rightarrow$ Target: Safari.
  - Turn 2: `"Now search for Oksy Healthcare."` $\rightarrow$ Target: Safari, Query: Oksy Healthcare.
  - Turn 3: `"Open the first result."` $\rightarrow$ Target: First link in Safari results.
  - Turn 4: `"Go back."` $\rightarrow$ Target: Safari back navigation.

#### 8. Acceptance Criteria
- Contextual commands succeed without requiring redundant application names.
- Deterministic routing latency remains $\le 1\text{ ms}$.
- All 131 existing Vitest tests continue to pass with zero regressions.

---

### 3B — Dynamic Task Planning & Re-Planning

#### 1. Objective
Upgrade the `ActionPlanner` from static template matching into a dynamic task planner that decomposes complex user goals into verified atomic steps, monitors step outcomes, detects unexpected system states, and re-plans adaptively while strictly preserving closed-loop verification.

#### 2. Existing Components Affected
- `src/core/action-planner.ts`: Re-architect `ActionPlanner` into a dynamic decomposition and re-planning orchestrator.
- `src/core/execution-loop.ts`: Integrate `ClosedLoopExecutor` with dynamic re-planning on verification failure.
- `src/types/action-plan.ts`: Expand step schemas to support pre-conditions, retry policies, and skill identifiers.

#### 3. New Components / Files Required
- `src/core/dynamic-planner.ts`: Goal decomposition engine breaking compound instructions into sequential steps.
- `src/core/replanning-engine.ts`: Diagnostic engine analyzing execution state deltas and generating recovery branches.
- `src/types/task-planning.ts`: Types for `DynamicPlannedStep`, `StepPrecondition`, `VerificationStrategy`, and `ReplanPolicy`.
- `tests/dynamic-planning.test.ts`: Vitest suite covering decomposition, state observation, and dynamic re-planning.

#### 4. Architecture Changes & Step Schema
Each planned step conforms to the following contract:

```typescript
export interface DynamicPlannedStep {
  id: string;
  stepNumber: number;
  title: string;
  skillId: string;               // e.g., 'browser_skill', 'files_skill', 'computer_control'
  action: string;                // e.g., 'navigate', 'click_element', 'copy_file'
  target?: string;               // Target UI element, path, URL, or window
  params: Record<string, any>;
  preconditions: {
    requiredActiveApp?: string;
    requiredElementPresent?: string;
    requiredPathExists?: string;
  };
  expectedResult: string;
  verificationMethod: 
    | 'app_active'
    | 'window_title'
    | 'element_present'
    | 'element_value'
    | 'file_exists'
    | 'file_content'
    | 'audio_state'
    | 'command_success';
  verificationCriteria: Record<string, any>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timeoutMs: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    allowReplanOnExhaustion: boolean;
  };
}
```

#### Dynamic Re-Planning Protocol:
1. **Pre-condition Validation**: Before step execution, check if target app is active and window exists.
2. **Execute & Observe**: Dispatch action via designated skill and query post-action computer state.
3. **Deviation Detection**: If verification fails after retries:
   - Trigger `ReplanningEngine.generateRecoveryPlan(failedStep, observedState, remainingSteps)`.
   - *Example 1*: Target window minimized $\rightarrow$ Insert `activate_app` and `zoom_window` steps.
   - *Example 2*: Search input unfocused $\rightarrow$ Re-focus address bar via `Cmd+L`.
   - *Example 3*: Target element obscured $\rightarrow$ Trigger scroll action.
4. **Safety Cap**: Dynamic re-planning is restricted to at most 2 attempts per task. If still unverified, fail closed with truthful reporting.

#### 5. Dependencies
- Phase 2 `ClosedLoopExecutor`, `nativeBridge`, and `SemanticTargetResolver`.

#### 6. Risks & Mitigation
- **Risk**: Infinite re-planning loops or plan drift changing user intent.  
  **Mitigation**: Hard limit `replanCount <= 2`; re-planned steps cannot exceed the approved overall plan risk.

#### 7. Testing Strategy
- Test compound task decomposition: *"Open Safari, search for Janki, and click the documentation link"*.
- Test simulated failure injection: Force target app into background and assert planner inserts an activation step.

#### 8. Acceptance Criteria
- Multi-step tasks execute sequentially with each step verified.
- Re-planning successfully recovers from transient window/focus issues without user intervention.
- Failures never report false success.

---

### 3C — Task Context & Working Memory

#### 1. Objective
Design a multi-turn context and working memory layer that tracks ongoing task state, active applications, target entities, and step histories across conversational turns, while strictly segregating ephemeral computer state from long-term memory and redacting sensitive data.

#### 2. Existing Components Affected
- `src/state/useComputerStateStore.ts`: Retain focused on transient macOS system state (frontmost app, window title, volume, running apps).
- `src/core/conversational-context.ts`: Extend into the unified multi-turn task memory.
- `src/core/redactor.ts`: Enforce redaction before storing any text or parameters in working memory.

#### 3. New Components / Files Required
- `src/context/task-context-manager.ts`: Core singleton managing the active task lifecycle, turn history, and entity blackboard.
- `src/context/entity-blackboard.ts`: Key-value entity extractor (storing URLs, file paths, app names, queries, window titles).
- `src/types/context.ts`: Schema definitions for `TaskSession`, `ConversationalTurn`, `EntityRecord`, and `ContextSnapshot`.
- `tests/task-context.test.ts`: Vitest suite validating multi-turn entity persistence, context timeout, and data redaction.

#### 4. Architecture Changes & Memory Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MEMORY & CONTEXT HIERARCHY                      │
├──────────────────────────┬───────────────────────┬─────────────────────┤
│ Ephemeral Computer State │ Task Context Memory   │ Long-Term Memory    │
│ (useComputerStateStore)  │ (TaskContextManager)  │ (Future / SQLite)   │
├──────────────────────────┼───────────────────────┼─────────────────────┤
│ • Frontmost OS App       │ • Active User Goal    │ • User Preferences  │
│ • Active Window Title    │ • Completed Steps     │ • Persona Choice    │
│ • System Volume / Mute   │ • Active Entities     │ • Whitelisted Paths │
│ • Running Process IDs    │ • Pending Approvals   │ • Audit Logs        │
│ • UI Tree Cache (2 sec)  │ • Context TTL (120s)  │ • Trade Journal     │
│ ──────────────────────── │ ───────────────────── │ ─────────────────── │
│ Wiped on task finish     │ Wiped on task close   │ Encrypted on disk   │
│ Zero persistence         │ Ephemeral session mem │ No credentials/PII  │
└──────────────────────────┴───────────────────────┴─────────────────────┘
```

#### Entity Blackboard Structure:
```typescript
export interface EntityRecord {
  type: 'app' | 'url' | 'filePath' | 'searchQuery' | 'selectedItem' | 'number';
  value: string;
  sourceTurn: number;
  confidence: number;
  redacted: boolean;
}
```

#### 5. Dependencies
- Redaction utilities (`redactSensitiveData`) in `src/core/redactor.ts`.

#### 6. Risks & Mitigation
- **Risk**: Memory leaks or context bleeding between distinct tasks (e.g. an old search query contaminating a new email task).  
  **Mitigation**: Implement `TaskContextManager.resetTask()` on task completion or explicit topic transition, and enforce 120s inactivity auto-clear.

#### 7. Testing Strategy
- Verify entity extraction across multi-step prompts:
  1. *"Open Safari."* -> Entity `app: Safari`.
  2. *"Search for Oksy Healthcare."* -> Entity `searchQuery: Oksy Healthcare`.
  3. *"Open the first result."* -> Resolves entity `app: Safari` from turn 1.
- Verify password or API key inputs are redacted before being recorded in entity memory.

#### 8. Acceptance Criteria
- Context successfully resolves the implicit application across 5 consecutive turns without manual app re-specification.
- Sensitive strings (API tokens, passwords, credit card formats) are masked with `[REDACTED]` prior to memory storage.

---

### 3D — Extensible Skills Architecture

#### 1. Objective
Establish a modular, scalable plugin/skill architecture that standardizes how capabilities are declared, permissioned, risk-assessed, executed, and verified. Existing computer control becomes the foundational driver rather than being duplicated.

#### 2. Existing Components Affected
- `src/types/skills.ts`: Upgrade `SkillManifest` to support tool metadata, capability lists, fine-grained permissions, and verification strategies.
- `src/state/useCommandStore.ts`: Replace ad-hoc `if (skillId === ...)` blocks in `approveAction` with a unified dynamic `SkillRegistry.dispatch()`.
- `src/skills/computer-control.ts`: Refactor as the core system capability provider (`ComputerSkill`).

#### 3. New Components / Files Required
- `src/skills/skill-registry.ts`: Singleton registry managing skill discovery, registration, lifecycle, and dispatch.
- `src/skills/base-skill.ts`: Abstract base class implementing standard validation, audit hook, dry-run, and timeout mechanisms.
- Initial Standard Skill Implementations:
  - `src/skills/browser/browser-skill.ts`: Safari & Chrome tab, navigation, and DOM automation.
  - `src/skills/files/files-skill.ts`: File search, inspection, creation, renaming, and batch organization.
  - `src/skills/document/document-skill.ts`: TextEdit, Markdown, CSV, and plain-text file reading/editing.
  - `src/skills/email/email-skill.ts`: macOS Mail.app draft generation and inbox inspection.
  - `src/skills/office/office-skill.ts`: Notes, Reminders, and Calendar event creation.
  - `src/skills/system/system-skill.ts`: macOS system settings, audio, network status, display parameters.
  - `src/skills/media/media-skill.ts`: YouTube playback, QuickTime, Spotify, and system media keys.
- `tests/skill-registry.test.ts`: Vitest suite testing skill registration, permission enforcement, and execution dispatch.

#### 4. Architectural Contract & Skill Specifications

Each skill exports a typed manifest satisfying:

```typescript
export interface StandardSkillManifest<TInput = any, TOutput = any> {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  tools: Record<string, SkillToolDefinition>;
  requiredPermissions: ('accessibility' | 'fullDiskAccess' | 'automation' | 'network')[];
  riskLevel: RiskLevel;
  supportsDryRun: boolean;
  executeTool: (
    toolName: string,
    params: TInput,
    context: SkillExecutionContext
  ) => Promise<SkillExecutionResult<TOutput>>;
  verifyOutcome: (
    toolName: string,
    params: TInput,
    result: TOutput
  ) => Promise<{ verified: boolean; actualState: string }>;
}
```

#### Detailed Breakdown of the 8 Core Skills:

| Skill | Primary Capabilities | Exposed Tools / Actions | Risk Tier | Verification Strategy | Required Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Computer Skill** | Window mgmt, mouse click/scroll, key typing/shortcuts | `activate_app`, `move_window`, `click`, `type`, `shortcut` | `LOW` to `MEDIUM` | Post-action AXUI state query & window title check | Accessibility |
| **2. Browser Skill** | Navigation, tab switching, form filling, link clicking | `navigate`, `open_tab`, `close_tab`, `fill_field`, `click_link` | `LOW` | Window title contains target; URL matches; AX element present | Accessibility, Automation |
| **3. Files Skill** | Find files, inspect metadata, open, create, move, rename | `find_files`, `get_metadata`, `open_file`, `create_file`, `move_file`, `rename_file` | `LOW` (read) to `HIGH` (bulk move/delete) | Filesystem existence check, path stat verification | Full Disk Access |
| **4. Document Skill** | Inspect text/markdown/CSV, append notes, edit TextEdit | `read_document`, `create_note`, `append_text`, `format_markdown` | `LOW` (read) to `MEDIUM` (write) | Document content diff verification | Full Disk Access |
| **5. Email Skill** | Draft email in Mail.app, inspect subject lines | `draft_email`, `inspect_inbox`, `prepare_reply` | `MEDIUM` (draft) to `HIGH` (send) | Mail.app message draft existence verification | Automation (Mail) |
| **6. Office / Productivity** | Add Reminders, create Calendar events, append to Notes | `create_reminder`, `create_calendar_event`, `append_to_note` | `LOW` to `MEDIUM` | Event/reminder item lookup via EventKit/AppleScript | Automation |
| **7. System Skill** | Audio level, mute, display brightness, Wi-Fi check | `set_volume`, `toggle_mute`, `get_wifi_status`, `battery_info` | `LOW` | Native bridge `get_computer_state` parameter comparison | System Events |
| **8. Media Skill** | YouTube music playback, ad skipping, play/pause | `play_music`, `skip_ad`, `media_play_pause`, `next_track` | `LOW` | Audio playing state & active browser tab verification | None |

#### 5. Dependencies
- Zod schemas for all tool input and output validation.
- Existing `nativeBridge` and `PolicyEngine`.

#### 6. Risks & Mitigation
- **Risk**: Proliferation of disjointed skills duplicating core control code.  
  **Mitigation**: Mandatory rule: All GUI and OS interactions within Browser, Document, Office, and Media skills must route through `ComputerTool` or `nativeBridge`.

#### 7. Testing Strategy
- Unit test each skill manifest using schema validation.
- Test `SkillRegistry.getSkill('browser_skill').executeTool('navigate', ...)` with mock responses.
- Verify permission checks block execution when required TCC permission is absent.

#### 8. Acceptance Criteria
- All 8 skills are registered in `SkillRegistry` with typed inputs, outputs, and risk ratings.
- Calling `SkillRegistry.dispatch()` routes to the correct tool and automatically checks permissions and risk policies.

---

### 3E — Advanced Browser Automation

#### 1. Objective
Design full-featured browser automation for macOS (Safari and Google Chrome) beyond search: multi-tab handling, form filling, button/link clicking, scrolling, page-state observation, and download tracking, prioritizing accessibility (AX) perception with secondary visual fallbacks.

#### 2. Existing Components Affected
- `src/skills/open-url.ts`: Upgrade to leverage deep browser navigation rather than simple `open` commands.
- `src/core/semantic-targeting.ts`: Extend browser heuristics to handle links, form fields, and tab bars.
- `src-tauri/src/commands/control.rs`: Support browser-specific keyboard shortcuts (`Cmd+T`, `Cmd+W`, `Cmd+[`).

#### 3. New Components / Files Required
- `src/skills/browser/browser-skill.ts`: Complete browser control implementation.
- `src/skills/browser/browser-tab-manager.ts`: Tab index tracking, switching, and title resolution.
- `src/skills/browser/browser-dom-observer.ts`: Evaluates page load states, address URLs, and interactive elements.
- `tests/browser-automation.test.ts`: Vitest suite for tab operations, form filling, and navigation verification.

#### 4. Architecture Changes & Multi-Layer Perception

```
User Browser Command
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Layer 1: Native macOS Accessibility (AXUIElement)      │
│ • Query browser address bar, tab bar, web area         │
│ • Click links/buttons using exact AX coordinates       │
│ • Type into input fields via AXSetValue / Key strokes  │
└──────────────────────────┬─────────────────────────────┘
                           │ (If AX blocked or cross-origin canvas)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Layer 2: AppleScript Scripting Interface               │
│ • Safari: 'tell application "Safari" to do JavaScript' │
│ • Chrome: 'execute javascript' on active tab           │
└──────────────────────────┬─────────────────────────────┘
                           │ (If scripting disabled by user)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Layer 3: Visual Perception Fallback                    │
│ • Semantic coordinate matching & OCR fallback          │
└────────────────────────────────────────────────────────┘
```

#### Supported Browser Actions:
1. `navigate(url: string, browser?: 'Safari' | 'Google Chrome')`: Set address bar text and hit return. Verify window title/URL.
2. `openTab(url?: string)`: Dispatch `Cmd+T`. Verify new tab count.
3. `closeTab()`: Dispatch `Cmd+W`. Verify active tab count decremented.
4. `switchTab(tabIndex: number)`: Dispatch `Cmd+Option+Right` or `Cmd+[1-9]`.
5. `fillField(fieldTarget: string, text: string)`: Focus field using `SemanticTargetResolver` and type text.
6. `clickLink(targetText: string)`: Resolve link role in AX tree and dispatch click.
7. `scroll(direction: 'up' | 'down' | 'bottom', amount?: number)`: Smooth scroll dispatch.
8. `waitForState(expectedTitlePart: string, timeoutMs: number)`: Poll window title until loaded or timeout.

#### 5. Dependencies
- macOS Accessibility API (`AXUIElementCopyAttributeValue`).
- Safari / Chrome AppleScript dictionary bindings.

#### 6. Risks & Mitigation
- **Risk**: Modern web apps using heavy canvas or obfuscated DOM that accessibility trees cannot resolve.  
  **Mitigation**: Pair AX tree queries with keyboard navigation (`Tab` cycling, `Cmd+F` search-in-page) and verify through window title and visual feedback.

#### 7. Testing Strategy
- Test Safari and Chrome tab navigation sequence.
- Test form fill simulation (e.g. search box input, submit click).
- Test recovery when page takes 3 seconds to navigate.

#### 8. Acceptance Criteria
- Multi-step flow: *"Open Safari -> Go to https://news.ycombinator.com -> Click the first link -> Go back"* executes with each step verified.
- Address bar focus uses `Cmd+L` with verified window URL updates.

---

### 3F — File & Document Automation

#### 1. Objective
Design safe, non-destructive file and document automation on macOS: finding files via Spotlight/metadata, reading metadata, opening, creating, renaming, moving, and editing text-based documents, with strict safety gating for modifications and complete blocking of sensitive directories.

#### 2. Existing Components Affected
- `src/core/policy-engine.ts`: Introduce file mutation policies, protected path lists, and blast-radius thresholds.
- `src-tauri/src/commands/`: Add safe filesystem commands in Rust.

#### 3. New Components / Files Required
- `src/skills/files/files-skill.ts`: Implements file exploration, creation, renaming, and organization.
- `src/skills/document/document-skill.ts`: Document parser and editor (markdown, txt, json, csv).
- `src-tauri/src/commands/filesystem.rs`: Sandboxed Rust backend filesystem operations with canonicalized path enforcement.
- `tests/file-automation.test.ts`: Vitest suite testing path sandboxing, file mutations, diff previews, and approval blocks.

#### 4. Safety Guardrails & Protected Paths

```typescript
export const FORBIDDEN_FILE_PATHS = [
  '/System',
  '/Library',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/etc',
  '~/.ssh',
  '~/.gnupg',
  '~/.aws',
  '~/.config',
  '**/.git',
  '**/.env*',
  '**/node_modules',
];
```

#### Safe Operations Protocol:
1. **Find Files**: `mdfind` or sandboxed directory walk restricted to user home (`~/Documents`, `~/Downloads`, `~/Desktop`, workspace).
2. **Read / Metadata**: Always classified as `LOW` risk. Auto-executable.
3. **Create File**: `LOW` to `MEDIUM` risk. Verifies destination does not overwrite existing file unless explicitly instructed.
4. **Rename / Move**:
   - 1 file: `MEDIUM` risk (requires single-click approval).
   - > 3 files (batch): `HIGH` risk (requires diff/list review with file count metric).
5. **Delete Files**:
   - `HIGH` risk: Always requires explicit user confirmation.
   - Deletions are moved to macOS Trash (`~/.Trash`) via `NSFileManager.trashItem` rather than permanently unlinking (`rm -rf` strictly forbidden).
6. **Verification Method**: Check file existence, target directory contents, or checksum post-action.

#### 5. Dependencies
- Rust `std::fs` and macOS `NSWorkspace` / `NSFileManager` trash API.

#### 6. Risks & Mitigation
- **Risk**: Accidental deletion or overwrite of critical project files.  
  **Mitigation**: Block permanent deletes; enforce Trash-only deletion; block all paths in `FORBIDDEN_FILE_PATHS`.

#### 7. Testing Strategy
- Unit test path validator rejecting `/etc/passwd`, `~/.ssh/id_rsa`, and `.env`.
- Test file creation in `~/Downloads/test-janki` and verify post-creation existence.
- Test renaming file and verifying old name is gone and new name is present.

#### 8. Acceptance Criteria
- Safe file exploration finds documents within allowed user directories without error.
- Any operation affecting more than 3 files triggers `HIGH` risk review modal displaying affected paths.
- System files and hidden credentials cannot be read, moved, or deleted under any circumstance.

---

### 3G — Human Approval & Safety UX

#### 1. Objective
Refine the human approval interface and safety governance to provide contextual explanations of planned mutations, clear blast-radius metrics (e.g. *"Janki wants to organize 12 files in Downloads. Proceed?"*), truthful risk classification, and guaranteed instant Emergency Stop response.

#### 2. Existing Components Affected
- `src/core/policy-engine.ts`: Update risk classification heuristics to dynamically factor in mutation count, target type, and network exposure.
- `src/components/approval/CriticalConfirmModal.tsx`: Support batch action previews, file diffs, and parameter transparency.
- `src/components/approval/PlanReviewCard.tsx`: Display step-by-step verification methods and expected effects.
- `src/core/kill-switch.ts`: Maintain existing hardware and process kill locks.

#### 3. New Components / Files Required
- `src/components/approval/RiskExplanationBanner.tsx`: Plain-language explanation of why a task was assigned its risk level.
- `src/components/approval/DiffReviewModal.tsx`: Visual diff viewer for file edits and code changes.
- `tests/safety-approval.test.ts`: Vitest suite verifying risk escalation, confirmation phrase checks, and kill switch interrupts.

#### 4. Risk Tier Matrix & UX Governance

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              RISK TIER UX GOVERNANCE                                   │
├──────────┬─────────────────────────────┬──────────────────────────┬────────────────────┤
│ Tier     │ Permitted Operations        │ Approval UX Requirement  │ Voice Feedback     │
├──────────┼─────────────────────────────┼──────────────────────────┼────────────────────┤
│ LOW      │ Read state, open apps,      │ Zero-click (Fast Mode)   │ Spoken summary     │
│          │ search web, volume adjust   │ or single-click          │ upon completion    │
├──────────┼─────────────────────────────┼──────────────────────────┼────────────────────┤
│ MEDIUM   │ Type text, single file      │ Single-click approval    │ Spoken explanation │
│          │ create, launch dev server   │ button in PlanReviewCard │ before execution   │
├──────────┼─────────────────────────────┼──────────────────────────┼────────────────────┤
│ HIGH     │ Git commit/push, move files,│ Explicit review of diff/ │ Spoken request for │
│          │ move to Trash, batch ops    │ file list + Confirm click│ user review        │
├──────────┼─────────────────────────────┼──────────────────────────┼────────────────────┤
│ CRITICAL │ Financial orders (Binance), │ Mandatory exact typed    │ Spoken warning     │
│          │ production deployment       │ phrase + secondary click │ & confirmation req │
└──────────┴─────────────────────────────┴──────────────────────────┴────────────────────┘
```

#### Explanation Generator:
Every plan presented to the user includes a generated `planExplanation`:
- Example: *"Janki will create folder 'Invoices 2026' and move 8 PDF files from Downloads into it. No files will be deleted."*
- Displays: Target paths, affected item count, reversible vs. irreversible status.

#### 5. Dependencies
- Existing `PolicyEngine`, `KillSwitch`, and React Zustand stores.

#### 6. Risks & Mitigation
- **Risk**: User approval fatigue leading to accidental approval of dangerous operations.  
  **Mitigation**: High-risk actions require visual diff expansion; Critical actions require typing the exact confirmation phrase.

#### 7. Testing Strategy
- Verify that a plan with 2 LOW actions and 1 HIGH action evaluates to overall risk `HIGH`.
- Verify typed phrase validation fails if a single character is missing or mismatched.
- Verify pressing Emergency Stop aborts execution between steps within < 1 millisecond.

#### 8. Acceptance Criteria
- Every plan requiring approval clearly states the action, target, count of items, and risk reason.
- Emergency stop halts all active subprocesses and locks the UI in all scenarios.

---

### 3H — Voice Experience & Persona Architecture

#### 1. Objective
Deliver a production-grade, commercial voice experience featuring natural progress announcements, concise conversational replies, instant barge-in interruption, configurable voice personas (including a high-quality young Indian female voice profile), and multilingual phonetic handling, cleanly decoupled from the underlying execution engine.

#### 2. Existing Components Affected
- `src/adapters/voice/speech-synthesis.ts`: Upgrade to support persona pitch/rate modulation, Indian English voice presets (`en-IN`), and queue management.
- `src/adapters/voice/wake-word-listener.ts`: Enhance barge-in detection to interrupt active speech output immediately when user speaks.
- `src/core/persona-engine.ts`: Map personas to distinct vocal prosody profiles.

#### 3. New Components / Files Required
- `src/adapters/voice/voice-announcer.ts`: Lightweight announcer providing concise non-blocking progress updates during multi-step execution.
- `src/adapters/voice/phonetic-preprocessor.ts`: Phonetic text normalizer for Malayalam and Manglish terms prior to TTS dispatch.
- `src/types/voice.ts`: Type definitions for `VoiceProfile`, `SpeechQueueItem`, and `AudioState`.
- `tests/voice-experience.test.ts`: Vitest suite verifying barge-in interrupt, phonetic cleaning, and voice profile selection.

#### 4. Voice Architecture & Decoupled Pipeline

```
                ┌────────────────────────────────┐
                │ Execution Engine / Store Hooks │
                └───────────────┬────────────────┘
                                │ (Step Progress Events)
                                ▼
                ┌────────────────────────────────┐
                │ 3H: Voice Announcer Layer      │
                │ • Filters non-essential noise  │
                │ • Formulates concise status    │
                │ • Throttles updates (>1.5s)    │
                └───────────────┬────────────────┘
                                │
                                ▼
                ┌────────────────────────────────┐
                │ Phonetic Normalizer            │
                │ • Cleans markdown & URLs       │
                │ • Maps Manglish / ML to phonics│
                └───────────────┬────────────────┘
                                │
                                ▼
                ┌────────────────────────────────┐
                │ Speech Synthesis Dispatcher    │
                │ • Voice: "Veena" / "Lekha" /   │
                │   Indian Female (en-IN)        │
                │ • Immediate cancel on Barge-in │
                └────────────────────────────────┘
```

#### Voice Configuration & Profiles:
- **Default Young Indian Female Voice Profile**:
  - Locales: `en-IN`, `ml-IN`, `en-GB`.
  - macOS Voice Targets: `"Veena"` (macOS Indian English), `"Lekha"` (macOS Indian English / Hindi), `"Siri Voice 4 (India)"`, `"Samantha"` (fallback).
  - Rate: `1.05` | Pitch: `1.08` (energetic, clear, natural).
- **Progress Announcements**:
  - Concise: *"Opening Safari."*, *"Searching Oksy Healthcare."*, *"Found 10 results."*, *"Task completed."*
  - Never reads URLs, GUIDs, or raw terminal logs aloud.
- **Immediate Interruption (Barge-in)**:
  - If user utters *"Stop"*, *"Wait"*, or starts a new command while Janki is speaking, `speechSynth.stop()` fires instantly, cutting audio output within < 50ms.

#### 5. Dependencies
- Web Speech Synthesis API with native macOS voice bindings.
- Compatible with offline local TTS (Kokoro / Sherpa-ONNX) as future drop-in provider.

#### 6. Risks & Mitigation
- **Risk**: Excessive speech output annoying the user during rapid multi-step automation.  
  **Mitigation**: Enforce a minimal interval between announcements; allow the user to toggle voice announcements in the UI HUD with 1 click.

#### 7. Testing Strategy
- Test phonetic cleaner on inputs containing URLs, brackets, and markdown characters.
- Test that calling `speechSynth.stop()` immediately cancels speech synthesis.
- Verify Indian voice selector prioritizes `en-IN` voices when available.

#### 8. Acceptance Criteria
- Spoken announcements are brief, pleasant, and natural.
- Any voice interruption halts speech output immediately and transfers focus to the user command.

---

### 3I — Task History & Audit System

#### 1. Objective
Design a user-facing Task History and Audit system that records every executed task, decomposed steps, tools invoked, user approvals, execution durations, verified outcomes, and failure recoveries, while ensuring zero leakage of secrets or sensitive personal information.

#### 2. Existing Components Affected
- `src/state/useAuditStore.ts`: Extend audit store to record high-level multi-step `TaskRecord` entities alongside raw execution logs.
- `src/components/audit/AuditView.tsx`: Build an interactive user-facing timeline view of automated tasks.
- `src/types/audit.ts`: Expand schema to include step breakdown, computer state snapshots, and verification diffs.

#### 3. New Components / Files Required
- `src/components/audit/TaskHistoryView.tsx`: Clean UI displaying task history, filterable by date, app, skill, and status.
- `src/components/audit/TaskDetailModal.tsx`: Modal displaying complete step-by-step logs, verified screenshots/states, and approvals.
- `src/context/audit-exporter.ts`: Exports redacted audit logs in JSON or CSV format for compliance review.
- `tests/task-audit.test.ts`: Vitest suite verifying task record creation, redaction compliance, and history query filters.

#### 4. Task History Data Schema
Every completed or aborted task generates an immutable record:

```typescript
export interface TaskHistoryRecord {
  id: string;
  timestamp: string;
  userPrompt: string;              // Redacted
  interpretedIntent: string;
  targetApp?: string;
  overallRisk: RiskLevel;
  approvalType: 'none' | 'single-click' | 'typed-phrase';
  approvalTimestamp?: string;
  status: 'COMPLETED' | 'FAILED' | 'ABORTED_BY_KILL_SWITCH';
  totalSteps: number;
  completedSteps: number;
  toolsUsed: string[];             // e.g. ['computer_tool', 'browser_skill']
  stepDetails: {
    stepNumber: number;
    title: string;
    action: string;
    expectedResult: string;
    verifiedState: string;
    retriesUsed: number;
    durationMs: number;
    success: boolean;
  }[];
  totalDurationMs: number;
  failureReason?: string;
  recoveryAttempts: number;
  hasRedactions: boolean;
}
```

#### Privacy & Retention Controls:
- **Redaction**: All prompts, params, and logs pass through `redactSensitiveData()` before persistence.
- **Local-Only**: History is stored exclusively on the user's local disk (SQLite / IndexedDB); zero cloud transmission.
- **Purge Control**: User can clear history by age (24 hours, 7 days, 30 days, or all time).

#### 5. Dependencies
- Existing `useAuditStore.ts` and `redactor.ts`.

#### 6. Risks & Mitigation
- **Risk**: Audit logs accumulating large UI tree dumps and consuming excessive disk space.  
  **Mitigation**: Store only normalized state summaries (active window, matched element title) rather than full multi-megabyte AX trees.

#### 7. Testing Strategy
- Execute a 3-step task and verify that `TaskHistoryRecord` is created with 3 step details and accurate timestamps.
- Verify that filtered queries by `status === 'FAILED'` correctly return only failed tasks.
- Verify history export generates valid redacted JSON.

#### 8. Acceptance Criteria
- User can view their automation history in a clean timeline view.
- Every entry truthfully reflects step successes, retries, and failure reasons.
- No plaintext credentials, auth headers, or private keys appear in audit records.

---

### 3J — Phase 3 Testing Architecture

#### 1. Objective
Establish a complete testing framework covering all new Phase 3 subsystems (Intent, Planning, Context, Skills, Browser, Files, Safety, Voice, History) while guaranteeing that 100% of Phase 1, Phase 2, and Phase 2.5 baseline tests continue to pass without regression.

#### 2. Existing Components Affected
- `tests/`: Add 8 dedicated test suites matching the Phase 3 subsystems.
- `scripts/`: Add `scripts/validate-phase-3.mjs` automated verification runner.
- `package.json`: Add `npm run test:phase3` script.

#### 3. New Test Suites & Coverage Targets

| Test Suite | Target File | Key Assertions & Scenarios | Minimum Passing Tests |
| :--- | :--- | :--- | :--- |
| **Intent & Multilingual** | `tests/contextual-intent.test.ts` | Multi-turn follow-ups, anaphora resolution, English, Malayalam, Manglish, mixed commands | 15 tests |
| **Dynamic Planning** | `tests/dynamic-planning.test.ts` | Compound goal decomposition, step typing, precondition checking, dynamic re-planning on unexpected state | 12 tests |
| **Context & Memory** | `tests/task-context.test.ts` | Entity extraction, 120s TTL expiry, task switching, data redaction before storage | 10 tests |
| **Skill Registry** | `tests/skill-registry.test.ts` | Skill registration, schema validation, tool dispatch, permission enforcement | 12 tests |
| **Browser Automation**| `tests/browser-automation.test.ts` | Safari/Chrome tabs, navigation, form inputs, link clicks, title verification | 10 tests |
| **File Automation** | `tests/file-automation.test.ts` | File discovery, safe metadata read, file creation, trash deletion, path protection blocks | 12 tests |
| **Safety & Approval** | `tests/safety-approval.test.ts` | Risk tier escalation, blast-radius metrics, typed phrase mismatch rejection, Emergency Stop loop break | 10 tests |
| **Voice & Speech** | `tests/voice-experience.test.ts` | Indian female voice profile selection, phonetic normalization, barge-in stop interrupt | 8 tests |
| **Task History** | `tests/task-audit.test.ts` | Immutable record generation, privacy redaction check, query filters, purge | 8 tests |
| **Regression Suite** | All 22 existing test files | Phase 1, Phase 2, and Phase 2.5 tests (131 tests) must remain 100% passing | 131 tests |
| **Total Target** | | | **228+ passing tests** |

#### 4. Automated Phase 3 Verification Runner
Create `scripts/validate-phase-3.mjs` modeling the successful Phase 2.5 runner:
1. Verifies TypeScript compilation (`tsc --noEmit`).
2. Runs complete Vitest test suite (`npm run test:run`).
3. Executes Rust backend test suite (`cargo test` in `src-tauri`).
4. Simulates 5 real-world end-to-end task sequences:
   - Compound Browser Workflow (Safari Search -> First Result -> Back).
   - Multilingual File Organization (Manglish command moving files to folder).
   - Follow-Up Contextual Flow (Open App -> Now perform action -> Do it again).
   - Gated Safety & Approval Flow (Attempt bulk deletion -> Verify review modal -> Reject).
   - Emergency Stop Barge-in (Kill switch engaged mid-task -> Immediate zero-step halt).
5. Compiles production bundle (`npm run build`).

---

## 4. Current Architecture Summary (Baseline)

Before Phase 3 modifications, the baseline repository contains:
1. **Command Router** (`src/core/router.ts`): Deterministic NLP pattern matcher mapping regex patterns to `ActionPlan`.
2. **Action Planner** (`src/core/action-planner.ts`): Static multi-step template generator for Safari search, Calculator, TextEdit, volume, and window control in EN/ML/Manglish.
3. **Execution Loop** (`src/core/execution-loop.ts`): `ClosedLoopExecutor` with pre-observation, action dispatch, post-verification, and retry recovery.
4. **Perception & Targeting** (`src/core/semantic-targeting.ts`): Accessibility tree heuristic resolver matching titles, roles, and address bars.
5. **Computer Control Native Engine** (`src/skills/computer-control.ts`, `src-tauri/src/commands/`): Rust & AppleScript bridge executing native macOS GUI and system events.
6. **Safety & Policy** (`src/core/policy-engine.ts`, `src/core/kill-switch.ts`): 4-tier risk classification, Emergency Stop kill switch, and permission diagnostic banner.
7. **Voice** (`src/adapters/voice/`): Web Speech synthesis and wake-word listener.
8. **Verification Baseline**: 22 test files, 131 tests passing (100%), 0 TypeScript errors.

---

## 5. Phase 3 Architecture Summary (Target)

1. **Contextual Intent Layer**: Follow-up resolution, anaphora resolution, and multilingual slot filling feed into the deterministic router without altering fast paths.
2. **Dynamic Task Planner & Adaptive Re-Planner**: Decomposes compound goals into typed steps with pre/post-conditions and re-plans autonomously on state deviations.
3. **Context & Working Memory**: Ephemeral computer working memory, multi-turn task entity blackboard, and privacy-preserving redaction engine.
4. **Extensible Skills Architecture**: Scalable registry with 8 core plugins (Computer, Browser, Files, Document, Email, Office, System, Media).
5. **Advanced Browser Automation**: Multi-tab control, DOM form filling, and navigation with multi-layered perception (AXUIElement $\rightarrow$ Scripting $\rightarrow$ Visual).
6. **Safe File & Document Automation**: Spotlight/metadata search, sandboxed file mutations, protected directory blocks, and Trash-only deletions.
7. **Human Approval & Safety UX**: Plain-language risk explanations, blast-radius metrics, visual diffs, and typed confirmation phrases.
8. **Voice Experience**: Decoupled voice layer with a young Indian female voice persona (`en-IN`), real-time execution announcements, and instant barge-in cancellation.
9. **Task History & Audit**: Local, redacted task history timeline with truthful step-by-step verification diffs and export/purge controls.

---

## 6. Files & Components Affected

### Modified Existing Files
* `src/core/router.ts`: Contextual intent pre-processing hook.
* `src/core/action-planner.ts`: Dynamic goal decomposition and re-planning integration.
* `src/core/execution-loop.ts`: Dynamic re-planner invocation and progress announcements.
* `src/core/conversational-context.ts`: Refactored to multi-turn task memory.
* `src/core/policy-engine.ts`: File mutation and blast-radius evaluation.
* `src/types/action-plan.ts`: Expanded step and plan schemas.
* `src/types/skills.ts`: Upgraded skill manifest contract.
* `src/state/useCommandStore.ts`: Dynamic skill registry dispatch and task history hooks.
* `src/adapters/voice/speech-synthesis.ts`: Indian female voice profile and prosody controls.
* `src-tauri/src/commands/mod.rs`: Registered filesystem commands.

### New Components & Files
* `src/core/contextual-intent-resolver.ts`
* `src/core/multilingual-nlp.ts`
* `src/core/dynamic-planner.ts`
* `src/core/replanning-engine.ts`
* `src/context/task-context-manager.ts`
* `src/context/entity-blackboard.ts`
* `src/skills/skill-registry.ts`
* `src/skills/base-skill.ts`
* `src/skills/browser/browser-skill.ts`
* `src/skills/files/files-skill.ts`
* `src/skills/document/document-skill.ts`
* `src/skills/email/email-skill.ts`
* `src/skills/office/office-skill.ts`
* `src/skills/system/system-skill.ts`
* `src/skills/media/media-skill.ts`
* `src-tauri/src/commands/filesystem.rs`
* `src/adapters/voice/voice-announcer.ts`
* `src/adapters/voice/phonetic-preprocessor.ts`
* `src/components/audit/TaskHistoryView.tsx`
* `src/components/approval/RiskExplanationBanner.tsx`

---

## 7. Dependencies

* **Runtime**: Node.js v20+, Rust 1.84+, Tauri v2.2+, macOS 13+ (Ventura, Sonoma, Sequoia).
* **Frontend**: React 18, Zustand, Zod, Tailwind CSS, Lucide React.
* **macOS Permissions**: Accessibility (TCC), Automation (Apple Events), Full Disk Access (optional for files).
* **Zero Heavy External Dependencies**: Retains local, sub-millisecond dispatch without requiring external cloud inference for intent routing.

---

## 8. Risks and Architectural Mitigations

| Risk | Impact | Architectural Mitigation |
| :--- | :--- | :--- |
| **Context Bleed** | Prior task entities erroneously injected into unrelated commands | Enforce 120s TTL auto-expiration; explicit topic shifts or app switches wipe entity memory |
| **Re-Planning Loops** | Planner enters infinite loops on frozen applications | Cap re-planning at 2 attempts per task; fail closed and report truthful status |
| **File Destruction** | Accidental file overwrite or system directory mutation | Strict `FORBIDDEN_FILE_PATHS` block; deletions route exclusively to macOS Trash; batch operations require explicit approval |
| **TCC Restrictions** | macOS blocks accessibility or automation AppleEvents | Pre-flight permission checks with actionable diagnostic banners; truthful failure reporting |
| **Voice Clutter** | Spoken announcements annoy user during rapid tasks | Throttled to max 1 announcement per 1.5s; user toggle for silent mode; instant barge-in cancellation |

---

## 9. Comprehensive Testing Strategy

1. **Unit Testing**: Every new module (`ContextualIntentResolver`, `DynamicPlanner`, `SkillRegistry`, `FilesSkill`, `BrowserSkill`) covered with dedicated Vitest suites.
2. **Multi-Turn Scenario Testing**: Validating entity retention and pronoun resolution across 3+ conversational turns.
3. **Fault Injection & Re-Planning Testing**: Simulating missing UI elements, backgrounded windows, and network delays to verify adaptive re-planning.
4. **Safety & Gating Testing**: Asserting that high-risk and critical actions cannot execute without review modals and exact typed confirmation phrases.
5. **Emergency Stop Testing**: Asserting that invoking the kill switch at any point halts execution immediately.
6. **Regression Invariant**: All 22 existing Vitest test files (131 tests) and 13 Rust tests must pass with 100% fidelity.

---

## 10. Acceptance Criteria

- [ ] Multi-turn follow-ups (e.g. *"Now search for Oksy Healthcare"*, *"Open the first result"*, *"Go back"*) execute correctly within active context.
- [ ] English, Malayalam script, Manglish, and mixed queries resolve to valid plans.
- [ ] Dynamic planner breaks complex compound goals into verified atomic steps.
- [ ] Adaptive re-planner recovers from unexpected window or focus state deviations.
- [ ] All 8 initial skills are registered in `SkillRegistry` with typed schemas, risk ratings, and verification strategies.
- [ ] Browser automation supports navigation, tabs, form filling, and link clicks in Safari and Chrome.
- [ ] File operations safely inspect, create, move, and organize files, blocking protected system directories.
- [ ] High-risk actions require visual review; critical actions require exact typed phrases.
- [ ] Spoken announcements feature a natural young Indian female voice profile with instant barge-in interruption.
- [ ] User-facing task history displays a clean, redacted timeline of executed tasks.
- [ ] Baseline test pass rate remains 100% (228+ total tests passing).

---

## 11. Recommended Implementation Order

To maintain stability and enable continuous verification, implementation must proceed in 5 sequential stages:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PHASE 3 IMPLEMENTATION ROADMAP                    │
└────────────────────────────────────────────────────────────────────────┘

STAGE 1: FOUNDATION EXTENSIONS (Context & Skills Architecture)
  1.1 Update Types & Manifests (`src/types/skills.ts`, `src/types/context.ts`)
  1.2 Implement Task Context & Entity Blackboard (`src/context/task-context-manager.ts`)
  1.3 Build Skill Registry & Base Skill (`src/skills/skill-registry.ts`)
  1.4 Refactor Computer Control as foundational `ComputerSkill`
  └─▶ Verification: Unit tests for Context and Skill Registry pass cleanly.

STAGE 2: INTELLIGENCE UPGRADES (Intent & Dynamic Planning)
  2.1 Build Multilingual NLP & Tokenizer (`src/core/multilingual-nlp.ts`)
  2.2 Implement Contextual Intent Resolver (`src/core/contextual-intent-resolver.ts`)
  2.3 Build Dynamic Task Planner & Pre/Post-Conditions (`src/core/dynamic-planner.ts`)
  2.4 Build Adaptive Re-Planning Engine (`src/core/replanning-engine.ts`)
  └─▶ Verification: Multi-turn intent and re-planning tests pass; baseline router preserved.

STAGE 3: DOMAIN AUTOMATION SKILLS (Browser & Files)
  3.1 Implement Browser Automation Skill (`src/skills/browser/`)
  3.2 Build Safe Filesystem Rust Backend (`src-tauri/src/commands/filesystem.rs`)
  3.3 Implement Files Skill & Document Skill (`src/skills/files/`, `src/skills/document/`)
  3.4 Implement Office, System, and Media Skills
  └─▶ Verification: Real macOS Safari and Finder safe operations verified.

STAGE 4: USER EXPERIENCE & SAFETY (Voice, Approval & History)
  4.1 Implement Human Approval & Blast-Radius UX (`src/components/approval/`)
  4.2 Build Voice Announcer & Young Indian Female Voice Profile (`src/adapters/voice/`)
  4.3 Implement Task History & Redacted Audit Viewer (`src/components/audit/TaskHistoryView.tsx`)
  └─▶ Verification: Barge-in stops TTS instantly; task history records accurate state diffs.

STAGE 5: END-TO-END VALIDATION & HARDENING
  5.1 Run Complete Vitest Suite (Target: 228+ passing tests)
  5.2 Run Phase 3 Automated Validation Harness (`scripts/validate-phase-3.mjs`)
  5.3 Produce Final Phase 3 Walkthrough and Demonstration Report
```

---

## 12. Final Status

**PHASE 3 PLANNING: COMPLETE & READY FOR IMPLEMENTATION APPROVAL**

*No production code was modified during this planning phase. All existing Phase 1, Phase 2, and Phase 2.5 implementations remain 100% intact, verified, and operational.*
