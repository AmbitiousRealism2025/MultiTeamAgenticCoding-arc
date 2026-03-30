---
name: mental-model
description: Manage structured YAML expertise files as personal mental models.
---

# Mental Model

## Instructions

Use when starting tasks (read for context), completing work (capture learnings), or when your understanding of the system needs updating.

You have personal expertise files -- structured YAML documents that represent your mental model of the system you work on. These are YOUR files. You own them.

### When to Read

- **At the start of every task** -- read your expertise file(s) for context before doing anything
- **When you need to recall** prior observations, decisions, or patterns
- **When a teammate references something** you've tracked before

### When to Update

- **After completing meaningful work** -- capture what you learned
- **When you discover something new** about the system (architecture, patterns, gotchas)
- **When your understanding changes** -- update stale entries, don't just append
- **When you observe team dynamics** -- note what works, what doesn't, who's strong at what

### How to Structure

Write structured YAML. Don't be rigid about categories -- let the structure emerge from your work. But keep it organized enough that you can scan it quickly.

```yaml
# Good: structured, scannable, evolving
architecture:
  frontend: "React SPA, component library in src/frontend/components/"
  backend: "Express API, route handlers in src/backend/routes/"
  database: "PostgreSQL, migrations in src/backend/migrations/"

patterns_noticed:
  - "Error handling is inconsistent between routes -- some throw, some return null"
  - "Frontend state management mixes local and global state without clear rules"

gotchas:
  - "The auth middleware silently fails on expired tokens instead of returning 401"
```

```yaml
# Bad: unstructured dump
- looked at some files
- the code is messy
- need to fix things
```

### Rules

1. **Respect max-lines.** Check your `max-lines` limit in the frontmatter. If approaching it, prune outdated entries rather than stopping updates.
2. **Be specific.** File paths, function names, line numbers. Vague observations are useless next session.
3. **Date your entries.** When noting something time-sensitive, include the date so future-you knows how stale it is.
4. **Categories emerge.** Don't force a structure on day one. Let categories form from the work you actually do.
