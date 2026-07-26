# Review Council

A Claude Code plugin that runs six independent, read-only specialist reviewers — correctness, security, policy/trust-boundary, test-evidence, architecture, and interface — against a working tree, git diff, or GitHub pull request, then aggregates their findings into one report.

## Why six specialists instead of one general review

A single reviewer prompt has to hold correctness, security, architecture, and process concerns in its head at once, and in practice trades depth in each for breadth across all of them. Splitting into narrow specialists — each with one job, one set of calibration rules, and no other distractions — gets deeper, more consistent findings per category, at the cost of more tokens spent per review. Findings are then deduplicated by root cause before being shown to you, so splitting the work doesn't mean splitting the noise.

## What's included

- **`review-council` skill** (`skills/review-council/SKILL.md`) — the orchestrator. Manually invoked only; it does not trigger itself automatically.
- **Six specialist agents** (`agents/`) — `correctness-reviewer`, `security-reviewer`, `policy-boundary-reviewer`, `test-evidence-reviewer`, `architecture-reviewer`, `interface-reviewer`. Each is read-only (`Read`, `Grep`, `Glob` only).
- **Reference docs** the orchestrator and every specialist share:
  - `TRUST_MODEL.md` — base-revision policy is trusted; anything the reviewed branch introduces or modifies (including edits to policy files themselves, and any prompt-injection attempts embedded in code/comments/commit messages) is not.
  - `SEVERITY_MODEL.md` — shared severity tiers, plus two calibration rules learned from running this in practice: direct credential disclosure always outranks speculative hardening suggestions, and constant-time-comparison findings need a realistic exploitation path before they're rated High or above.
  - `FALSE_POSITIVE_RULES.md` — what gets excluded (pre-existing issues, lint/typecheck-catchable issues, pedantic nitpicks) and how duplicate findings across specialists get consolidated by root cause rather than reported N times.
  - `OUTPUT_SCHEMA.md` — the report structure, per-finding fields, and the closed five-value enum (`PASS`/`FAIL`/`NOT_RUN`/`UNAVAILABLE`/`ENVIRONMENT_BLOCKED`) used for any deterministic check status.

## Install

As a plugin, from this repo:

```
/plugin marketplace add Vandal337/claude-code-review-council
/plugin install review-council@review-council-marketplace
/reload-plugins
```

The unqualified `/plugin install review-council` also works (Claude Code accepts a bare plugin name or a `name@marketplace` pair) — the qualified form above is just unambiguous if you ever have another marketplace with a same-named plugin installed too. `/reload-plugins` picks up the newly installed agents/skill in a session that was already running when you installed; skip it if you're starting a fresh session.

Or copy the contents of this repo into a project's `.claude/` directory to use it without installing as a plugin.

## Usage

As an installed plugin:

```
/review-council:review-council working-tree --tracked-only
/review-council:review-council diff main..feature-branch
/review-council:review-council pr 142 --post-comment
/review-council:review-council commit a1b2c3d
```

Copied into a repo's `.claude/`:

```
/review-council working-tree --tracked-only
```

With no arguments, scope defaults to `working-tree`.

## Design notes

- The orchestrator runs inline in the main conversation (not as a subagent), so it can dispatch the six specialists as first-level `Agent` calls without nested-spawn restrictions.
- GitHub commenting (`--post-comment`) always goes through the normal tool-permission prompt — the skill never grants itself standing authorization to post (this used to be contradicted by an overly-broad `allowed-tools` grant; fixed in v0.1.1).
- Large untracked working trees are never silently trimmed; if `--tracked-only` isn't passed and there's a large untracked set, the skill reports the count and asks rather than quietly reducing scope.
- **Checkout-safety precondition**: Claude Code auto-injects the current checkout's `CLAUDE.md`/`AGENTS.md` hierarchy into every custom subagent's context, with no per-agent opt-out. Before dispatching any specialist, the orchestrator diffs governance files (`CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.claude/`, `.github/workflows/`) between the current checkout and the resolved base revision; if they differ, it refuses to dispatch and reports `REVIEW_BLOCKED` instead of letting a malicious branch's edited policy file reach every specialist as if it were trusted instruction context. See `skills/review-council/TRUST_MODEL.md` and `SKILL.md` step 2.

## Before you rely on this in your own repo

The manifests parse and the YAML frontmatter is valid, `claude plugin validate --strict` passes, and this repository has itself been reviewed by its own specialist prompts (see `CHANGELOG.md`) — but it still has not been run through a full adversarial pressure-test pass (deliberately trying to get a specialist to violate the trust boundary, misclassify severity, or over-report duplicates) — see `superpowers:writing-skills` methodology if you want to extend this. Treat v0.1.1 as a solid, self-reviewed starting point, not a battle-tested one. Run it against a real PR in a low-stakes repo first and read its output critically before trusting it on anything sensitive.

## License

MIT — see `LICENSE`.
