# Multi-Team Agentic Coding

A complete Agent Pi configuration for multi-team agentic software development. Three specialized teams. Ten agents. One orchestrator.

---

## Overview

This repository contains a ready-to-use Agent Pi configuration that implements a three-tier multi-team agentic development system. Drop it into any codebase, customize the directory paths, and your project gains a coordinated team of ten specialized AI agents organized into three functional teams.

**What is Agent Pi?**
Agent Pi is a customizable agentic coding harness that runs Claude-based agents against your codebase. It manages agent configuration, session state, conversation logging, and the delegation protocol that allows agents to route work to each other. This configuration plugs into Agent Pi's multi-team mode.

**Why multi-team?**

- **Specialized agents outperform generalists.** A backend dev that only ever touches `src/backend/` builds deeper context about that domain than an agent that roams everywhere.
- **Domain locking prevents accidents.** Each agent's write access is constrained to their assigned directories. A QA Engineer cannot accidentally modify production code.
- **Mental models compound over time.** Every agent maintains a personal expertise file that persists across sessions. Each session builds on the last. The system gets better at your codebase the more you use it.
- **Leadership stays strategic.** Leads and the orchestrator only coordinate — they never write code. This enforces clean delegation and keeps high-level reasoning separate from low-level execution.

---

## Architecture

### Agent Hierarchy

```
User
 |
 v
Orchestrator  [glm-5.1 / claude-opus-4-6]
 |
 +-- Planning Lead  [glm-5.1 / claude-opus-4-6]
 |    |-- Product Manager     [glm-5-turbo / claude-sonnet-4-6]
 |    +-- UX Researcher       [glm-5-turbo / claude-sonnet-4-6]
 |
 +-- Engineering Lead  [glm-5.1 / claude-opus-4-6]
 |    |-- Frontend Dev        [glm-5-turbo / claude-sonnet-4-6]
 |    +-- Backend Dev         [glm-5-turbo / claude-sonnet-4-6]
 |
 +-- Validation Lead  [glm-5.1 / claude-opus-4-6]
      |-- QA Engineer         [glm-5-turbo / claude-sonnet-4-6]
      +-- Security Reviewer   [glm-5-turbo / claude-sonnet-4-6]
```

### The Three Tiers

**Tier 1 — Orchestrator**
The user's sole interface. Receives every request, classifies it by domain, and routes it to the appropriate team lead via the `delegate` tool. Synthesizes team output into a direct response. Never writes code or executes work directly.

**Tier 2 — Team Leads**
Each lead owns their team's output. They receive delegated work from the orchestrator, break it into specialist tasks, delegate to their members, review member output for quality and coherence, and return a synthesized result. Leads also use the `delegate` tool; they never use `edit`, `write`, or `bash`.

**Tier 3 — Workers**
Execution agents. They receive focused task prompts from their lead, read the relevant code for context, do the actual implementation work, and report back with structured results. Workers have `edit`, `write`, and `bash` access within their defined domain paths.

### Delegation Flow

```
User request
  -> Orchestrator classifies and delegates to Team Lead
     -> Team Lead delegates to specialist Worker(s)
        -> Worker reads code, executes, reports back
     -> Team Lead synthesizes worker output
  -> Orchestrator synthesizes team output
User receives answer
```

The user interacts only with the Orchestrator. Everything below that layer is invisible unless the orchestrator surfaces it.

---

## Teams

### Planning Team

**Purpose:** Define what gets built, why, and in what order. Translate business intent into actionable specifications.

**Planning Lead** (`glm-5.1` / `claude-opus-4-6`)
Owns the planning process. Writes specs, defines user stories, sets priorities, manages scope. Delegates specialist work to Product Manager and UX Researcher. Reports planning recommendations back to the Orchestrator.

| Member | Model | Consult When |
|--------|-------|--------------|
| Product Manager | glm-5-turbo / claude-sonnet-4-6 | Requirements, feature prioritization, user stories, acceptance criteria |
| UX Researcher | glm-5-turbo / claude-sonnet-4-6 | User behavior, personas, journey mapping, usability, friction points |

