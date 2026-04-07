# CLI Onboarding Plan for Multi-Team Agentic Coding

**Author:** Paul  
**Date:** 2026-04-07  
**Status:** Reviewed, revised  

---

## Executive Summary

The original direction is right, but the first draft was a little too optimistic about how safely we can rewrite the config with regex alone.

After a second-pass review of the actual files in this repo, the clean V1 is:

1. Build a project-local Pi extension at `.pi/extensions/onboard.ts`
2. Register an `/onboard` command
3. Walk the user through:
   - project path
   - provider selection
   - directory mapping
   - tier model assignment
   - optional per-agent overrides
   - optional provider credential setup guidance
4. Apply changes by rewriting only the known config surfaces:
   - `.pi/multi-team/multi-team-config.yaml`
   - `.pi/multi-team/agents/*.md`
5. Support re-running safely by reading the current config and using it as defaults

The major correction from draft one: **do not rely on loose regex-only YAML editing for everything**. The file set is small and structured, so the safer move is controlled whole-file rewrites from templates or tightly-scoped line replacements with validation.

---

## What I Found in the Codebase Review

### 1. The current customization surface is real and spread across multiple files

This is not just one config file.

Customization currently lives in:
- `.pi/multi-team/multi-team-config.yaml`
- 10 agent markdown files in `.pi/multi-team/agents/`

The agent files contain:
- YAML frontmatter with `model`, `tools`, `domain`, `skills`, `expertise`
- body markdown with hardcoded path references like `specs/`, `tests/`, `src/backend/`, `src/frontend/`

So the onboarding flow absolutely should own both config and agent files.

### 2. Not every agent needs the same kind of rewrite

From the actual files:

#### Model-only or mostly model-only agents
- `orchestrator.md`
- `engineering-lead.md`
- `validation-lead.md`
- `security-reviewer.md`

#### Path-sensitive agents
- `backend-dev.md`
- `frontend-dev.md`
- `qa-engineer.md`
- `product-manager.md`
- `ux-researcher.md`
- `planning-lead.md`

The first draft was directionally right here.

### 3. `.claude/settings.local.json` is not part of the real product path

That file contains a hardcoded Windows-style path and Claude-local permissions. It is clearly repo-local scaffolding, not part of the Pi multi-team runtime.

So onboarding should **not** touch it.

### 4. Re-run support is not optional

This repo is designed to be copied into different projects. That means users will almost certainly need to run onboarding more than once.

V1 should read current values and prefill from them.

### 5. Provider setup should be partly automated, partly instructional

We can support provider selection cleanly, but we should be careful about writing secrets.

Best V1 behavior:
- optionally create/update a local `.env` file in the target project for non-secret placeholders or user-supplied keys
- never silently overwrite existing secrets
- show exact follow-up instructions when we cannot safely automate

---

## Final Product Decision

We are building a **Pi onboarding wizard** for this repo.

### Entry point
- Command: `/onboard`
- Location: `.pi/extensions/onboard.ts`

### Primary goal
Turn a copy-paste-and-edit-10-files setup into a guided configuration flow that produces a working multi-team setup for the user's actual project.

### Secondary goal
Make it safe to re-run so the config evolves with the user's project.

---

## V1 Scope

### The wizard will collect

1. **Project root path**
2. **Model provider**
3. **Directory mapping**
   - frontend source
   - backend source
   - tests
   - docs
   - specs
4. **Tier model assignments**
   - orchestrator + leads
   - workers
5. **Optional per-agent model overrides**
6. **Optional provider credential assistance**

### The wizard will apply

1. update `.pi/multi-team/multi-team-config.yaml`
2. update all 10 agent files
3. create missing mapped directories if user approves
4. optionally create a `.env` file if missing
5. optionally append missing provider env vars if user opts in

### The wizard will not do in V1

