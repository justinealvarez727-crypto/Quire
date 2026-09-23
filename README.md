# Quire

A quiet place to write your novel — writing, an outline board, a story bible, a
mind map, a research board, and per-novel goals — installable on your phone
and laptop, syncing through the same Supabase + Vercel setup as your budget
tracker.

## Stack

- **React + Vite** — the app itself
- **Supabase** (Postgres + Auth + Storage) — your data, synced across devices
- **Vercel** — hosting
- **vite-plugin-pwa** — installable on your phone's home screen, works offline
  for anything already loaded

If you skip the Supabase setup, the app still runs — it just saves to that one
browser's storage instead of syncing. Good for trying it out before you wire
up an account.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (or reuse your
   budget tracker's project — Quire's tables have their own names, so they
   won't collide).
2. **SQL Editor → New query** → paste in `supabase/schema.sql` → Run. This
   creates every table, the row-level security policies (so only you can ever
   see your own novels), and a private `research` Storage bucket for
   moodboard images.
3. **Authentication → Providers → Email** → make sure it's **on**. Turn
   **Confirm email** **off** — with it off, creating an account signs you in
   immediately, with no email step at all. (Leave it on only if you'd rather
   confirm by email once before first use.)
4. **Project Settings → API** → copy the **Project URL** and the **anon
   public** key.

## 2. Run it locally

```bash
npm install
cp .env.example .env.local
# paste your Supabase URL and anon key into .env.local
npm run dev
```

Open the printed `localhost` URL. Create an account with an email and a
password (6+ characters) — with **Confirm email** off in Supabase, you're in
immediately.

Run the test suite any time with `npm test`.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **New Project** → import the repo.
3. Add the two environment variables from your `.env.local`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) under **Settings →
   Environment Variables**.
4. Deploy. `vercel.json` is already set up so refreshing any page works.

## 4. Install it on your phone

- **iPhone:** open the deployed link in Safari → Share → **Add to Home
  Screen**.
- **Android:** open it in Chrome → menu (⋮) → **Install app** (or **Add to
  Home screen**).

It'll open full-screen like any other app, with its own icon.

## What's in each tab

- **Write** — one scene at a time, autosaving as you type, with a status mark
  (draft / revised / final), adjustable font and size, a Focus mode, and an
  optional grammar checker.
- **Outline** — scenes as index cards you drag to reorder. Switch between a
  freeform list, Three-act, or Save the Cat; template views group your scenes
  under each beat.
- **Bible** — character and place cards (bio, arc, relationships / description,
  lore), a timeline of plot events, and a strip of scene numbers on each card
  so you can mark exactly which scenes they appear in.
- **Map** — a freeform mind map. Add ideas, people, and places, drag them
  around, and draw labeled links between them.
- **Research** — a pinboard for notes, reference links, and images per novel.
- **Progress** — a daily or weekly goal in words or time, a manuscript-wide
  goal, a 14-day chart, and stats (writing time, sessions, average words per
  session). Set from the Progress tab, per novel.
- **Dashboard** — every novel you're writing, each with its own goals and
  progress bar.

Settings (the **Aa** button) — 18 fonts, text size, line spacing, page width,
and three themes (Typescript, Legal pad, Night desk) — apply everywhere in
the app at once.

## Grammar checker

The **Grammar** button on the Write tab checks the current scene against
[LanguageTool](https://languagetool.org), a couple of seconds after you stop
typing. It's off until you turn it on — nothing is sent anywhere otherwise.
Click a suggested replacement to apply it, or **Ignore** to dismiss a flagged
line.

By default it uses LanguageTool's free public API, which means your scene
text is sent to their server to be checked. If you'd rather that never
happen, you can run your own LanguageTool server (they publish a Docker
image) and point Quire at it instead:

```
VITE_LANGUAGETOOL_URL=https://your-languagetool-server/v2/check
```

Add that to `.env.local` (and to Vercel's environment variables if you
deploy). Leave it unset to use the public API.

## Notes for later

- `npm run build:single` produces one self-contained HTML file (no PWA, no
  sync — "this device" mode only) if you ever want an offline copy you can
  just open in a browser.
- Moodboard images are stored in the private `research` Storage bucket,
  scoped to your account by the same row-level security as everything else.
- `supabase/schema.sql` is safe to re-run — every statement is written to skip
  what already exists.
