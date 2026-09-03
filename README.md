# VibeVic

The website and private newsroom of **Victor Kiplimo**, a journalist reporting
from Eldoret, Kenya on campus systems, Kenyan culture and student life.

Two applications in one repository:

| | | |
|---|---|---|
| `frontend/app` | Next.js 16 (App Router), React 19, Tailwind 3 | The public site, and the workspace behind it |
| `backend` | NestJS 10, Prisma 5, PostgreSQL (Neon) | The API, the record store, and the mail |

The public half is a reader's site: reports, written pieces, beats, search.
The private half is a working newsroom — drafts, sources, quotes, interviews,
evidence, a timeline, deadlines and notes — used by one person.

---

## The idea it is built on

**Nothing published is invented, and the software must not be the thing that
breaks that.**

That single rule is why the codebase looks the way it does, and it is worth
stating before the architecture, because most of the decisions below are
downstream of it:

- Every machine-generated suggestion is **measured or modelled, and the two
  are never mixed.** The pre-publication checks read the draft and cite the
  sentence behind each observation. The writing coach reports numbers —
  sentence length, adverb share, reading grade — and shows its working. Where
  a language model is involved, its output is labelled as a suggestion and
  changes nothing on its own.
- **No panel ever edits the copy.** Every finding is refusable. Passive voice
  is correct when the actor is unknown or is being protected; a long sentence
  is sometimes the point. The wording is always "this is what is here", never
  "fix this".
- **Source material never reaches a third party.** The assistant's briefing
  excludes sources, quotes, interviews and evidence entirely. A pitch sent to
  an editor carries a source *count*, never a name.
- **Nothing is ranked by traffic.** A quiet investigation cannot be demoted by
  its view count. The portfolio class is set by the journalist and is never
  computed.

---

## Features

### Publishing
Draft → scheduled → published, with the clock doing the scheduled transition
rather than a background job. A piece going live late is a broken promise to a
reader, so publication does not depend on a worker being awake. Reminders may
be late; publication may not.

### The reporting record
Nine collections — pitches, sources, quotes, interviews, entities, evidence,
timeline, notes, deadlines — reachable both from a story and from one Records
screen, since a person is never about only one story. Every collection is
described by one schema and rendered by one panel, so the tenth collection is
a data change rather than a new screen.

### Revision history
A version is kept when an edit replaces one: at most one every ten minutes
while drafting, and one for **every** change to a piece that is already live,
because editing something readers can see is a correction. Restoring loads the
older copy into the editor unsaved.

### Deadlines and reminders
Deadlines are set on a piece and read from the dashboard, because "what is
due" is a question asked across every piece at once, in the morning. A daily
pass sends a digest of what is due and a note when the newsroom has not been
opened for a while.

### Writing help
Pre-publication checks (headline, standfirst, beat, alt text, figures without
attribution, terms the house avoids) and a writing coach (opening, sentence
length, rhythm, passive voice, buried verbs, adverbs, readability). Both cite
their evidence. Neither scores the piece out of ten.

### Mia
An assistant that reads this newsroom and nothing else. Every answer is
followed by what she was actually reading — "stories, deadlines, ideas,
streak" — so it can be checked, and a model failure still returns the
briefing, because most of what gets asked is answerable from the figures. She
cannot write anything.

### The streak
How many days running the newsroom has been opened, with a fortnight of
squares as the working. It is not a target, there is no red state, and nothing
is ever described as broken.

### Mail
EJS templates on one shared shell, in the site's palette, with a dark-mode
block and a mobile breakpoint. No tracking pixels and no remote images.

---

## Security model

### Roles are scopes, never rows
A `Role` is `WRITER` or `DEV`, and scopes are derived from it — never stored on
the record. The two roles are **not a ladder**:

| | WRITER | DEV |
|---|:---:|:---:|
| `newsroom:read` / `newsroom:write` | ● | ● |
| `newsroom:confidential` | ● | — |
| `newsroom:ideas` | ● | — |
| `stories:write` | ● | ● |
| `stories:publish` | ● | — |
| `system:diagnostics` | — | ● |
| `system:accounts` | — | ● |

