## Development

Commands run inside the Nix dev shell: `devenv shell -- <command>`, or via the `justfile` recipes (`devenv shell -- just <recipe>`; run `just` with no args to list them).

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

After editing `.astro`/content files, verify with `devenv shell -- npx astro build` rather than assuming — content collection schema mismatches and Astro/JSX whitespace-collapsing bugs (a line break landing right at an inline tag boundary silently eats the space) only show up in the actual build output.

To see how a page looks (after any visual change), use the `browser-check` skill: `devenv shell -- just shot <path>` screenshots it in a headless Windows Edge, light and dark. After a visual change also run `devenv shell -- just check-layout`, which checks the layout rules in `scripts/browser-check/rules.mjs` on every page at four widths; a failure blocks the change, and a rule is never loosened without asking. devenv generates the skill into `.claude/skills/` (`claude.code` in `devenv.nix`); its source is `scripts/browser-check/skill.md`, so edit that, not the generated file.

## Transcripts of agent output

Some posts quote agents or LLMs, e.g. `src/content/blog/la-trahison-des-mots.mdx`, a chat session written with the `UserTurn` and `Thinking` components in `src/components/chat/`. Treat the agent's words as a quotation: never change them, not even to fix spelling, grammar, capitalization, punctuation or spacing, or to make them consistent with the rest of the site. This covers the agent's replies, its status lines (`<Thinking>`), and agent output quoted anywhere else, such as a passage the user pastes into their own bubble.

What may change:

- Markdown structure and emphasis, to match how the original rendered (paragraphs, lists, bold and italics). Interface chrome such as action buttons and timestamps is left out.
- The user's own turns, the frontmatter, and any text outside the transcript.

When agent text has an error or an inconsistency, point it out rather than fixing it: the post records what the model actually produced.

## Secrets

Secrets needed for local scripts (e.g. fetching the private CV source repo) are declared in `secretspec.toml` and resolved from the local OS keyring — see `secretspec run --reason "..." -- <command>` and `justfile`'s `set-curriculum-token`. Do **not** wire secrets into `devenv.nix`'s `env`: devenv's own `secretspec` integration then validates every declared secret on *every* shell entry, which requires an agent `--reason` even for commands that have nothing to do with the secret (e.g. `just build`). Resolve them on demand instead. For the same reason `devenv.yaml` sets `secretspec.enable: false` explicitly: devenv otherwise turns its integration on when `SECRETSPEC_PROVIDER`/`SECRETSPEC_PROFILE` are set, which they are in anything launched from a devenv shell that enables secretspec (such as system-flakes').

## Contact form

`server/contact/main.ts` is a separate Deno Deploy function (not part of the Astro build) that the contact form on the homepage POSTs to. After changing it, redeploy with `devenv shell -- just deploy-contact` — org/app config is recorded in `deno.jsonc`.

## Deployment

`.woodpecker.yml` builds and deploys automatically on push to `main` (see README's Deployment section for the full mechanism). It force-pushes generated output to the `pages` branch on every run — that branch is never meant to be edited directly.

GitHub's `tarc/portfolio` is a read-only mirror of this Codeberg repo, which Codeberg syncs every 8 hours. After every push to `origin`, run `devenv shell -- just sync-mirror` so GitHub catches up right away; cloud sessions clone from there. Never push to GitHub directly: the next sync overwrites it.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
