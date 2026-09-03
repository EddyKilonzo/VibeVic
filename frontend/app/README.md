# VibeVic — the site and the workspace

Next.js 16 (App Router), React 19, Tailwind 3.

This file used to be the Vite starter template, describing a build tool this
app has not used for a long time — which is worse than no README, because a
wrong one is followed.

**The project's documentation is in [`../../README.md`](../../README.md).**

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

The API must be running too, and `API_URL` in `.env.local` should point at it
(`http://localhost:4000/api`) — without that override a local run signs in
against production and reads the live newsroom. See the root README.

| | |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Worth knowing before editing

- `AGENTS.md` in this directory is written by `next dev` and re-created if
  removed. Commit it with your work rather than fighting it.
- `middleware.ts` runs in the **edge runtime**. Anything it touches must be
  edge-safe — see the comment in `src/lib/newsroom-session.ts` for a bug that
  typechecked, passed under Node, and made the gate refuse every valid
  session.
- Routes under `src/app/api/newsroom/` are server-only proxies. The browser
  never holds an API credential; the session cookie is `httpOnly`.
- The workspace is mounted at whatever `NEXT_PUBLIC_NEWSROOM_BASE` says, and
  `app/admin/*` answers 404 directly. That is obscurity, not security — the
  gate is what does the work.
