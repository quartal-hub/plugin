// Deletes local branches whose remote counterpart is gone, i.e. branches GitHub deleted after
// merging their pull request (the repository has "Automatically delete head branches" enabled).
//
// This repository merges by squash only. A squash merge creates a new commit on main, so a merged
// branch's own commits never become ancestors of main: `git branch --merged` reports nothing and
// `git branch -d` refuses every merged branch as "not fully merged". The upstream-gone marker is
// the usable signal instead, and deletion therefore has to be `-D`.
//
// Because -D also force-deletes a branch that was pushed and deleted *without* being merged, every
// deletion prints its commit sha. `git branch <name> <sha>` restores it.
//
// Run with --dry-run to list without deleting.

import { execFileSync } from "node:child_process";

const dryRun = process.argv.includes("--dry-run");

/** Branches never deleted, whatever their upstream state. */
const PROTECTED = new Set(["main"]);

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

// Prune first: the upstream-gone marker only appears once stale remote-tracking refs are dropped.
console.log("Fetching and pruning remote-tracking refs...");
execFileSync("git", ["fetch", "--prune"], { stdio: "inherit" });

const current = git("rev-parse", "--abbrev-ref", "HEAD");

const stale = git("for-each-ref", "--format=%(refname:short)\t%(upstream:track)\t%(objectname:short)", "refs/heads")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [name, track, sha] = line.split("\t");
    return { name, track, sha };
  })
  .filter(({ track }) => track === "[gone]")
  .filter(({ name }) => !PROTECTED.has(name) && name !== current);

if (stale.length === 0) {
  console.log("\nNo local branches with a deleted remote. Nothing to clean up.");
  process.exit(0);
}

console.log(`\n${stale.length} local branch(es) whose remote is gone:\n`);
for (const { name, sha } of stale) {
  console.log(`  ${name.padEnd(44)} ${sha}`);
}

if (dryRun) {
  console.log("\n--dry-run: nothing deleted.");
  process.exit(0);
}

console.log("");
for (const { name, sha } of stale) {
  git("branch", "-D", name);
  console.log(`  deleted ${name.padEnd(44)} restore with: git branch ${name} ${sha}`);
}

console.log(`\nDeleted ${stale.length} branch(es).`);