**Product Manager** — Translates business needs into specifications. Writes user stories with testable acceptance criteria. Prioritizes features by user impact, effort, dependencies, and risk. Writes artifacts to `specs/`.

**UX Researcher** — Analyzes user behavior, builds personas, maps user journeys, identifies usability friction. Reviews existing UI code and flows to surface real usability problems. Writes research artifacts to `specs/`.

---

### Engineering Team

**Purpose:** Build and maintain the software. Own implementation across frontend and backend.

**Engineering Lead** (`glm-5.1` / `claude-opus-4-6`)
Tracks architecture decisions, technical debt, risk patterns, and implementation approaches. Delegates frontend work to Frontend Dev and backend work to Backend Dev. When both are needed, coordinates sequencing (backend first when frontend depends on API changes). Reviews member output for architectural consistency.

| Member | Model | Consult When |
|--------|-------|--------------|
| Frontend Dev | glm-5-turbo / claude-sonnet-4-6 | UI components, layouts, client-side state, browser APIs, CSS |
| Backend Dev | glm-5-turbo / claude-sonnet-4-6 | APIs, databases, infrastructure, background jobs, third-party integrations |

**Frontend Dev** — Owns `src/frontend/`. Builds UI components, manages client-side state, handles browser API integrations and styling. Reads backend code to understand API contracts but never modifies it.

**Backend Dev** — Owns `src/backend/`. Builds and maintains APIs, data models, database access, background jobs, and third-party integrations. Notes API contract changes so the Frontend Dev can adapt.

---

### Validation Team

**Purpose:** Ensure quality and security across everything engineering ships.

**Validation Lead** (`glm-5.1` / `claude-opus-4-6`)
Owns the ship/no-ship decision. Delegates testing to QA Engineer and security audits to Security Reviewer. For code changes, typically engages both in parallel. Synthesizes their findings into a clear validation report with an explicit recommendation.

| Member | Model | Consult When |
|--------|-------|--------------|
| QA Engineer | glm-5-turbo / claude-sonnet-4-6 | Test coverage, edge cases, regression testing, integration tests |
| Security Reviewer | glm-5-turbo / claude-sonnet-4-6 | Vulnerabilities, auth patterns, input validation, dependency risks |

**QA Engineer** — Owns `tests/`. Writes and runs tests covering happy paths, edge cases, error conditions, and integration points. Runs existing test suites to catch regressions. Reports pass/fail counts, specific failures, and blocking vs. non-blocking issues.

**Security Reviewer** — Reviews code for OWASP Top 10 vulnerabilities, authentication and authorization correctness, input validation, and dependency risk. Classifies findings as Critical / Warning / Info / Pass. Read-only: reports findings but does not fix code.

---

## Directory Structure

```
.pi/multi-team/
|
|-- multi-team-config.yaml          # Root config: orchestrator, teams, paths, shared context
|
|-- agents/                         # One .md file per agent (frontmatter + system prompt)
|   |-- orchestrator.md
|   |-- planning-lead.md
|   |-- product-manager.md
|   |-- ux-researcher.md
|   |-- engineering-lead.md
|   |-- frontend-dev.md
|   |-- backend-dev.md
|   |-- validation-lead.md
|   |-- qa-engineer.md
|   +-- security-reviewer.md
|
|-- skills/                         # Reusable behavior modules injected into agent prompts
|   |-- conversational-response.md  # Keep responses concise and synthesized
|   |-- mental-model.md             # How to read and update expertise files
|   |-- active-listener.md          # Read conversation log before every response
|   |-- zero-micro-management.md    # Leaders delegate, never execute
|   |-- high-autonomy.md            # Act decisively, zero questions back to user
|   +-- precise-worker.md           # Thorough, detail-oriented execution
|
|-- expertise/                      # Per-agent YAML mental models (persist across sessions)
|   |-- orchestrator-mental-model.yaml
|   |-- planning-lead-mental-model.yaml
|   |-- product-manager-mental-model.yaml
|   |-- ux-researcher-mental-model.yaml
|   |-- engineering-lead-mental-model.yaml
|   |-- frontend-dev-mental-model.yaml
|   |-- backend-dev-mental-model.yaml
|   |-- validation-lead-mental-model.yaml
|   |-- qa-engineer-mental-model.yaml
|   +-- security-reviewer-mental-model.yaml
|
|-- sessions/                       # Session-scoped working notes (per-run, gitkeep present)
+-- logs/                           # Conversation logs in JSONL format (gitkeep present)
```

