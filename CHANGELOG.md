# Changelog

## 0.1.0 — Initial release

- Six-specialist review architecture: correctness, security, policy/trust-boundary, test-evidence, architecture, interface.
- Shared reference docs: `TRUST_MODEL.md`, `SEVERITY_MODEL.md`, `FALSE_POSITIVE_RULES.md`, `OUTPUT_SCHEMA.md`.
- Orchestrator (`review-council` skill) runs inline and dispatches specialists in parallel via first-level `Agent` calls.
- Specialist agents restricted to `Read`, `Grep`, `Glob`.
- Scope support: `working-tree`, `diff <base>..<head>`, `pr <number>`, `commit <sha>`; `--tracked-only` and `--post-comment` flags.
- GitHub PR commenting gated behind the standard tool permission prompt.
- Not yet run through a full adversarial pressure-test pass; manifests and frontmatter validated, live plugin discovery/dispatch not yet verified in a real session.
