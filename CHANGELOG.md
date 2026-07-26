# Changelog

## 0.1.1

Two rounds of fixes land in this version together — neither shipped as its own bumped version at the time, so both are recorded here rather than implied to have shipped under 0.1.0.

**From a live self-review run** (the actual six specialist prompts, run against this repo's own initial commit):
- Removed `Bash(gh pr comment:*)` from `SKILL.md`'s `allowed-tools` — it was pre-authorizing exactly the action four other documents promised always requires a permission prompt (found independently by 3 of 6 specialists).
- Added `OUTPUT_SCHEMA.md` to the orchestrator's actual dispatch instruction (it was in the intro list but dropped from the operational step).
- Added a `Severity` field to the four agent Output specs that lacked one, and replaced `interface-reviewer.md`'s ad hoc two-tier scheme with a pointer to `SEVERITY_MODEL.md`'s five tiers.
- Baked a short trust-boundary pointer into the four specialist files that previously relied solely on the orchestrator relaying `TRUST_MODEL.md` at dispatch time.
- Trimmed `security-reviewer.md`'s inline restatement of two `SEVERITY_MODEL.md` calibration rules down to a pointer.

**From an external review, verified against Claude Code's own documentation before implementing** (see `TRUST_MODEL.md` and `SKILL.md` step 2 for what changed):
- **Blocking fix**: added a hard precondition before specialist dispatch. Claude Code auto-injects the current checkout's `CLAUDE.md`/`AGENTS.md` hierarchy into every custom subagent with no per-agent opt-out — confirmed against the platform docs, not assumed. A malicious branch's edited policy file would previously reach every specialist as trusted context before any prompt-based trust rule applied. The orchestrator now diffs governance files against the base revision before dispatching anything, and refuses (`REVIEW_BLOCKED`) if they differ, and passes the base revision's actual policy text — not just its SHA — to every specialist.
- Redefined `working-tree` scope precisely (the previous "committed-but-unpushed changes against HEAD" was self-contradictory) using `@{upstream}` resolution.
- Aligned the orchestrator's severity-reconciliation rule with `SEVERITY_MODEL.md`'s own stated "lowest tier the evidence supports" principle — it previously defaulted to the higher tier on disagreement, which no longer happens silently.
- Added a `Verdict` enum (`PASS`/`PASS_WITH_FINDINGS`/`CHANGES_REQUIRED`/`INSUFFICIENT_EVIDENCE`/`REVIEW_BLOCKED`) to `OUTPUT_SCHEMA.md`.
- Added a read-only check-discovery step (CI config + `gh pr checks`) — deliberately *not* test/build execution, since running a reviewed branch's scripts is a materially different and riskier capability than reading it.
- `FALSE_POSITIVE_RULES.md` no longer assumes CI exists; excluding a lint/type issue now requires confirming the check is actually configured.
- Fixed the GitHub-comment posting flow: no more promising to "link the full report" with no mechanism to do so — now uses a collapsed `<details>` block in the comment itself, plus a head-SHA marker so re-running doesn't post duplicate reviews.
- README install instructions now show the unambiguous `plugin@marketplace` form and `/reload-plugins`, without implying the bare form (which is also valid) was wrong.
- Removed the duplicate `version` field from `marketplace.json`'s plugin entry — `plugin.json` is authoritative when both are set, per platform docs, so keeping both risked exactly the stale-version confusion the docs warn about.

## 0.1.0 — Initial release

- Six-specialist review architecture: correctness, security, policy/trust-boundary, test-evidence, architecture, interface.
- Shared reference docs: `TRUST_MODEL.md`, `SEVERITY_MODEL.md`, `FALSE_POSITIVE_RULES.md`, `OUTPUT_SCHEMA.md`.
- Orchestrator (`review-council` skill) runs inline and dispatches specialists in parallel via first-level `Agent` calls.
- Specialist agents restricted to `Read`, `Grep`, `Glob`.
- Scope support: `working-tree`, `diff <base>..<head>`, `pr <number>`, `commit <sha>`; `--tracked-only` and `--post-comment` flags.
- GitHub PR commenting gated behind the standard tool permission prompt.
- Not yet run through a full adversarial pressure-test pass; manifests and frontmatter validated, live plugin discovery/dispatch not yet verified in a real session.