---

## Agent Configuration

### Frontmatter Format

Each agent file begins with YAML frontmatter that Agent Pi reads to configure the agent at startup.

```yaml
---
name: backend-dev
# model: anthropic/claude-sonnet-4-6  # Alternative: Anthropic Sonnet
model: zai/glm-5-turbo
expertise:
  - path: .pi/multi-team/expertise/backend-dev-mental-model.yaml
    use-when: "Track API patterns, data models, infrastructure notes, and backend-specific gotchas."
    updatable: true
    max-lines: 10000
skills:
  - path: .pi/multi-team/skills/mental-model.md
    use-when: Read at task start for context. Update after completing work to capture learnings.
  - path: .pi/multi-team/skills/active-listener.md
    use-when: Always. Read the conversation log before every response.
  - path: .pi/multi-team/skills/precise-worker.md
    use-when: Always. Be thorough and detail-oriented in your output.
tools:
  - read
  - grep
  - find
  - ls
  - edit
  - write
  - bash
domain:
  - path: .pi/multi-team/expertise/backend-dev-mental-model.yaml
    read: true
    upsert: true
    delete: false
  - path: src/backend/
    read: true
    upsert: true
    delete: true
  - path: docs/
    read: true
    upsert: true
    delete: false
  - path: .
    read: true
    upsert: false
    delete: false
---
```

| Field | Description |
|-------|-------------|
| `name` | Agent identifier used in delegation and conversation logging |
| `model` | Model ID (supports Anthropic and Z.ai providers) |
| `expertise` | List of personal YAML files to load as the agent's mental model |
| `expertise[].use-when` | Instruction for when to read/update this file |
| `expertise[].updatable` | Whether the agent can write to this file |
| `expertise[].max-lines` | Line budget for the file (agent prunes when approaching limit) |
| `skills` | Behavior modules injected into the system prompt at startup |
| `skills[].use-when` | Instruction for when to apply this skill |
| `tools` | Tools available to this agent |
| `domain` | Filesystem access rules for this agent |
| `domain[].read` | Agent can read files in this path |
| `domain[].upsert` | Agent can create and modify files in this path |
| `domain[].delete` | Agent can delete files in this path |

### System Prompt Structure

Below the frontmatter, each agent file contains a markdown system prompt following a consistent structure:

- **Purpose** — One paragraph describing the agent's role and what they own
- **Variables** — Runtime context injected by Agent Pi (session directory, conversation log path)
- **Instructions** — Numbered behavioral rules specific to this agent
- **Members / Teams** — (Leads only) The delegation targets available to this agent
- **Expertise** — Template block where Agent Pi injects expertise file contents
- **Skills** — Template block where Agent Pi injects skill file contents

### Tool Distribution

The tool set an agent receives determines their role in the hierarchy.

| Agent | read/grep/find/ls | delegate | edit/write/bash |
|-------|:-----------------:|:--------:|:---------------:|
| Orchestrator | Yes | Yes | No |
| Planning Lead | Yes | Yes | No |
| Engineering Lead | Yes | Yes | No |
| Validation Lead | Yes | Yes | No |
| Product Manager | Yes | No | Yes |
| UX Researcher | Yes | No | Yes |
| Frontend Dev | Yes | No | Yes |
| Backend Dev | Yes | No | Yes |
| QA Engineer | Yes | No | Yes |
| Security Reviewer | Yes | No | No* |

