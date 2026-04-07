# Onboarding UX Fix Plan

## Problem

The current `/onboard` command has two critical UX failures:

1. **Intro promises guidance, then abandons the user.** The welcome screen lists all 6 steps. But each subsequent prompt is terse and unhelpful. Example: `"Choose your model provider."` with options `1. Z.ai / 2. Anthropic`. A new user has no idea what either of those means or why it matters.

2. **Each screen is a prompt, not a guide.** Good onboarding answers four questions at every step: what am I being asked, why does it matter, what does a good answer look like, and what happens if I just accept the default? The current flow answers none of those.

## Root Cause

The extension was built around the implementation sequence, not the user's mental model. Each function is named after what it collects (`selectProvider`, `promptDirectory`), and the prompt copy is the minimum viable label. That's a form, not onboarding.

## The Fix

Every screen gets rewritten with four things:
1. **What this step does** (plain English)
2. **Why it matters** (consequence of the choice)
3. **What a good answer looks like** (concrete examples)
4. **What the default is** (and when to just accept it)

The flow order stays the same (project root, provider, models, directories, overrides, env). The logic layer in `src/onboarding/core.ts` stays untouched. Only `.pi/extensions/onboard.ts` changes.

---

## Screen-by-screen rewrite plan

### Screen 0: Welcome (confirm)

Current:
```
This onboarding wizard will configure the multi-team Agent Pi setup for a project.

What you will be asked for:
1. Project root directory
2. Model provider
...etc
Continue?
```

Problem: Walls of text. No context for what this system IS.

New copy:
```
Welcome to Multi-Team Agent Pi Setup

This wizard configures a 10-agent coding team for your project. When finished,
your agents will know which project to work on, which AI models to use, and
where your code lives.

The team structure:
- 1 Orchestrator (receives your requests, delegates to teams)
- 3 Team Leads (Planning, Engineering, Validation)
- 6 Workers (Product Manager, UX Researcher, Frontend Dev, Backend Dev,
  QA Engineer, Security Reviewer)

This takes about 2 minutes. You can cancel at any step.

Ready to start?
```

Why this is better: Tells the user what they're setting up, what the output is, and how long it takes. The team structure makes the rest of the wizard make sense ("oh, that's why it asks for frontend and backend directories separately").

---

### Screen 1: Project Root (input)

Current:
```
Title: "Onboarding - Step 1 of 6"
Prompt: "Enter the target project root directory"
Default: ctx.cwd
```

Problem: "Target project root" is jargon. What if they want to point at a different project?

New copy:
```
Title: "Step 1 - Project Root"
Prompt: |
  Which project should these agents work on?

  Enter the full path to your project's root folder. This is the folder
  that contains your main config files (package.json, Cargo.toml, etc.)
  and the top-level source directories.

  Examples:
    /Users/you/projects/my-app
    /home/dev/work/api-server

  If you want the agents to work on the current project, just press Enter.
Default: ctx.cwd
```

---

### Screen 2: Provider (input with numbered choices)

Current:
```
Title: "Onboarding - Step 2 of 6"
Prompt: "Choose your model provider."
Options: 1. Z.ai  2. Anthropic
```

Problem: A new user has no idea what "model provider" means or what the difference is.

New copy:
```
Title: "Step 2 - AI Model Provider"
Prompt: |
  Which AI service should power your agents?

  This determines which language models your agents use. Each provider
  has different models, pricing, and requires its own API key.

  1. Z.ai
     Models: GLM-5.1 (leads), GLM-5 Turbo (workers)
     API key needed: ZAI_API_KEY
     Best for: Projects already using Z.ai

  2. Anthropic
     Models: Claude Opus (leads), Claude Sonnet (workers)
     API key needed: ANTHROPIC_API_KEY
     Best for: Projects preferring Claude models

  Type 1 or 2.
Default: "1" (or current provider if re-running)
```

---

### Screen 3: Lead Model (input with numbered choices)

Current:
```
Title: "Onboarding - Step 3 of 6"
Prompt: "Choose a model option."
Options: 1. zai/glm-5.1 (recommended)  2. zai/glm-5-turbo  3. Custom model ID
```

Problem: "Choose a model option" is vague. No explanation of who uses this model or why.

New copy:
```
Title: "Step 3 - Lead Model"
Prompt: |
  Choose the model for your lead-tier agents.

  These 4 agents handle coordination and planning:
    - Orchestrator (delegates your requests to teams)
    - Planning Lead (strategy, specs, requirements)
    - Engineering Lead (architecture, code decisions)
    - Validation Lead (quality, security, testing)

  Leads need stronger reasoning, so this is usually your most capable model.

  1. {recommended} (recommended)
  2. {alternate}
  3. Custom model ID

  Type 1, 2, or 3.
Default: "1"
```

---

### Screen 4: Worker Model (input with numbered choices)

Current:
```
Title: "Onboarding - Step 4 of 6"
Prompt: "Choose a model option."
```

New copy:
```
Title: "Step 4 - Worker Model"
Prompt: |
  Choose the model for your worker-tier agents.

  These 6 agents do focused, specialized work:
    - Product Manager (requirements, user stories)
    - UX Researcher (personas, usability)
    - Frontend Dev (UI, client-side code)
    - Backend Dev (APIs, databases, infrastructure)
    - QA Engineer (testing, edge cases)
    - Security Reviewer (vulnerabilities, auth)

  Workers handle specific tasks, so a faster model often works well here.

  1. {recommended} (recommended)
  2. {alternate}
  3. Custom model ID

  Type 1, 2, or 3.
Default: "1"
```

