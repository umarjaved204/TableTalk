// Copy the published files from the `data` branch into web/.data/ for the build.
//
// Read-only: it runs `git fetch origin data` (which only updates the local
// remote-tracking ref `origin/data`) and then reads files out of that ref with
// `git cat-file`. It never checks out, commits to or pushes the `data` branch.
//
// Usage: npm run data            fetch, then copy
//        npm run data -- --offline   copy from the origin/data ref already on this machine
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(WEB, "..");
const OUT = join(WEB, ".data");
const REF = "origin/data";

// Files the contract describes. pending.json and meta.json are pipeline working
// files, not part of the contract, so the site never sees them.
const INCLUDE = /^(latest|history|track_record)\//;
const EXCLUDE = new Set(["track_record/pending.json", "track_record/meta.json"]);

function git(...args) {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

/** Read many files from git in one process: `git cat-file --batch` answers
 *  "<sha> blob <size>\n<content>\n" for each "<ref>:<path>" line we send. */
function readBlobs(paths) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", ["cat-file", "--batch"], { cwd: REPO });
    const files = new Map();
    let buffer = Buffer.alloc(0);
    let index = 0;
    child.stdout.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const newline = buffer.indexOf(0x0a);
        if (newline === -1) return;
        const header = buffer.subarray(0, newline).toString("utf8");
        const [, type, sizeText] = header.split(" ");
        if (type !== "blob") return reject(new Error(`git cat-file: unexpected answer "${header}"`));
        const size = Number(sizeText);
        if (buffer.length < newline + 1 + size + 1) return; // wait for the rest of this file
        files.set(paths[index++], buffer.subarray(newline + 1, newline + 1 + size));
        buffer = buffer.subarray(newline + 1 + size + 1);
      }
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 && index === paths.length
        ? resolvePromise(files)
        : reject(new Error(`git cat-file stopped after ${index} of ${paths.length} files (exit ${code})`)),
    );
    child.stdin.end(paths.map((p) => `${REF}:${p}\n`).join(""));
  });
}

if (!process.argv.includes("--offline")) {
  console.log(`Fetching ${REF} (read-only) ...`);
  git("fetch", "--quiet", "origin", "data");
}

const commit = git("rev-parse", REF);
const paths = git("ls-tree", "-r", "--name-only", REF)
  .split("\n")
  .filter((p) => INCLUDE.test(p) && !EXCLUDE.has(p));

const files = await readBlobs(paths);
rmSync(OUT, { recursive: true, force: true });
for (const [path, content] of files) {
  const target = join(OUT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
writeFileSync(
  join(OUT, "SOURCE.json"),
  JSON.stringify({ branch: "data", commit, copied_at: new Date().toISOString() }, null, 2) + "\n",
);
console.log(`Copied ${files.size} files from ${REF} at ${commit.slice(0, 7)} into web/.data/`);