*Security Reviewer has `bash` (for running audit tools) but no `edit` or `write` — they report findings without modifying code.

### Domain Locking

Every agent's `domain` block precisely controls what they can read, create, modify, and delete. This is the enforcement mechanism for separation of concerns.

- **Leaders** get read access to the full codebase (`.` path, read-only) so they can understand context, but cannot write anywhere except their own expertise file and the `.pi/multi-team/` configuration directory.
- **Workers** get full read/write/delete access to their specific directory (e.g., `src/backend/`, `src/frontend/`, `tests/`) plus read-only access to everything else.
- **No agent** can delete from the `.pi/multi-team/` configuration directory. Configuration is append-only.

This means a frontend dev cannot accidentally break backend code. A QA engineer cannot modify production source. The constraints are structural, not just instructional.

---

## Skills

Skills are reusable behavior modules stored as markdown files. Agent Pi injects them into an agent's context at the appropriate moment (as specified by each skill's `use-when` field in the agent's frontmatter).

### Skill Catalog

| Skill | Description |
|-------|-------------|
| `conversational-response` | Keep responses concise, synthesized, and direct. Lead with the answer. Match the user's energy. |
| `mental-model` | Instructions for reading expertise files at task start and updating them after completing work. |
| `active-listener` | Read the full conversation log before every response. Track decisions, avoid redundancy, catch contradictions. |
| `zero-micro-management` | Leaders delegate work to team members. Never execute directly. Write clear delegation prompts. Trust the team. |
| `high-autonomy` | Act decisively without asking the user for clarification on routine decisions. Escalate only when ambiguity is genuinely significant and hard to reverse. |
| `precise-worker` | Show your work (file paths, line numbers). Execute fully — no TODOs or partial implementations. Stay in your domain. |

### Skill Distribution Matrix

| Skill | Orchestrator | Leads | Workers |
|-------|:------------:|:-----:|:-------:|
| conversational-response | Yes | Yes | No |
| mental-model | Yes | Yes | Yes |
| active-listener | Yes | Yes | Yes |
| zero-micro-management | Yes | Yes | No |
| high-autonomy | Yes | No | No |
| precise-worker | No | No | Yes |

The pattern is intentional: leaders get conversational, delegation, and autonomy skills; workers get execution and precision skills. All agents share the memory and listening skills.

---

## Mental Models (Expertise)

Every agent in the system has a personal expertise file — a structured YAML document stored in `.pi/multi-team/expertise/`. These files are the agent's persistent memory across sessions.

### How They Work

**At task start**, the agent reads its expertise file to load prior context: what has been built, what patterns exist, what gotchas have been discovered, what decisions have been made.

**After completing meaningful work**, the agent updates its expertise file to capture new learnings. When approaching the `max-lines` limit (10,000 lines for all agents in this configuration), the agent prunes stale or outdated entries rather than stopping updates.

**The structure emerges from work**, not from a rigid template. The `mental-model` skill encourages agents to let categories form naturally:

```yaml
architecture:
  frontend: "React SPA, component library in src/frontend/components/"
  backend: "Express API, route handlers in src/backend/routes/"
  database: "PostgreSQL, migrations in src/backend/migrations/"

patterns_noticed:
  - "Error handling is inconsistent between routes -- some throw, some return null"

gotchas:
  - "Auth middleware silently fails on expired tokens instead of returning 401"
```

### How They Compound

On day one, all expertise files are empty stubs. After the first session, each agent has some observations. After ten sessions, each agent has a rich, specific model of your codebase that they load before touching any code.

The Orchestrator's mental model tracks team dynamics and delegation patterns — which teams handle what well, where coordination issues emerge. The Engineering Lead's model tracks architecture decisions and technical debt. Backend Dev tracks API patterns and data model conventions. Security Reviewer accumulates a running list of vulnerability patterns and resolved concerns specific to your codebase.

This is the compounding effect: the system becomes progressively more useful the more it works with your code.

---

## Quick Start