---

### Screen 5: Directory Mapping (5 input prompts)

Current:
```
Title: "Onboarding - Directory Mapping"
Prompt: "{label} path relative to the selected project root"
```

Problem: No explanation of why this matters or which agent uses which directory.

New copy, one prompt per directory:

**Frontend:**
```
Title: "Step 5 - Frontend Directory"
Prompt: |
  Where is your frontend source code?

  The Frontend Dev agent will read and write files in this directory.
  Enter a path relative to your project root.

  Examples: src/frontend/, src/, app/, client/

  Just press Enter to use the default.
Default: {current or suggested or "src/frontend/"}
```

**Backend:**
```
Title: "Step 5 - Backend Directory"
Prompt: |
  Where is your backend source code?

  The Backend Dev agent will read and write files in this directory.
  Enter a path relative to your project root.

  Examples: src/backend/, server/, api/, src/

  Just press Enter to use the default.
Default: {current or suggested or "src/backend/"}
```

**Tests:**
```
Title: "Step 5 - Tests Directory"
Prompt: |
  Where are your tests?

  The QA Engineer agent will look for and create tests here.
  Enter a path relative to your project root.

  Examples: tests/, test/, __tests__/, src/__tests__/

  Just press Enter to use the default.
Default: {current or suggested or "tests/"}
```

**Docs:**
```
Title: "Step 5 - Documentation Directory"
Prompt: |
  Where is your documentation?

  Agents with documentation access can read from this directory.
  Enter a path relative to your project root.

  Examples: docs/, documentation/, doc/

  Just press Enter to use the default.
Default: {current or suggested or "docs/"}
```

**Specs:**
```
Title: "Step 5 - Specifications Directory"
Prompt: |
  Where are your specs or planning documents?

  The Product Manager, UX Researcher, and Planning Lead use this
  directory for requirements and specifications.
  Enter a path relative to your project root.

  Examples: specs/, planning/, requirements/

  Just press Enter to use the default.
Default: {current or suggested or "specs/"}
```

---

### Screen 6: Per-agent overrides (confirm + loop)

Current:
```
Title: "Onboarding - Optional overrides"
Prompt: "Do you want to override models for individual agents?"
```

New copy:
```
Title: "Step 6 - Advanced (Optional)"
Prompt: |
  Per-agent model overrides

  All agents are set to use your chosen lead or worker model. If you
  want specific agents to use different models (for example, putting
  the Security Reviewer on a stronger model), you can override them
  one by one.

  Most users skip this step.

  Configure per-agent overrides?
```

Each override prompt in the loop:
```
Title: "Step 6 - Override {agent name}"
Prompt: |
  Override model for {agent display name}?

  Current model: {current model}

  Press y to change, or n to keep the current model.
```

---

### Screen 7: Environment / API Key (confirm + choice)

Current:
```
Title: "Onboarding - Provider credentials"
Prompt: "Do you want onboarding to help set up {envVar} in .env?"
```

New copy:
```
Title: "Step 7 - API Key Setup (Optional)"
Prompt: |
  Set up your API key in .env?

  Your agents need a {envVar} to call the {provider label} API.
  Onboarding can add this to your .env file.

  Options:
  - Add a placeholder (you fill in the real key later)
  - Add the real value now
  - Skip (set it up yourself)

  Note: If you already have a key in .env, it will NOT be overwritten.

  Set up {envVar} in .env?
```

Then the mode choice:
```
Title: "Step 7 - API Key Setup"
Prompt: |
  How should {envVar} be added?

  1. Add placeholder (ZAI_API_KEY=your-key-here)
  2. Add real value now
  3. Skip

  Type 1, 2, or 3.
Default: "1"
```

---

### Final Review (confirm)

Current:
```
Title: "Onboarding - Final review"
Prompt: "Review your onboarding choices before applying." + raw data dump
```

New copy:
```
Title: "Review - Ready to Apply"
Prompt: |
  Here is what onboarding will set up. Review before applying.

  Project: {projectRoot}
  Provider: {provider label}

  Lead model (Orchestrator + 3 Leads): {leadModel}
  Worker model (6 Specialists): {workerModel}

  Directory mapping:
    Frontend -> {frontend}
    Backend  -> {backend}
    Tests    -> {tests}
    Docs     -> {docs}
    Specs    -> {specs}

  {env section if applicable}

  This will update:
  - .pi/multi-team/multi-team-config.yaml
  - 10 agent files in .pi/multi-team/agents/
  - {optional} .env file

  Backups will be created (.bak files) before any changes.

  Apply these changes?
```

---

### Success notification

Current:
```
"Onboarding applied successfully"
```

New copy:
```
"Setup complete! Your 10-agent team is ready. Talk to the Orchestrator to get started."
```

---

## Implementation plan

1. **Only `.pi/extensions/onboard.ts` changes.** No changes to `src/onboarding/` core logic or tests.
2. **Keep the same helper functions** (`promptChoice`, `promptDirectory`, etc.) but rewrite the prompt copy inside each one.
3. **No structural flow changes.** Same order, same logic, same defaults.
4. **No new dependencies.** Same `ctx.ui.input`, `ctx.ui.confirm`, `ctx.ui.notify` APIs.

## Files touched

- `.pi/extensions/onboard.ts` (prompt copy rewrite only)

## Validation

- `bun run typecheck` must pass (unchanged)
- `bun test` must pass (unchanged)
- Manual test: `/reload` then `/onboard` in Pi