DEV maintains the software and can reproduce a bug against real shapes, and
stops at the three scopes that would turn a compromised developer account into
a source disclosure, a look at unpublished thinking, or an unreviewed
publication.

### Surfaces are default-closed
Every controller declares `Public`, `Newsroom` or `Machine`. A route that
declares nothing is refused. `Machine` is for the scheduler and carries **no
principal at all** rather than borrowing somebody's.

### Visibility tiers
`CONFIDENTIAL` > `PRIVATE` > `PUBLISHABLE`. Confidential rows are filtered in
the `where` clause, so a caller without the scope gets **404, not 403** — a 403
would confirm the row exists.

### Sessions
argon2id at the OWASP baseline. A JWT signed by the API and verified by the
frontend's middleware with the same secret. Password reset is a single-use
256-bit token stored only as a SHA-256, and the reset page strips it from the
address bar once the form holds it.

> Note: middleware runs in the **edge runtime**, so anything in the session
> path must be edge-safe. See the comment in `lib/newsroom-session.ts` — a bare
> `ArrayBuffer` typechecks, passes under Node, and is rejected at runtime by
> edge `crypto.subtle`, which once made the gate refuse every valid session.

### Unconfigured is closed
A missing `CRON_SECRET` answers **501**, never an open endpoint. A deployment
with no scheduler should not have a live route that runs the newsroom's mail.

---

## Running it

The backend declares `engines: node >=20`; it is developed on Node 22. You will
also need a PostgreSQL database — Neon in production, and the pooled/unpooled
split below matters there.

```bash
# API — http://localhost:4000  (prefix /api, health at /health)
cd backend
npm install
npx prisma migrate deploy
npm run start:dev

# Site — http://localhost:3000
cd frontend/app
npm install
npm run dev
```

Neither `.env` is committed and there is no `.env.example`: a file whose job is
to name every secret the server takes is one careless copy away from being the
real one. Every variable is documented in `backend/src/config/env.ts`, beside
the schema that enforces it.

Two settings are worth calling out for local work:

- `DATABASE_URL` goes through Neon's pooler; `DIRECT_URL` bypasses it and is
  what `prisma migrate` needs. Pointing migrate at the pooler produces
  failures that look like network flakiness.
- `API_URL` in `frontend/app/.env.local` overrides `NEXT_PUBLIC_API_URL` for
  every server-side call. Set it to `http://localhost:4000/api` or a local run
  signs in against production and reads the live newsroom.

### Accounts

```bash
cd backend
npm run account -- add --email you@example.com --name "You" --role writer
npm run account -- link --email you@example.com   # a fresh setup link
npm run account -- list
```

There is deliberately **no `--password` flag**. A password typed on a command
line goes into shell history, terminal scrollback, and any recording of the
session. The tool creates the account with no password and prints a single-use
setup link — the same mechanism as "I forgot my password", used for the first
one, so the flow cannot rot unnoticed between the rare times somebody needs it.

### Commands

| | |
|---|---|
| `npm run typecheck` | both apps |
| `npm test` | backend (Jest) |
| `npm run lint` | frontend (ESLint) |
| `npm run prisma:studio` | browse the database |
| `npm run db:seed` | load published content |

---

## Layout

```
backend/
  prisma/schema.prisma          the whole data model, commented
  prisma/accounts.ts            the account tool
  src/common/authz/             surfaces, scopes, the access policy
  src/common/concurrency/       optimistic locking
  src/modules/
    auth/                       argon2id, JWT, password reset
    stories/                    drafts, publishing, revisions
    newsroom/                   the nine collections, plus curation
    mail/                       EJS templates and the shared shell
    reminders/                  the scheduled pass
    system/                     diagnostics, accounts, activity

frontend/app/src/
  app/(site)/                   the public site
  app/admin/                    the workspace, served under a configurable path
  app/api/newsroom/             server-only proxies to the API
  components/admin/             the workspace's parts
  lib/intelligence/             checks and the writing coach — measured, local
  lib/mia/                      the briefing the assistant reads
  middleware.ts                 the gate
```

---

## A note on the comments

The comments in this codebase explain **why**, not what, and there are a lot of
them. Several record a decision that looks wrong until you know what it is
avoiding, or a bug that was expensive to find. They are meant to be read.