### 1. Copy the configuration into your project

```bash
cp -r .pi/ /path/to/your/project/
```

The entire configuration lives in `.pi/multi-team/`. Nothing else is required.

### 2. Customize directory domains

Open each worker agent file and update the `# CUSTOMIZE:` paths to match your project's actual directory layout:

```yaml
# backend-dev.md
domain:
  - path: src/backend/      # CUSTOMIZE: Change to your backend directory (e.g., server/, api/)
    read: true
    upsert: true
    delete: true
```

Workers that need customization: `frontend-dev.md`, `backend-dev.md`, `qa-engineer.md`, `product-manager.md`, `ux-researcher.md`, and `planning-lead.md`.

### 3. Verify or create assumed directories

The default configuration assumes these project directories exist:

| Directory | Used By |
|-----------|---------|
| `src/frontend/` | Frontend Dev (full read/write) |
| `src/backend/` | Backend Dev (full read/write) |
| `tests/` | QA Engineer (full read/write) |
| `docs/` | Frontend Dev, Backend Dev (write documentation) |
| `specs/` | Product Manager, UX Researcher (write planning artifacts) |

Create any that don't exist, or remap the paths in the agent frontmatter.

### 4. Run the onboarding wizard

This repo now includes a project-local Pi extension at `.pi/extensions/onboard.ts`.

Start Pi in this project, then run:

```text
/onboard
```

The wizard will walk you through:
- target project root
- provider selection
- directory mapping for frontend, backend, tests, docs, and specs
- lead and worker model selection
- optional per-agent model overrides
- optional `.env` setup for `ZAI_API_KEY` or `ANTHROPIC_API_KEY`

When you confirm, it will update:
- `.pi/multi-team/multi-team-config.yaml`
- `.pi/multi-team/agents/*.md`

It also creates `.bak` backups before rewriting files.

### 5. Bun development and tests

This repo now includes a small Bun-based development setup for the onboarding system.

Install dependencies:

```bash
bun install
```

Available commands:

```bash
bun test
bun test --watch
bun run typecheck
```

What gets tested right now:
- path normalization
- generated `multi-team-config.yaml`
- agent markdown rewrites
- `.env` content updates

The testable implementation lives in:
- `src/onboarding/`

The Pi runtime wrapper lives in:
- `.pi/extensions/onboard.ts`

### 6. Automatic CI testing

GitHub Actions is configured to run Bun tests automatically on every push and pull request.

Workflow file:

```text
.github/workflows/bun-test.yml
```

It runs:
- `bun install`
- `bun run typecheck`
- `bun test`

### 7. Start Agent Pi with the multi-team config

```bash
agent-pi --config .pi/multi-team/multi-team-config.yaml
```

Refer to Agent Pi's documentation for the exact startup command for your installation.

### 8. Talk to the Orchestrator

The Orchestrator is your only interface. Describe what you want to build, fix, or understand. The Orchestrator classifies your request and routes it to the appropriate team. You do not need to address specific agents or teams directly.

```
You: I want to add rate limiting to the login endpoint.
Orchestrator: [delegates to Engineering Lead]
              [Engineering Lead delegates to Backend Dev]
              [Backend Dev reads auth code, implements, reports back]
              [Engineering Lead synthesizes]
              [Orchestrator responds with implementation summary]
```

---

## Customization Guide

### Remap Directory Domains

Each worker's `domain` block is the authoritative source of their filesystem access. To change a worker's directory:

1. Open the agent file (e.g., `.pi/multi-team/agents/backend-dev.md`)
2. Update the path in the `domain` block
3. Update the path mentioned in the **Purpose** section of the system prompt

### Add or Remove Teams

To add a team:

1. Create a lead agent file and two or more worker agent files in `.pi/multi-team/agents/`
2. Add the team block to `multi-team-config.yaml` under `teams:`
3. Create expertise stubs in `.pi/multi-team/expertise/` for each new agent
4. Reference the appropriate skills in each new agent's frontmatter