1. touch `.claude/settings.local.json`
2. attempt to validate that custom model IDs are real against the provider API
3. auto-detect every framework under the sun
4. modify anything outside the target project and its `.pi/multi-team/` folder

---

## User Flow

```
/onboard
  │
  ├─► Step 1: Choose target project root
  │     Default: current cwd
  │     Validate: exists, directory, writable
  │
  ├─► Step 2: Detect existing setup
  │     If .pi/multi-team exists and is configured:
  │       "Existing config found. Reconfigure using current values as defaults?"
  │
  ├─► Step 3: Select provider
  │     [Z.ai] [Anthropic]
  │
  ├─► Step 4: Map directories
  │     frontend, backend, tests, docs, specs
  │     with current values or smart defaults
  │
  ├─► Step 5: Configure models
  │     Tier defaults first
  │     Optional per-agent overrides second
  │
  ├─► Step 6: Provider setup
  │     If Z.ai selected:
  │       ask whether to add ZAI_API_KEY placeholder or value to .env
  │     If Anthropic selected:
  │       ask whether to add ANTHROPIC_API_KEY placeholder or value to .env
  │
  ├─► Step 7: Review
  │     Show exact files to be changed and resulting values
  │
  └─► Step 8: Apply
        - write files
        - create directories
        - create backups
        - show summary
```

---

## Resolved Open Questions

## 1. Should onboarding also handle API key setup?

**Decision: Yes, but conservatively.**

### Final behavior
- Offer optional provider credential setup during onboarding
- If `.env` does not exist, offer to create it
- If the needed env var is missing, offer:
  - add placeholder only, or
  - add user-supplied value
- If the env var already exists, do not overwrite without explicit confirmation

### Why
This removes a common failure point without doing anything reckless with secrets.

### Rules
- For Z.ai: support `ZAI_API_KEY`
- For Anthropic: support `ANTHROPIC_API_KEY`
- Never print full secret values back in summaries
- Never silently overwrite existing env vars

---

## 2. Should onboarding detect project type?

**Decision: Yes, lightly.**

### Final behavior
Use lightweight heuristics to improve defaults, but keep the user in control.

### Detection rules for V1
- If `package.json` contains `next`, suggest `app/` or `src/app/` as frontend candidates
- If `package.json` contains `react`, suggest `src/` or `src/frontend/`
- If `package.json` contains `vite`, suggest `src/`
- If a repo contains `server/`, `api/`, or `backend/`, offer those as backend candidates
- If a repo contains `test/`, `tests/`, or `__tests__/`, offer those as test candidates
- If `docs/` or `specs/` exists, prefer them

### Why
This is cheap and useful. It improves first-run experience without locking us into brittle framework logic.

### Constraint
These are only suggestions. The user still confirms everything.

---

## 3. Should re-running `/onboard` be additive?

**Decision: Yes. Absolutely.**

### Final behavior
If existing config is found, onboarding reads current values and uses them as defaults.

### Specifically
Read current values from:
- `.pi/multi-team/multi-team-config.yaml`
- `.pi/multi-team/agents/*.md`

Prefill:
- provider
- model assignments
- mapped directories
- any existing agent-specific overrides we can detect safely

### Why
Without this, onboarding becomes a one-time installer instead of a maintainable config surface.

---

## 4. Should we allow custom model IDs?

**Decision: Yes, with explicit warning.**

### Final behavior
For each tier and each per-agent override, offer:
- provider default recommended model
- alternate known model for that provider if applicable
- custom freeform model ID

### Constraints
- We do not validate the model against the provider in V1
- We display a warning before apply:
  - custom model IDs are accepted as-is
  - startup may fail later if the model is unavailable or misnamed

### Why
People will want to use proxies, custom providers, or newer IDs. Blocking that would be too rigid.

---

## 5. Should onboarding also update `.claude/settings.local.json`?

**Decision: No.**

### Why
- It is not part of the Pi multi-team runtime
- It appears environment-specific and not portable
- Touching it would create more confusion than value

