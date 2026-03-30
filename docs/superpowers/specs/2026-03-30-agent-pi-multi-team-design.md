# Agent Pi Multi-Team Configuration Design

**Date**: 2026-03-30
**Status**: Draft
**Type**: Configuration template for Agent Pi multi-team agentic coding system

---

## Overview

A complete, generic, reusable Agent Pi multi-team configuration implementing a 3-tier agent hierarchy: Orchestrator, Team Leads, and Workers. Designed to be pointed at any codebase with convention-based defaults and clear customization markers.

## Architecture

### 3-Tier Hierarchy

```
User
  └── Orchestrator (Opus)
        ├── Planning Lead (Opus)
        │     ├── Product Manager (Sonnet)
        │     └── UX Researcher (Sonnet)
        ├── Engineering Lead (Opus)
        │     ├── Frontend Dev (Sonnet)
        │     └── Backend Dev (Sonnet)
        └── Validation Lead (Opus)
              ├── QA Engineer (Sonnet)
              └── Security Reviewer (Sonnet)
```

- **Orchestrator**: Routes user requests to the right team, synthesizes output. Only talks to leads.
- **Leads**: Coordinate their team members, delegate specialist work, synthesize member output back to orchestrator.
- **Workers**: Execute tasks -- read code, write code, run tests, review security. Report back to their lead.

### Delegation Flow

1. User talks to Orchestrator
2. Orchestrator classifies request by domain, calls `delegate(team, question)` to a lead
3. Lead receives question, optionally delegates to members via `delegate(member, question)`
4. Members execute and report back to lead
5. Lead synthesizes and reports back to orchestrator
6. Orchestrator synthesizes and responds to user

## Directory Structure

```
.pi/multi-team/
├── multi-team-config.yaml
├── agents/
│   ├── orchestrator.md
│   ├── planning-lead.md
│   ├── product-manager.md
│   ├── ux-researcher.md
│   ├── engineering-lead.md
│   ├── frontend-dev.md
│   ├── backend-dev.md
│   ├── validation-lead.md
│   ├── qa-engineer.md
│   └── security-reviewer.md
├── skills/
│   ├── conversational-response.md
│   ├── mental-model.md
│   ├── active-listener.md
│   ├── zero-micro-management.md
│   ├── high-autonomy.md
│   └── precise-worker.md
├── expertise/
│   ├── orchestrator-mental-model.yaml
│   ├── planning-lead-mental-model.yaml
│   ├── product-manager-mental-model.yaml
│   ├── ux-researcher-mental-model.yaml
│   ├── engineering-lead-mental-model.yaml
│   ├── frontend-dev-mental-model.yaml
│   ├── backend-dev-mental-model.yaml
│   ├── validation-lead-mental-model.yaml
│   ├── qa-engineer-mental-model.yaml
│   └── security-reviewer-mental-model.yaml
├── sessions/
└── logs/
```

## Configuration File

`multi-team-config.yaml` is the master config. It defines:

- **orchestrator**: Name, path to agent file, model
- **paths**: Locations for agents, sessions, logs directories
- **shared_context**: Files loaded into every agent's context (e.g., `README.md`, `CLAUDE.md`)
- **teams**: Array of team definitions, each with:
  - `team-name`: Identifier used in `delegate(team, ...)` calls
  - `team-color`: Hex color for terminal UI
  - `lead`: Name, path to agent file, color
  - `members`: Array of name, path, color, and `consult-when` (describes when to involve this member)

### Teams

| Team | Lead | Members | Color |
|------|------|---------|-------|
| Planning | Planning Lead | Product Manager, UX Researcher | `#fede5d` (yellow) |
| Engineering | Engineering Lead | Frontend Dev, Backend Dev | `#ff6e96` (pink) |
| Validation | Validation Lead | QA Engineer, Security Reviewer | `#9aedfe` (cyan) |

## Agent File Format

Each agent is a `.md` file with YAML frontmatter and a markdown system prompt body.

### Frontmatter Properties

| Property | Description | Orchestrator | Leads | Workers |
|----------|-------------|-------------|-------|---------|
| `name` | Agent identifier | yes | yes | yes |
| `model` | Claude model ID | `anthropic/claude-opus-4-6` | `anthropic/claude-opus-4-6` | `anthropic/claude-sonnet-4-6` |
| `expertise` | Array of mental model file references | yes | yes | yes |
| `expertise[].path` | Path to YAML expertise file | yes | yes | yes |
| `expertise[].use-when` | When to consult this file | yes | yes | yes |
| `expertise[].updatable` | Whether agent can write to it | `true` | `true` | `true` |
| `expertise[].max-lines` | Max lines for the file | `10000` | `10000` | `10000` |
| `skills` | Array of shared skill file references | yes | yes | yes |
| `skills[].path` | Path to skill `.md` file | yes | yes | yes |
| `skills[].use-when` | When to apply this skill | yes | yes | yes |
| `tools` | Available tool names | read, grep, find, ls, **delegate** | read, grep, find, ls, **delegate** | read, grep, find, ls, **edit, write, bash** |
| `domain` | File access permissions array | yes | yes | yes |

### Tool Distribution

- **Orchestrator + Leads**: `read`, `grep`, `find`, `ls`, `delegate` -- they think, coordinate, and delegate. No file mutation.
- **Workers**: `read`, `grep`, `find`, `ls`, `edit`, `write`, `bash` -- they execute. No delegation.

### System Prompt Structure