To remove a team, delete the agent files, remove the team block from the config, and remove the expertise stubs.

### Add or Remove Workers

To add a worker to an existing team:

1. Create the worker agent file in `.pi/multi-team/agents/`
2. Create an expertise stub in `.pi/multi-team/expertise/`
3. Add the member entry to the team's `members:` list in `multi-team-config.yaml`
4. Specify `consult-when` so the Orchestrator and Lead know when to route work there

To remove a worker, reverse these steps and remove them from the lead's `{{MEMBERS_BLOCK}}` template.

### Change Models

Model assignments are in two places: the `model:` field in each agent's frontmatter, and the `model:` field in `multi-team-config.yaml` for the orchestrator. Update both if they differ.

The current default assignments reflect a cost/intelligence tradeoff:
- Leads and Orchestrator: `glm-5.1` / `claude-opus-4-6` (more capable, used for reasoning and coordination)
- Workers: `glm-5-turbo` / `claude-sonnet-4-6` (fast and cost-efficient, used for execution)

You can use any model from either provider in any position. To switch providers globally, update the `active_provider` field and the `model:` fields accordingly.

### Provider Configuration

The `providers` block in `multi-team-config.yaml` defines available model providers and their tier mappings:

```yaml
providers:
  anthropic:
    opus: anthropic/claude-opus-4-6
    sonnet: anthropic/claude-sonnet-4-6
  zai:
    opus: zai/glm-5.1
    sonnet: zai/glm-5-turbo
active_provider: zai
```

**Tier mapping:**
- `opus` tier → Used by Orchestrator and Team Leads (high reasoning capability)
- `sonnet` tier → Used by Workers (fast execution, cost-efficient)

**To switch to Anthropic:**
1. Set `active_provider: anthropic` in `multi-team-config.yaml`
2. Uncomment the Anthropic model lines and comment out the Zai lines in each agent file
3. Remove or comment out the `api_base` field (Anthropic uses its default endpoint)

**To switch to Z.ai:**
1. Set `active_provider: zai` in `multi-team-config.yaml`
2. Ensure `api_base: https://api.z.ai/api/paas/v4/` is set on the orchestrator config
3. Set the `ZAI_API_KEY` environment variable with your Z.ai API key

**Z.ai API details:**
- General endpoint: `https://api.z.ai/api/paas/v4/`
- Coding endpoint: `https://api.z.ai/api/coding/paas/v4`
- Auth: Bearer token via `Authorization: Bearer <key>`
- Context window: 200K tokens, 128K max output
- OpenAI-compatible API format

### Add New Skills

1. Create a new markdown file in `.pi/multi-team/skills/`
2. Add a YAML frontmatter block with `name` and `description`
3. Write the skill instructions in the body
4. Reference the skill in any agent's `skills:` list in their frontmatter with an appropriate `use-when` instruction

### Add Read-Only Expertise (Domain Knowledge Injection)

Expertise files do not have to be updatable. You can inject static domain knowledge — architecture docs, API references, coding standards — by adding a non-updatable expertise entry:

```yaml
expertise:
  - path: docs/architecture-overview.md
    use-when: "Read when making architecture decisions or reviewing system structure."
    updatable: false
```

This injects the file's content into the agent's context without allowing the agent to modify it.

---

## Configuration Reference

### `multi-team-config.yaml`

