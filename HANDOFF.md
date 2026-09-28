# Handoff

State as of 2026-09-28, written for an agent picking up this repo without
access to the local machine (e.g. Claude Code on the web). Read `AGENTS.md`
(= `CLAUDE.md`) and `README.md` first; this file adds what they don't record:
the local agent's memory, the external repos, and how to work with Codeberg.

## What the site is

Tarcísio G. Rodrigues's personal portfolio: Astro + React + Tailwind,
deployed to Codeberg Pages at <https://tarcisio.codeberg.page/>. Home page
(hero / about / projects / contact), a blog (`src/content/blog/`), project
cards (`src/content/projects/`), and a Bio page with a CV download.

## Repositories

| Repo | Role |
| --- | --- |
| `ssh://git@codeberg.org/tarcisio/pages.git` | **This repo** (`origin`). `main` = source; `pages` = generated site, force-pushed by CI on every run. Never edit `pages` by hand. |
| `ssh://git@codeberg.org/tarcisio/curriculum.git` | **Private** LaTeX source of the CV (`curriculum.tex`). CI clones it with a token, runs `pdflatex`, and publishes `public/curriculum.pdf` plus `curriculum.sha`. It rebuilds only when the repo's HEAD differs from the published `https://tarcisio.codeberg.page/curriculum.sha`; otherwise it reuses the published PDF. The Bio page links `/curriculum.pdf`. |
| `~/projects/system-flakes` (local, also on Codeberg under `tarcisio`) | The user's NixOS/home-manager config. Any change to shell/user config goes there as a module edit, never to `~/.config/*` directly. |

Other Codeberg repos of the user that appear as project cards:
`conan-dev`, `conan-flake`, `system-flakes`.

### GitHub mirror