**Orchestrator**:
1. Purpose -- coordinate the product team
2. Variables -- `{{SESSION_DIR}}`, `{{CONVERSATION_LOG}}` (runtime-injected)
3. Instructions -- route by domain, default one team, sequential delegation, synthesize don't relay
4. Teams -- `{{TEAMS_BLOCK}}` with `delegate(team, question)` documentation
5. Expertise -- `{{EXPERTISE_BLOCK}}`
6. Skills -- `{{SKILLS_BLOCK}}`

**Leads**:
1. Purpose -- role-specific leadership description
2. Variables -- `{{SESSION_DIR}}`, `{{CONVERSATION_LOG}}`
3. Instructions -- role-specific coordination guidance
4. Members -- `{{MEMBERS_BLOCK}}` with `delegate(member, question)` documentation
5. Expertise -- `{{EXPERTISE_BLOCK}}`
6. Skills -- `{{SKILLS_BLOCK}}`

**Workers**:
1. Purpose -- role-specific execution description
2. Variables -- `{{SESSION_DIR}}`, `{{CONVERSATION_LOG}}`
3. Instructions -- role-specific execution guidance, owned directories
4. Expertise -- `{{EXPERTISE_BLOCK}}`
5. Skills -- `{{SKILLS_BLOCK}}`

## Domain Locking

Convention-based defaults assuming a standard project layout. Each agent file includes `# CUSTOMIZE:` comments explaining how to remap paths.

### Assumed Project Layout

```
project-root/
├── src/
│   ├── frontend/
│   └── backend/
├── specs/
├── tests/
├── docs/
└── .pi/multi-team/
```

### Permission Matrix

| Agent | Read | Write |
|-------|------|-------|
| Orchestrator | everything | own expertise only |
| Planning Lead | everything | own expertise only |
| Product Manager | everything | `specs/`, own expertise |
| UX Researcher | everything | `specs/`, own expertise |
| Engineering Lead | everything | own expertise only |
| Frontend Dev | everything | `src/frontend/`, `docs/`, own expertise |
| Backend Dev | everything | `src/backend/`, `docs/`, own expertise |
| Validation Lead | everything | own expertise only |
| QA Engineer | everything | `tests/`, own expertise |
| Security Reviewer | everything | own expertise only |

All agents have `delete: false` everywhere except their own expertise files.

## Skills

Six shared skill files in `.pi/multi-team/skills/`.

### Skill Distribution

| Skill | Orchestrator | Leads | Workers |
|-------|-------------|-------|---------|
| `conversational-response.md` | yes | yes | no |
| `mental-model.md` | yes | yes | yes |
| `active-listener.md` | yes | yes | yes |
| `zero-micro-management.md` | yes | yes | no |
| `high-autonomy.md` | yes | no | no |
| `precise-worker.md` | no | no | yes |

### Skill Descriptions

1. **`conversational-response.md`**: Keep responses concise and conversational. Synthesize team output into direct answers. Use structured formatting only when it aids clarity.

2. **`mental-model.md`**: Instructions for maintaining personal expertise YAML files. When to read (task start, recalling prior context). When to update (after meaningful work, new discoveries). How to structure (organic categories, keep scannable, respect max-lines).

3. **`active-listener.md`**: Read the conversation log before every response. Understand full session context. Track what other agents have said. Avoid redundant work or contradictions.

4. **`zero-micro-management.md`**: Leaders delegate, never execute. Trust team members. Provide clear prompts when delegating. Don't re-do member work.

5. **`high-autonomy.md`**: Act autonomously with zero questions back to the user. Make decisions confidently. Only ask when genuinely ambiguous and high-stakes.

6. **`precise-worker.md`**: Be thorough and detail-oriented. Show work with file paths, line numbers, code snippets. Execute fully with no TODOs or placeholders. Report results clearly to lead.

## Expertise Files

Empty YAML scaffolds with role-appropriate category hints. Each file has:

- A header comment identifying the owning agent
- A note that the file is populated automatically
- Suggested categories as comments (not enforced)

### Category Hints by Agent

| Agent | Suggested Categories |
|-------|---------------------|
| Orchestrator | team_dynamics, delegation_patterns, coordination_notes |
| Planning Lead | project_scope, priorities, stakeholder_decisions |
| Product Manager | requirements, user_stories, acceptance_criteria |
| UX Researcher | user_personas, friction_points, usability_findings |
| Engineering Lead | architecture, technical_debt, risk_patterns |
| Frontend Dev | component_patterns, state_management, ui_decisions |
| Backend Dev | api_patterns, data_models, infrastructure_notes |
| Validation Lead | quality_standards, coverage_gaps, process_notes |
| QA Engineer | test_strategies, regression_areas, flaky_tests |
| Security Reviewer | vulnerability_patterns, auth_concerns, dependency_risks |

## File Count

| Category | Count |
|----------|-------|
| Config | 1 |
| Agents | 10 |
| Skills | 6 |
| Expertise | 10 |
| Directory markers (.gitkeep) | 2 |
| **Total** | **29** |

## Customization Guide

To adapt this template for a specific project:

1. **Remap domains**: Update the `domain` section in each agent's frontmatter to match your project's directory structure. Look for `# CUSTOMIZE:` comments.
2. **Add/remove teams**: Edit `multi-team-config.yaml`. Add a new team block and create corresponding agent + expertise files.
3. **Add/remove workers**: Edit a team's `members` array in the config and create/remove the agent + expertise files.
4. **Change models**: Update the `model` field in any agent's frontmatter.
5. **Add skills**: Create a new `.md` file in `skills/` and reference it in the relevant agents' `skills` array.
6. **Add read-only expertise**: Add a second entry to an agent's `expertise` array with `updatable: false` for domain knowledge you want to inject but not let the agent modify.