```yaml
providers:                       # Available model providers and tier mappings
  anthropic:
    opus: anthropic/claude-opus-4-6
    sonnet: anthropic/claude-sonnet-4-6
  zai:
    opus: zai/glm-5.1
    sonnet: zai/glm-5-turbo
active_provider: zai             # Currently active provider

orchestrator:
  name: Orchestrator          # Display name
  path: ...                   # Path to the orchestrator agent file
  model: zai/glm-5.1          # Model override (if different from agent frontmatter)
  api_base: https://api.z.ai/api/paas/v4/  # API endpoint (Z.ai)

paths:
  agents: .pi/multi-team/agents/      # Where Agent Pi looks for agent files
  sessions: .pi/multi-team/sessions/  # Where session working notes are written
  logs: .pi/multi-team/logs/          # Where conversation logs (JSONL) are stored

shared_context:               # Files loaded into every agent's context at startup
  - README.md
  - CLAUDE.md

teams:
  - team-name: Engineering    # Team identifier used in delegate() calls
    team-color: "#ff6e96"     # UI color for this team (Agent Pi display)
    lead:
      name: Engineering Lead
      path: ...               # Path to the lead agent file
      color: "#ff6e96"
    members:
      - name: Backend Dev
        path: ...             # Path to the worker agent file
        color: "#ff7edb"
        consult-when: ...     # Guidance for when to route work to this member
```

| Field | Required | Description |
|-------|----------|-------------|
| `providers` | No | Available model providers and tier mappings |
| `active_provider` | No | Currently active provider (`anthropic` or `zai`) |
| `orchestrator` | Yes | The top-level coordinator agent |
| `paths` | Yes | Filesystem paths Agent Pi uses for sessions and logs |
| `shared_context` | No | Files loaded into all agents at startup (README, CLAUDE.md, etc.) |
| `teams` | Yes | List of team definitions |
| `team-name` | Yes | Identifier used in `delegate(team, ...)` calls |
| `team-color` | No | Display color for Agent Pi UI |
| `lead` | Yes | The team's coordinating agent |
| `members` | Yes | List of specialist worker agents on this team |
| `consult-when` | Recommended | Natural language hint for routing decisions |

---

## Cost Considerations

Multi-team agentic sessions involve multiple model calls per user request. Here is the general cost profile:

**Orchestrator and Leads use the Opus-tier model** (`glm-5.1` or `claude-opus-4-6`).
Opus-tier models are more capable and more expensive. These agents are used for classification, delegation, synthesis, and architectural judgment — work where model quality matters most. A typical routed request involves one Orchestrator call and one Lead call.

**Workers use the Sonnet-tier model** (`glm-5-turbo` or `claude-sonnet-4-6`).
Sonnet-tier models are faster and significantly less expensive. Workers do the bulk of the token consumption — reading code, writing implementations, running tests — but at lower pricing.

**Mental models add to context.**
Each agent loads its expertise file at task start. As these files grow over sessions, they add tokens to every call. The `max-lines: 10000` limit bounds this growth. Agents are instructed to prune stale entries rather than letting files grow unbounded.

**Session scope determines cost.**
A simple backend question routes to the Orchestrator plus Engineering Lead plus Backend Dev — three calls. A feature that spans planning, implementation, and validation involves all three teams, meaning six to seven model calls. Complex cross-team work costs proportionally more.

**Typical range:** For day-to-day feature work touching one team, expect costs comparable to two to three Sonnet calls plus one Opus call per user turn.

---

## Development Workflow

### Setup

Install dependencies:

```bash
bun install
```

Install or refresh the local git hooks:

```bash
bun run hooks:install
```

### Daily Commands

```bash
bun test
bun test --watch
bun run typecheck
```

### Project Structure

- `src/onboarding/` — testable onboarding core logic
- `.pi/extensions/onboard.ts` — Pi runtime command wrapper for `/onboard`
- `tests/` — Bun unit tests
- `.github/workflows/bun-test.yml` — CI workflow for typecheck and tests

### Manual Testing

Start Pi from the project root so the local extension auto-loads, then run:

```text
/onboard
```

Use this for end-to-end interactive testing of the onboarding flow.

### Automatic Checks

Local pre-commit hook runs:
- `bun run typecheck`
- `bun test`

GitHub Actions also runs the same checks on:
- push
- pull request

## Credits

- Inspired by [IndyDevDan](https://github.com/indydevdan)'s multi-team agentic coding system and approach to structured agent delegation
- Built for the [Agent Pi](https://github.com/agentpi) agentic coding harness
- Uses Claude models by [Anthropic](https://anthropic.com) and GLM models by [Z.ai](https://z.ai)
