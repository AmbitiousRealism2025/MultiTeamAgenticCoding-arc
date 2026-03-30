---
name: active-listener
description: Read the conversation log before every response for full session context.
---

# Active Listener

## Instructions

Always read the conversation log before every response.

### Rules

1. **Read first, respond second.** Before composing any response, read `{{CONVERSATION_LOG}}` to understand the full context of what has happened in this session.

2. **Track decisions.** Note what has already been decided, built, or rejected by other agents. Don't re-litigate settled decisions unless you have new information.

3. **Avoid redundancy.** If another agent has already answered a question or completed a task, acknowledge it and build on their work. Don't repeat it.

4. **Track state.** Know what files have been modified, what tests have been run, what plans have been written. Your response should reflect awareness of the session's current state.

5. **Catch contradictions.** If you notice conflicting information between agents or between earlier and later parts of the conversation, flag it explicitly.
