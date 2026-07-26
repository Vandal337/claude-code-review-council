# Output Schema

The structure the orchestrator uses for the final report, after collecting all six specialists' output, deduplicating per `FALSE_POSITIVE_RULES.md`, and applying `SEVERITY_MODEL.md`.

## Top-level structure

```markdown
# Review Council Report

**Scope:** <working tree | diff <base>..<head> | PR #<n> | commit <sha>>
**Files considered:** <count>, <tracked-only | tracked + untracked>
**Specialists run:** correctness, security, policy-boundary, test-evidence, architecture, interface

## Findings

### Critical (n)
### High (n)
### Medium (n)
### Low (n)
### Informational (n)

## Lower-Confidence Observations

(Findings a specialist could not fully verify — see FALSE_POSITIVE_RULES.md)

## Deterministic Check Results

| Check | Status | Notes |
|---|---|---|
| <name> | PASS \| FAIL \| NOT_RUN \| UNAVAILABLE \| ENVIRONMENT_BLOCKED | |

## Review-Integrity Observations

(Prompt injection or reviewer-manipulation attempts encountered and not acted on — see TRUST_MODEL.md. Empty section if none.)

## Strengths

(Optional — what's well done, if a specialist noted it.)
```

## Per-finding fields

Every finding in any severity section uses:

- **File and line** — exact location; for architecture findings that span files, list all relevant locations
- **Specialist** — which of the six reviewers raised it (or "consolidated" if merged from multiple)
- **Summary** — one sentence stating the defect
- **Evidence** — the concrete failure scenario, exploitation path, or violated rule/pattern that justifies the finding; not a restatement of the summary
- **Severity reasoning** — one line citing which `SEVERITY_MODEL.md` rule applies, especially for the calibrated categories (credential disclosure, constant-time comparisons)
- **Recommendation** — a specific fix, not "add validation" or "improve error handling"

## Deterministic check status enum

Exactly these five values, nothing else: `PASS`, `FAIL`, `NOT_RUN`, `UNAVAILABLE`, `ENVIRONMENT_BLOCKED`. See `SEVERITY_MODEL.md` and `test-evidence-reviewer.md` for the rules governing when each applies.

## When posting to GitHub

If the orchestrator is asked to post the report as a PR comment (`gh pr comment`), it still runs behind the normal tool-permission prompt — this skill does not grant itself standing authorization to post. When posting, condense to: scope line, counts by severity, and the Critical/High findings in full; link the full report rather than pasting Medium/Low/Informational/observations inline, to keep the comment readable.