`git@github.com:tarc/portfolio.git` (<https://github.com/tarc/portfolio>) is
a read-only **mirror** of the Codeberg repo, there so tools that only speak
GitHub (e.g. Claude Code on the web) can clone it. Codeberg stays the
source of truth.

- Codeberg pushes to it: a push mirror on `tarcisio/pages` (created
  2026-09-28), all branches, every 8 h. "Sync on commit" is also enabled
  but didn't fire on three pushes on 2026-09-28, so don't rely on it.
  Settings → Mirror settings on Codeberg; `tea api --login codeberg
  /repos/tarcisio/pages/push_mirrors` shows its status.
- **After every push to `origin`, run `devenv shell -- just sync-mirror`**
  (`scripts/sync-mirror/sync.sh`). It
  triggers the sync through Codeberg's API and waits until GitHub's `main`
  equals Codeberg's. On failure it prints the mirror's `last_error`; an
  authentication error means the GitHub token in Codeberg's mirror
  settings needs renewing, which only the user can do. The recipe needs
  tea's `codeberg` login, so a remote agent can't run it. After a remote
  session's work lands on Codeberg, the user runs it locally.
- A push mirror overwrites the GitHub refs with Codeberg's, so anything
  pushed only to GitHub gets lost at the next sync. Put commits on Codeberg
  (`origin`). A GitHub PR is only a way to hand over a branch: the user
  lands it on Codeberg, and the mirror then brings GitHub up to date.
- CI, deployment and issues run only on Codeberg; GitHub has no Actions or
  Pages here.
- It isn't a git remote in the local clone, and the local clone doesn't
  need one.
- On GitHub the repo is **`tarc/portfolio`**, not `tarcisio/pages`. A
  cloud session started from the local clone (whose `origin` is Codeberg)
  asked GitHub for `tarcisio/pages` and failed with "Authentication failed
  while accessing the repository" (2026-09-28). Start cloud sessions with
  `tarc/portfolio` selected on claude.ai/code, or from a clone of
  `git@github.com:tarc/portfolio.git`. The Claude GitHub App needs access
  to `tarc/portfolio`. The container has no Nix, so a setup script of
  `npm ci` is enough.

### Secrets for the CV repo

- CI: Woodpecker secret `codeberg_curriculum_token` (→ `CURRICULUM_TOKEN`)
  in the `cv` step; `codeberg_token` for the deploy push. Both are set in
  the Woodpecker repo settings (<https://ci.codeberg.org/repos/17883>).
- Locally: `CODEBERG_CURRICULUM_TOKEN`, declared in `secretspec.toml`,
  stored in the OS keyring (`devenv shell -- just set-curriculum-token`),
  resolved on demand:
  `secretspec run --profile default --provider keyring --reason "<why>" -- <command>`.
  Do not wire it into `devenv.nix` `env` (see AGENTS.md "Secrets").
- A remote agent has neither keyring nor token: it can't fetch the CV repo.
  It doesn't need to; `public/curriculum.pdf` is only produced in CI.

## Codeberg CLI: `tea`

`tea` (Gitea/Forgejo CLI, 0.15.1) is in `devenv.nix` `packages`. It isn't
installed globally, so run it in the dev shell:

```sh
devenv shell -- tea <command>
```

The local login is named `codeberg` (user `tarcisio`, SSH key
`~/.ssh/id_ed25519_codeberg`, config in `~/.config/tea/config.yml`; it is
not the default login, so pass `--login codeberg`). Examples:

```sh
tea repos list --login codeberg --output simple
tea issues list --login codeberg --repo tarcisio/pages
tea pulls create --login codeberg --repo tarcisio/pages --head <branch> --base main --title "..." --description "..."
tea pulls list --login codeberg --repo tarcisio/pages
```

The `tarcisio/pages` repo had no open issues on 2026-09-28. A remote agent
has no tea login; it would need `tea login add --name codeberg
--url https://codeberg.org --token <token>`, and the token is the user's to
give. `gh` doesn't work here: this is Codeberg, not GitHub.

## Deployment

- Push to `main` → Woodpecker (`.woodpecker.yml`): `cv` → `build`
  (`npm ci && npx astro build`) → `deploy` (force-push `dist/` to `pages`).
  Status badge / runs: <https://ci.codeberg.org/repos/17883>.
- Contact form backend: `server/contact/main.ts`, a Deno Deploy function
  (org `tarcisio`, app `portfolio-contact`, in `deno.jsonc`) that sends mail
  through Resend. Redeploy after changes: `devenv shell -- just deploy-contact`
  (needs the user's Deno Deploy login).
- Only commit/push when the user asks. Pushing `main` publishes the site.
  Follow each push with `devenv shell -- just sync-mirror` (see
  "GitHub mirror").

## Local environment (what a remote agent won't have)

- NixOS on WSL2. Commands run in `devenv shell -- <cmd>` or
  `devenv shell -- just <recipe>`; `devenv shell -- just` lists recipes.
- Verify `.astro`/content edits with `devenv shell -- npx astro build`.
- Dev server: `astro dev --background` (`just dev`, `dev-status`,
  `dev-logs`, `dev-stop`), on `http://localhost:4321`.
- `browser-check` (`scripts/browser-check/`, `just shot <path>`) drives the
  **Windows** Edge from WSL through the DevTools Protocol, run by Windows'
  Node. It only works on the user's machine. Its Claude skill is generated
  from `scripts/browser-check/skill.md` by `devenv.nix` (`claude.code`);
  edit that source, not `.claude/skills/`.
- Without devenv/Nix, plain `npm ci && npx astro build` (Node 22, like CI)
  is enough to check the build.

## Local agent memory (not in the repo otherwise)

1. **Chat bubbles stay rounded.** The transcript components
   (`src/components/chat/UserTurn.astro`, `rounded-2xl`) keep rounded
   corners although project/blog cards were made sharp (6bede6b). Code
   blocks inside bubbles keep the site's dark code style. The user chose
   both on 2026-09-27: round corners make the bubble read as a chat message.
   Don't "normalize" them in style passes.
2. **Layout checks plan is in progress.** The plan is
   `scripts/browser-check/PLAN.md` (committed in 47cd7c7, decisions in
   83641db). All five decisions are made (each the recommended option).
   Steps 1–4 are done (lib/, `just check-layout`, the tablet headline
   fix, mutation tests; the last three on 2026-09-28 in a cloud session,
   run on Linux Chromium, not yet on Edge). Steps 5–6 remain. When done,
   fold PLAN.md into README.md or delete it.

Also from AGENTS.md, but easy to trip over: agent/LLM text quoted in posts
(e.g. `src/content/blog/la-trahison-des-mots.mdx`) is a quotation. Never edit
it, not even typos; point errors out instead.

## Recent work (2026-09-27)

- New post "La Trahison des mots" as a chat transcript (`UserTurn`,
  `Thinking` components), including the Magritte exchange.
- Post subtitles; balanced post headings.
- Phone layout pass: header fits on phones, even page tops, larger Glob
  and Bio titles, card dates clear of titles, square buttons/fields/photo,
  sharp project and blog cards.
- browser-check tool added, then its browser code moved into `lib/`.
- devenv's secretspec integration disabled explicitly in `devenv.yaml`.

Working tree clean, `main` in sync with `origin/main` at 737c3f8.

## Remaining steps

The layout checks plan (`scripts/browser-check/PLAN.md`) is done but for
its step 6, which needs the user's machine:

1. **First `just check-visual` run on Edge:** `just check-visual --record`
   for the reference set, then a small deliberate change and `just
   check-visual` to see the report (`.visual/report.html`). It was tried
   only on Linux Chromium with ImageMagick 6; devenv brings ImageMagick 7.
2. Then fold PLAN.md into `scripts/browser-check/README.md` or delete it,
   and drop the "in progress" note under "Local agent memory".

Only the user's machine runs Edge. A remote agent can check with Linux
Chromium (Playwright's, at `/opt/pw-browsers`) by running the drivers
under Linux's Node with a wrapper that adds `--no-sandbox`; say which
browser it was.
