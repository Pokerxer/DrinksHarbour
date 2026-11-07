---
name: junie
description: Prepare or troubleshoot JetBrains Junie CLI and IDE workflows for a Paperclip issue, including project guidelines, shared skills, and explicitly authorized Junie runs.
---

Use the bundled Paperclip skill for issue ownership and handoff. Identify whether the issue asks for a Junie configuration change, a handoff to someone using Junie, or a Junie run.

- Resolve the issue's repository workspace before checking Junie configuration. Inspect root `AGENTS.md` and `.junie/AGENTS.md` if present. Junie prioritizes the latter, so preserve repository-specific rules when adapting guidelines.
- For skill discovery, check `.junie/skills/<name>/SKILL.md` and `.agents/skills/<name>/SKILL.md`. An existing folder can be supplied explicitly using `--skill-location <path>`. Verify discovery through Junie's `/skills` interface when available. A Paperclip company skill assignment alone does not establish Junie discovery.
- For a handoff, supply the workspace, issue scope, acceptance criteria, and verification commands. Include only the issue context required for the work.
- When a Junie run is expressly requested and permitted, check `command -v junie` and `junie --help` from the intended execution environment. Use existing configured credentials and keep them out of prompts and logs. Before a headless run, inspect the project-scoped Junie configuration because that mode loads it without an interactive trust prompt. If Junie is unavailable, report the missing prerequisite. Review the resulting changes and run the issue's verification checks before reporting completion.

References: [Junie agent skills](https://junie.jetbrains.com/docs/agent-skills.html), [guidelines](https://junie.jetbrains.com/docs/guidelines-and-memory.html), [headless mode](https://junie.jetbrains.com/docs/junie-headless.html).
