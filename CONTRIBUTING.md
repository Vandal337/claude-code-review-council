# Contributing

Issues and PRs are welcome.

## Scope

This plugin is intentionally generic — it should work against any repository's own conventions, not assume a particular organization, architecture, or governance framework. Contributions that hardcode assumptions specific to one company, product, or team should go in a fork or a repo-local `.claude/` copy instead.

## Adding or changing a specialist agent

- Keep the tool grant to `Read`, `Grep`, `Glob` unless there's a specific, justified reason a specialist needs more (and if so, open an issue to discuss first — the read-only posture is deliberate).
- Each specialist should own one clearly bounded concern. If you find yourself writing "and also check for X" where X belongs to another specialist's lane, it probably does.
- Update `SEVERITY_MODEL.md` and `FALSE_POSITIVE_RULES.md` if your change introduces a new calibration rule, rather than burying the rule only inside the agent file — the orchestrator and other specialists need to see it too.

## Testing changes

There's no automated eval suite in v0.1.0. Before opening a PR:

1. Run `claude plugin validate . --strict` and confirm it passes.
2. Load the plugin locally (`claude --plugin-dir .`) and run `/review-council:review-council working-tree` against a repo with a small, known set of issues.
3. Confirm the specialist(s) you changed still produce findings with real file/line citations, and that severity/consolidation behave as documented.

If you're changing trust-boundary or severity-calibration behavior, include a short before/after example in the PR description showing what changed and why.

## Style

- Agent and skill files are documentation for another Claude instance, not for humans reading source code. Write instructions, not narrative.
- Keep `SKILL.md` focused on orchestration; put anything that reads as a shared rule (not specific to one step) in the relevant reference doc instead.
