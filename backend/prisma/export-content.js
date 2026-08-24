/* eslint-disable no-console */
'use strict';

/**
 * Snapshots the site's real content out of the frontend and into JSON the
 * seed can read.
 *
 * Why a snapshot rather than importing the frontend modules from the seed
 * directly: `frontend/app` is an ES module package and the backend is
 * CommonJS, so a direct require crosses a module-system boundary that fails in
 * ways that look like missing exports. Compiling the three data files to a
 * throwaway CommonJS build and reading the result is boring and deterministic,
 * and the JSON it produces is committed — so `prisma migrate deploy && db:seed`
 * works on a machine that has never installed the frontend.
 *
 * Re-run with `npm run db:export-content` whenever the WordPress import or the
 * beat list changes. The output is derived data: edit content.ts, not the JSON.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CONTENT_ENTRY = path.resolve(
  __dirname,
  '../../frontend/app/src/data/content.ts',
);
const OUT_FILE = path.resolve(__dirname, 'seed-data/content.json');

function fail(message, cause) {
  console.error(`\n  x ${message}`);
  if (cause) console.error(`    ${cause instanceof Error ? cause.message : String(cause)}`);
  console.error('');
  process.exit(1);
}

function main() {
  if (!fs.existsSync(CONTENT_ENTRY)) {
    fail(
      `Cannot find the frontend content at ${CONTENT_ENTRY}.`,
      'This script only runs in a full checkout. The committed ' +
        'prisma/seed-data/content.json is what the seed actually reads, so ' +
        'seeding still works without it.',
    );
  }

  // Resolve the compiler itself and run it on this Node binary. Going through
  // `npx` would mean spawning a shell wrapper, which on Windows is a .cmd that
  // execFileSync refuses with EINVAL — and resolving the module is exact
  // anyway, rather than trusting whatever tsc happens to be on PATH.
  let tsc;
  try {
    tsc = path.join(path.dirname(require.resolve('typescript')), 'tsc.js');
  } catch (cause) {
    fail('TypeScript is not installed. Run `npm install` in backend/ first.', cause);
  }

  const build = fs.mkdtempSync(path.join(os.tmpdir(), 'vibevic-content-'));

  try {
    // Explicit --module commonjs: without it tsc reads the frontend's
    // package.json "type": "module" and emits ESM this script cannot require.
    execFileSync(
      process.execPath,
      [
        tsc,
        CONTENT_ENTRY,
        '--outDir', build,
        '--module', 'commonjs',
        '--target', 'ES2022',
        '--moduleResolution', 'node',
        '--esModuleInterop',
        '--skipLibCheck',
      ],
      { stdio: 'pipe', cwd: __dirname },
    );
  } catch (cause) {
    const output = [cause.stdout, cause.stderr]
      .filter(Boolean)
      .map((buffer) => buffer.toString())
      .join('\n')
      .trim();
    fail('Could not compile the frontend content files.', output || cause);
  }

  let content;
  try {
    content = require(path.join(build, 'content.js'));
  } catch (cause) {
    fail('Compiled the content but could not load it.', cause);
  }

  const snapshot = {
    // Provenance, so nobody has to guess whether the JSON is stale or
    // hand-edited. It is neither if this line matches the file it came from.
    generatedAt: new Date().toISOString(),
    generatedFrom: 'frontend/app/src/data/content.ts',
    genres: content.GENRES,
    stories: content.STORIES,
    publications: content.PUBLICATIONS,
    awards: content.AWARDS,
  };

  for (const [key, value] of Object.entries(snapshot)) {
    // `awards` is legitimately empty — nothing has been confirmed, and the
    // content file says so out loud. Anything else arriving empty means the
    // export broke, and writing an empty file over a good one would quietly
    // wipe the seed.
    if (Array.isArray(value) && value.length === 0 && key !== 'awards') {
      fail(`The export produced no ${key}. Refusing to overwrite ${OUT_FILE}.`);
    }
  }

  try {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  } catch (cause) {
    fail(`Could not write ${OUT_FILE}.`, cause);
  }

  try {
    fs.rmSync(build, { recursive: true, force: true });
  } catch {
    // A leftover temp directory is not worth failing the export over.
  }

  console.log(
    `  ok ${path.relative(process.cwd(), OUT_FILE)} — ` +
      `${snapshot.genres.length} genres, ${snapshot.stories.length} stories, ` +
      `${snapshot.publications.length} publications, ${snapshot.awards.length} awards`,
  );
}

main();
