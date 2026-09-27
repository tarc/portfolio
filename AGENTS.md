## Development

Commands run inside the Nix dev shell: `devenv shell -- <command>`, or via the `justfile` recipes (`devenv shell -- just <recipe>`; run `just` with no args to list them).

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

After editing `.astro`/content files, verify with `devenv shell -- npx astro build` rather than assuming — content collection schema mismatches and Astro/JSX whitespace-collapsing bugs (a line break landing right at an inline tag boundary silently eats the space) only show up in the actual build output.

To see how a page looks (after any visual change), use the `browser-check` skill: `devenv shell -- just shot <path>` screenshots it in a headless Windows Edge, light and dark. devenv generates the skill into `.claude/skills/` (`claude.code` in `devenv.nix`); its source is `scripts/browser-check/skill.md`, so edit that, not the generated file.

## Secrets

Secrets needed for local scripts (e.g. fetching the private CV source repo) are declared in `secretspec.toml` and resolved from the local OS keyring — see `secretspec run --reason "..." -- <command>` and `justfile`'s `set-curriculum-token`. Do **not** wire secrets into `devenv.nix`'s `env`: devenv's own `secretspec` integration then validates every declared secret on *every* shell entry, which requires an agent `--reason` even for commands that have nothing to do with the secret (e.g. `just build`). Resolve them on demand instead.

## Contact form

`server/contact/main.ts` is a separate Deno Deploy function (not part of the Astro build) that the contact form on the homepage POSTs to. After changing it, redeploy with `devenv shell -- just deploy-contact` — org/app config is recorded in `deno.jsonc`.

## Deployment

`.woodpecker.yml` builds and deploys automatically on push to `main` (see README's Deployment section for the full mechanism). It force-pushes generated output to the `pages` branch on every run — that branch is never meant to be edited directly.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