V1 should stay tightly scoped to Pi config only.

---

## Implementation Strategy

## Core design principle
**Prefer deterministic rewrites over clever parsing.**

The first draft suggested regex-based YAML editing. That is risky once we start changing nested `domain:` arrays and mixed markdown bodies.

### Safer V1 approach
Use a hybrid strategy:

#### A. For `multi-team-config.yaml`
Use structured, targeted rewrite logic for known fields:
- `active_provider`
- `orchestrator.model`
- `orchestrator.api_base`
- provider tier values if needed

Because this file is small and stable, we can either:
1. regenerate it from an internal template plus captured values, or
2. do highly targeted replacements validated after write

**Decision:** regenerate from template for V1.

That is simpler and safer.

#### B. For agent files
Do not try to generically parse arbitrary markdown.

These files all follow a controlled house format. So V1 should:
1. read the existing file
2. extract frontmatter and body
3. replace only the known fields and known path strings
4. validate the result still contains expected sections
5. write backup and then write final

This is still controlled editing, but not loose regex spray.

---

## Concrete Config Surfaces

## Provider definitions

```typescript
const PROVIDERS = {
  zai: {
    id: "zai",
    label: "Z.ai",
    defaultLeadModel: "zai/glm-5.1",
    defaultWorkerModel: "zai/glm-5-turbo",
    apiBase: "https://api.z.ai/api/paas/v4/",
    envVar: "ZAI_API_KEY",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultLeadModel: "anthropic/claude-opus-4-6",
    defaultWorkerModel: "anthropic/claude-sonnet-4-6",
    apiBase: null,
    envVar: "ANTHROPIC_API_KEY",
  },
};
```

## Agent groups

### Lead-tier agents
- orchestrator
- planning-lead
- engineering-lead
- validation-lead

### Worker-tier agents
- product-manager
- ux-researcher
- frontend-dev
- backend-dev
- qa-engineer
- security-reviewer

## Directory roles

```typescript
const DIR_ROLES = [
  {
    id: "frontend",
    label: "Frontend source",
    default: "src/frontend/",
    bodyReplacements: ["src/frontend/"],
    agentFiles: ["frontend-dev.md"],
  },
  {
    id: "backend",
    label: "Backend source",
    default: "src/backend/",
    bodyReplacements: ["src/backend/"],
    agentFiles: ["backend-dev.md"],
  },
  {
    id: "tests",
    label: "Tests",
    default: "tests/",
    bodyReplacements: ["tests/"],
    agentFiles: ["qa-engineer.md"],
  },
  {
    id: "docs",
    label: "Documentation",
    default: "docs/",
    bodyReplacements: ["docs/"],
    agentFiles: ["frontend-dev.md", "backend-dev.md"],
  },
  {
    id: "specs",
    label: "Specifications",
    default: "specs/",
    bodyReplacements: ["specs/"],
    agentFiles: ["planning-lead.md", "product-manager.md", "ux-researcher.md"],
  },
];
```

---

## File Update Rules

## 1. `multi-team-config.yaml`

### Rebuild from template with these values
- active provider
- orchestrator model
- orchestrator api_base presence or absence
- providers block
- all team paths unchanged

### Important correction
The `providers` block should stay complete for both built-in supported providers in this repo, not be narrowed to only one provider. The active provider changes behavior. The provider catalog itself can remain intact.

So the onboarding tool should rewrite:
- `active_provider`
- `orchestrator.model`
- `orchestrator.api_base`

And preserve the available provider mappings for both Z.ai and Anthropic.

---

## 2. Agent markdown files

### Update frontmatter fields
- `model:`
- relevant `domain:` path entries

### Update body text path references
Examples from actual files:
- backend dev purpose references `src/backend/` and `docs/`
- frontend dev purpose references `src/frontend/` and `docs/`
- QA purpose references `tests/`
- planning/product/ux instructions reference `specs/`
- engineering lead domain references `src/` only for read-only context

