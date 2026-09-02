/* eslint-disable no-console */
import { createHash, randomBytes } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, Role } from '@prisma/client';

loadEnv();

/**
 * The account tool.
 *
 * ── Why accounts are made here and not by the seed ───────────────────────
 * `seed.ts` loads the site's published content and is safe to re-run on every
 * deploy. Accounts are not content: creating one is a deliberate act with a
 * person on the other end of it, and it should happen when somebody decides
 * it should, not as a side effect of a deploy. So it is a separate command
 * that a human runs, and it says out loud what it did.
 *
 * ── Why it never takes a password ────────────────────────────────────────
 * There is no `--password` flag, and adding one would be the single easiest
 * way to undo the rest of this work. A password typed on a command line goes
 * into shell history, into the terminal's scrollback, into any recording of
 * the session and — on a CI runner — into a build log. Instead this creates
 * the account with no password at all (`passwordHash` null, which the schema
 * describes as a real state) and prints a single-use setup link. The person
 * whose account it is chooses the password, in a browser, and nobody else
 * ever holds it.
 *
 * That link is the same mechanism as "I forgot my password", used for the
 * first password rather than the next one. One flow, exercised every time an
 * account is created, so it cannot rot unnoticed between the rare occasions
 * somebody actually forgets.
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *   npm run account -- add --email vic@example.com --name "Victor" --role writer
 *   npm run account -- link --email vic@example.com
 *   npm run account -- list
 */

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const flags = parseFlags(argv.slice(1));

  switch (command) {
    case 'add':
      return add(flags);
    case 'link':
      return link(required(flags, 'email'));
    case 'list':
      return list();
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
}

async function add(flags: Map<string, string>): Promise<void> {
  const email = normalise(required(flags, 'email'));
  const name = required(flags, 'name');
  const role = parseRole(required(flags, 'role'));

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Not an upsert. Silently changing somebody's role because a command was
    // re-run with a different flag is exactly the kind of quiet permission
    // change `roles.ts` exists to prevent.
    throw new Error(
      `${email} already has an account (${existing.role}). Use "link" to send them a new setup link.`,
    );
  }

  const user = await prisma.user.create({
    data: { email, name, role },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log(`Created ${user.name} <${user.email}> as ${user.role}.`);
  console.log('');
  await printLink(user.id, user.email);
}

async function link(rawEmail: string): Promise<void> {
  const email = normalise(rawEmail);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user) throw new Error(`No account for ${email}.`);

  if (user.passwordHash) {
    console.log('Note: this account already has a password. The link below replaces it,');
    console.log('and using it will end every session that account currently holds.');
    console.log('');
  }

  await printLink(user.id, user.email);
}

async function list(): Promise<void> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      lastLoginAt: true,
    },
  });

  if (users.length === 0) {
    console.log('No accounts. Create one with "npm run account -- add".');
    return;
  }

  for (const user of users) {
    // The hash is selected and never printed — only reduced to a yes/no. A
    // tool that prints digests is a tool somebody eventually pipes to a file.
    const state = user.passwordHash ? 'has a password' : 'no password set';
    const seen = user.lastLoginAt
      ? `last signed in ${user.lastLoginAt.toISOString()}`
      : 'never signed in';
    console.log(`${user.role.padEnd(6)} ${user.email}  (${user.name}) — ${state}, ${seen}`);
  }
}

/**
 * Mints a reset row and prints the URL.
 *
 * Identical in every respect to what `PasswordResetService` writes — 32 random
 * bytes, SHA-256 in the table, one outstanding link per account — because a
 * second, subtly different implementation of a credential is how the two drift
 * until one of them is wrong.
 */
async function printLink(userId: string, email: string): Promise<void> {
  const minutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30);
  const appUrl = (process.env.APP_URL ?? '').replace(/\/+$/, '');
  if (!appUrl) {
    throw new Error('APP_URL is not set, so there is no origin to build a link from.');
  }

  const token = randomBytes(32).toString('hex');

  await prisma.$transaction(async (tx) => {
    await tx.passwordReset.deleteMany({ where: { userId, usedAt: null } });
    await tx.passwordReset.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + minutes * 60_000),
        requestedFrom: 'cli',
      },
    });
  });

  console.log(`Setup link for ${email} — works once, expires in ${minutes} minutes:`);
  console.log('');
  console.log(`  ${appUrl}/newsroom-access/reset?token=${token}`);
  console.log('');
  console.log('Send it to them over something you trust. It is a working credential');
  console.log('until it is used, so it does not belong in a ticket or a group chat.');
}

/* ── Argument handling ──────────────────────────────────────────────────── */

const USAGE = [
  'Usage:',
  '  npm run account -- add --email <address> --name "<name>" --role <writer|dev>',
  '  npm run account -- link --email <address>',
  '  npm run account -- list',
  '',
  'Roles:',
  '  writer  the journalist — the notebook and the front page: ideas, pitches,',
  '          the name behind a pseudonym, and publishing to the public site',
  '  dev     maintains the software — records and drafts, plus diagnostics and',
  '          account administration; never confidential, ideas, or publishing',
  '',
  'Neither role contains the other. See modules/auth/roles.ts.',
  '',
  'No --password flag exists, deliberately. See the note at the top of this file.',
].join('\n');

function parseFlags(args: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg?.startsWith('--')) continue;
    const [name, inline] = arg.slice(2).split('=');
    if (!name) continue;
    // Supports both `--email x` and `--email=x`; the second form is what
    // survives being pasted into a script.
    flags.set(name, inline ?? args[++i] ?? '');
  }
  return flags;
}

function required(flags: Map<string, string>, name: string): string {
  const value = flags.get(name)?.trim();
  if (!value) throw new Error(`Missing --${name}.\n\n${USAGE}`);
  return value;
}

function parseRole(value: string): Role {
  const upper = value.toUpperCase();
  if (upper === Role.WRITER || upper === Role.DEV) return upper as Role;
  throw new Error(`Unknown role "${value}". Use writer or dev.`);
}

/** Matches `AuthService.normaliseEmail`; sign-in compares lowercased. */
function normalise(email: string): string {
  return email.trim().toLowerCase();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
