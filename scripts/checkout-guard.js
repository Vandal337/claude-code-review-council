#!/usr/bin/env node
'use strict';

/*
 * PreToolUse hook for the "Agent" tool. Deterministic, independent backstop for
 * SKILL.md step 2's behavioral checkout-safety check: blocks dispatch of any
 * review-council specialist when the current checkout's governance files
 * (CLAUDE.md, AGENTS.md, etc.) differ from the repository's own default branch,
 * since Claude Code auto-injects those files into every custom subagent's
 * context with no per-agent opt-out. See skills/review-council/TRUST_MODEL.md.
 *
 * This script must not trust anything the orchestrator session tells it about
 * which base revision is "correct" - the orchestrator may itself be running
 * inside an already-compromised context, which is exactly the scenario this
 * hook exists to catch independently of. It derives its own trusted reference
 * (the git remote's default branch) instead.
 *
 * Never call process.exit() after writing to stdout here - on some platforms
 * that can truncate a pipe write before it flushes. Set process.exitCode and
 * let the event loop drain naturally instead.
 */

const fs = require('fs');
const { execFileSync } = require('child_process');

const GOVERNANCE_PATHS = [
  'CLAUDE.md',
  'CLAUDE.local.md',
  'AGENTS.md',
  '.claude',
  '.github/workflows',
];

const AGENT_NAME_FIELDS = ['subagent_type', 'agent_type', 'agent_name', 'name'];

function readStdin() {
  const chunks = [];
  const buf = Buffer.alloc(65536);
  try {
    let bytes;
    while ((bytes = fs.readSync(0, buf, 0, buf.length)) > 0) {
      chunks.push(Buffer.from(buf.subarray(0, bytes)));
    }
  } catch (e) {
    // EAGAIN/EOF on some platforms when stdin is a closed/empty pipe - use what we have
  }
  return Buffer.concat(chunks).toString('utf8');
}

function allow() {
  process.exitCode = 0;
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exitCode = 0; // exit 0 + JSON is how PreToolUse reads a decision; exit 2 would be a different (error) path
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function resolveTrustedRef(cwd) {
  try {
    return git(cwd, ['rev-parse', '--abbrev-ref', 'refs/remotes/origin/HEAD']);
  } catch (e) {
    for (const candidate of ['origin/main', 'origin/master']) {
      try {
        git(cwd, ['rev-parse', '--verify', candidate]);
        return candidate;
      } catch (e2) {
        // try next candidate
      }
    }
  }
  return null;
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin());
  } catch (e) {
    return allow(); // can't parse hook input - nothing to enforce
  }

  if (input.tool_name !== 'Agent') return allow();

  const toolInput = input.tool_input || {};
  let agentId = null;
  for (const field of AGENT_NAME_FIELDS) {
    if (typeof toolInput[field] === 'string') {
      agentId = toolInput[field];
      break;
    }
  }
  if (agentId === null) {
    // Schema field name for the dispatched agent's identifier wasn't one of the
    // expected ones - fall back to scanning the whole tool_input for our namespace
    // rather than silently skipping every call.
    agentId = JSON.stringify(toolInput);
  }
  if (!agentId.includes('review-council:')) return allow(); // not one of our specialists

  if (process.env.REVIEW_COUNCIL_ALLOW_UNTRUSTED_CHECKOUT === '1') {
    process.stderr.write('review-council checkout guard: bypassed via REVIEW_COUNCIL_ALLOW_UNTRUSTED_CHECKOUT=1\n');
    return allow();
  }

  const cwd = input.cwd;
  if (!cwd) return allow();

  const trustedRef = resolveTrustedRef(cwd);
  if (!trustedRef) {
    // No independently-resolvable trusted ref (no origin/HEAD, no origin/main,
    // no origin/master) - this hook has no basis to compare against. Fail open
    // and say so; SKILL.md step 2's behavioral check is the only guard this run.
    process.stderr.write(
      'review-council checkout guard: could not resolve origin/HEAD, origin/main, or origin/master - ' +
      'skipping (no independent trusted ref available for this repository)\n'
    );
    return allow();
  }

  let diffOutput;
  try {
    diffOutput = git(cwd, ['diff', '--name-only', trustedRef, '--', ...GOVERNANCE_PATHS]);
  } catch (e) {
    return allow(); // not a git repo, git unavailable, or trustedRef unreachable - nothing to enforce
  }

  if (diffOutput.length === 0) return allow();

  const changed = diffOutput.split('\n').filter(Boolean);
  return deny(
    `Checkout differs from ${trustedRef} on governance file(s): ${changed.join(', ')}. ` +
    `Review Council refuses to dispatch specialists from this checkout, since Claude Code auto-injects these files into every custom subagent's context with no per-agent opt-out. ` +
    `Review from a clean checkout of the trusted base (e.g. \`git worktree add ../review-base ${trustedRef}\`) or without checking out the branch locally (let gh pr diff / git show fetch reviewed content remotely instead). ` +
    `Set REVIEW_COUNCIL_ALLOW_UNTRUSTED_CHECKOUT=1 to bypass deliberately, e.g. for a repository's own legitimate CLAUDE.md changes on a long-lived feature branch.`
  );
}

main();