### Important correction
The engineering lead has a read-only `src/` domain, not separate frontend/backend mappings. This means the first draft slightly overstated which path rewrites are needed there.

**Decision:** leave `engineering-lead.md` pathing unchanged in V1 unless the user opts into a custom engineering root. Keep it simple.

---

## 3. `.env`

### Update rules
- If file missing, offer to create
- If env var missing, append it
- If env var exists, prompt before replacing
- Never remove unrelated keys

---

## Validation Rules Before Apply

Before writing anything, validate:

1. target project root exists
2. `.pi/multi-team/` exists, or the wizard knows how to initialize it
3. all agent files exist
4. mapped directories are relative, normalized, and do not escape project root
5. selected models are non-empty strings
6. write permissions are available

If any validation fails, show a fix-first message and do not partially apply.

---

## Write Safety Rules

For every modified file:

1. read original
2. write `filename.bak` if no backup exists for this run
3. write new content
4. re-read and validate the file after write

If any write fails mid-run:
- stop immediately
- report which files were already changed
- offer restore from backups in a future version

V1 can stop short of automatic rollback, but it must be explicit.

---

## Suggested UI Behavior

## Use simple UI first
The first draft leaned toward a fully custom `ctx.ui.custom()` flow.

That is nice, but V1 should start with a simpler and faster implementation:
- `ctx.ui.input()` for paths and custom model IDs
- `ctx.ui.select()` for provider, default models, confirmation prompts
- `ctx.ui.confirm()` for apply and overwrite decisions

### Decision
Use standard UI primitives for V1.

Use `ctx.ui.custom()` only if we want a richer review screen later.

Why:
- faster to implement
- less brittle
- easier to debug
- plenty good for onboarding

---

## Final Build Plan

## Phase 1: Scaffolding
- create `.pi/extensions/onboard.ts`
- register `/onboard`
- verify command loads in Pi

## Phase 2: Read current state
- inspect `.pi/multi-team/multi-team-config.yaml`
- inspect agent files
- extract current provider, models, and mapped directories
- establish defaults for re-run support

## Phase 3: Project path + smart suggestions
- prompt for target root
- detect package.json and directory hints
- build suggested path defaults

## Phase 4: Provider + model configuration
- select provider
- choose tier models
- optional per-agent overrides
- optional custom model IDs

## Phase 5: Directory mapping
- prompt for frontend/backend/tests/docs/specs
- validate and normalize
- offer to create missing directories

## Phase 6: Provider credential assistance
- offer `.env` creation or update
- append missing env placeholders or values safely

## Phase 7: Review
- show full summary:
  - provider
  - env var to configure
  - directories
  - tier models
  - per-agent overrides
  - files to be changed

## Phase 8: Apply
- back up files
- rewrite config
- rewrite agent files
- create directories
- write `.env` changes if approved
- show final result summary

---

## Estimated Time

### Build estimate
- V1 functional onboarding: 3 to 4 hours
- with better review UX and more polished detection: 5 to 6 hours

That is still a good investment because it removes ongoing setup friction across every future project.

---

## Final Decisions Summary

- **API key setup:** Yes, optional and conservative
- **Project type detection:** Yes, lightweight suggestions only
- **Re-run behavior:** Yes, required in V1
- **Custom model IDs:** Yes, allow with warning
- **Update `.claude/settings.local.json`:** No
- **Editing strategy:** deterministic rewrites, not loose regex-only editing
- **UI strategy:** standard `input/select/confirm` primitives for V1

---

## Recommendation

This plan is now solid enough to implement.

If you want the cleanest V1, I’d build it in this order:
1. command scaffold
2. current config reader
3. provider + model prompts
4. directory prompts
5. config/agent rewrite engine
6. `.env` assistance
7. review polish

That keeps the risky part, the rewrite engine, isolated and testable before we make the UX fancy.
