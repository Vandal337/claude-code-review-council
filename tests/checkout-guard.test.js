#!/usr/bin/env node
'use strict';

/*
 * Regression suite for scripts/checkout-guard.js. Node's built-in test runner
 * only - no external dependency, matching the hook script itself.
 *
 * Run with: node --test tests/checkout-guard.test.js
 *
 * Each test builds a throwaway git repository (a bare "origin" plus a clone,
 * so origin/HEAD resolves the way it would for a real cloned project), then
 * invokes the actual hook script as a child process with simulated PreToolUse
 * stdin JSON - the same shape Claude Code documents sending - and asserts on
 * its stdout/exit code. This exercises the real script, not a reimplementation
 * of its logic.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOOK_PATH = path.join(__dirname, '..', 'scripts', 'checkout-guard.js');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-council-guard-test-'));
  const originDir = path.join(root, 'origin.git');
  const workDir = path.join(root, 'work');

  git(root, ['init', '-q', '--bare', originDir]);
  git(root, ['clone', '-q', originDir, workDir]);
  git(workDir, ['config', 'user.email', 'test@example.invalid']);
  git(workDir, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(workDir, 'CLAUDE.md'), '# trusted policy\n');
  git(workDir, ['add', 'CLAUDE.md']);
  git(workDir, ['commit', '-q', '-m', 'init']);
  git(workDir, ['branch', '-M', 'main']);
  git(workDir, ['push', '-q', 'origin', 'main']);
  git(workDir, ['remote', 'set-head', 'origin', 'main']);

  return { root, workDir };
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 });
}

function runHook({ agentId = 'review-council:correctness-reviewer', toolName = 'Agent', cwd, env = {} }) {
  const input = JSON.stringify({
    tool_name: toolName,
    tool_input: agentId === null ? {} : { subagent_type: agentId },
    cwd,
  });

  try {
    const stdout = execFileSync('node', [HOOK_PATH], {
      input,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return { exitCode: 0, stdout: stdout.trim() };
  } catch (e) {
    // Should not happen - the hook always exits 0 by design - but surface it clearly if it does.
    return { exitCode: e.status, stdout: (e.stdout || '').toString().trim(), stderr: (e.stderr || '').toString() };
  }
}

function assertAllow(result) {
  assert.equal(result.exitCode, 0, `expected exit 0, got ${result.exitCode}`);
  assert.equal(result.stdout, '', `expected no output (allow), got: ${result.stdout}`);
}

function assertDeny(result, mustContain) {
  assert.equal(result.exitCode, 0, `expected exit 0, got ${result.exitCode}`);
  assert.notEqual(result.stdout, '', 'expected deny JSON output, got nothing');
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  if (mustContain) {
    assert.match(parsed.hookSpecificOutput.permissionDecisionReason, mustContain);
  }
}

test('01 clean checkout allows', () => {
  const { root, workDir } = makeRepo();
  try {
    assertAllow(runHook({ cwd: workDir }));
  } finally {
    cleanup(root);
  }
});

test('02 tracked root CLAUDE.md change denies', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.appendFileSync(path.join(workDir, 'CLAUDE.md'), '# tampered\n');
    git(workDir, ['add', 'CLAUDE.md']);
    git(workDir, ['commit', '-q', '-m', 'tamper']);
    assertDeny(runHook({ cwd: workDir }), /CLAUDE\.md/);
  } finally {
    cleanup(root);
  }
});

test('03 untracked root CLAUDE.local.md denies', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.writeFileSync(path.join(workDir, 'CLAUDE.local.md'), 'malicious\n');
    assertDeny(runHook({ cwd: workDir }), /CLAUDE\.local\.md/);
  } finally {
    cleanup(root);
  }
});

test('04 committed nested CLAUDE.md denies', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.mkdirSync(path.join(workDir, 'src', 'module'), { recursive: true });
    fs.writeFileSync(path.join(workDir, 'src', 'module', 'CLAUDE.md'), '# nested\n');
    git(workDir, ['add', 'src/module/CLAUDE.md']);
    git(workDir, ['commit', '-q', '-m', 'nested']);
    assertDeny(runHook({ cwd: workDir }), /src[\\/]module[\\/]CLAUDE\.md/);
  } finally {
    cleanup(root);
  }
});

test('05 untracked nested AGENTS.md denies', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.mkdirSync(path.join(workDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workDir, 'src', 'AGENTS.md'), 'malicious\n');
    assertDeny(runHook({ cwd: workDir }), /src[\\/]AGENTS\.md/);
  } finally {
    cleanup(root);
  }
});

test('06 changed .claude/rules file denies', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.mkdirSync(path.join(workDir, '.claude', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(workDir, '.claude', 'rules', 'x.md'), 'malicious rule\n');
    assertDeny(runHook({ cwd: workDir }), /\.claude[\\/]rules[\\/]x\.md/);
  } finally {
    cleanup(root);
  }
});

test('07 invocation from a subdirectory denies (root file tampered)', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.appendFileSync(path.join(workDir, 'CLAUDE.md'), '# tampered\n');
    git(workDir, ['add', 'CLAUDE.md']);
    git(workDir, ['commit', '-q', '-m', 'tamper']);
    const subDir = path.join(workDir, 'src');
    fs.mkdirSync(subDir, { recursive: true });
    assertDeny(runHook({ cwd: subDir }), /CLAUDE\.md/);
  } finally {
    cleanup(root);
  }
});

test('08 unrelated agent allows', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.appendFileSync(path.join(workDir, 'CLAUDE.md'), '# tampered\n');
    git(workDir, ['add', 'CLAUDE.md']);
    git(workDir, ['commit', '-q', '-m', 'tamper']);
    assertAllow(runHook({ cwd: workDir, agentId: 'general-purpose' }));
  } finally {
    cleanup(root);
  }
});

test('09 unrelated tool allows', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.appendFileSync(path.join(workDir, 'CLAUDE.md'), '# tampered\n');
    git(workDir, ['add', 'CLAUDE.md']);
    git(workDir, ['commit', '-q', '-m', 'tamper']);
    const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: workDir });
    const stdout = execFileSync('node', [HOOK_PATH], { input, encoding: 'utf8' }).trim();
    assert.equal(stdout, '');
  } finally {
    cleanup(root);
  }
});

test('10 unresolved trusted reference denies (fail-closed)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-council-guard-test-'));
  try {
    const noOriginDir = path.join(root, 'no-origin');
    fs.mkdirSync(noOriginDir);
    git(noOriginDir, ['init', '-q']);
    git(noOriginDir, ['config', 'user.email', 'test@example.invalid']);
    git(noOriginDir, ['config', 'user.name', 'test']);
    fs.writeFileSync(path.join(noOriginDir, 'f.txt'), 'x\n');
    git(noOriginDir, ['add', 'f.txt']);
    git(noOriginDir, ['commit', '-q', '-m', 'init']);
    assertDeny(runHook({ cwd: noOriginDir }), /could not resolve/);
  } finally {
    cleanup(root);
  }
});

test('11 deliberate environment bypass allows', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.appendFileSync(path.join(workDir, 'CLAUDE.md'), '# tampered\n');
    git(workDir, ['add', 'CLAUDE.md']);
    git(workDir, ['commit', '-q', '-m', 'tamper']);
    assertAllow(runHook({ cwd: workDir, env: { REVIEW_COUNCIL_ALLOW_UNTRUSTED_CHECKOUT: '1' } }));
  } finally {
    cleanup(root);
  }
});

test('bonus: bare project-local agent name (no plugin prefix) is still recognized', () => {
  const { root, workDir } = makeRepo();
  try {
    fs.appendFileSync(path.join(workDir, 'CLAUDE.md'), '# tampered\n');
    git(workDir, ['add', 'CLAUDE.md']);
    git(workDir, ['commit', '-q', '-m', 'tamper']);
    assertDeny(runHook({ cwd: workDir, agentId: 'security-reviewer' }), /CLAUDE\.md/);
  } finally {
    cleanup(root);
  }
});
