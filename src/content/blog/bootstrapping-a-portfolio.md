---
title: "Bootstrapping This Portfolio"
description: "A tutorial walking through how this site was built: devenv, Astro, content collections, dark mode, math rendering, a justfile, and automated deployment to Codeberg Pages via Woodpecker CI."
pubDate: 2026-09-11
---

This post walks through bootstrapping a portfolio site with the same shape as this one: an [Astro](https://astro.build) site with a blog and a projects section, developed inside a reproducible [devenv](https://devenv.sh) environment, and deployed automatically to [Codeberg Pages](https://codeberg.page) through a [Woodpecker CI](https://woodpecker-ci.org) pipeline. Nothing here is exotic — the point is having the whole path from an empty directory to a self-deploying site in one place.

## The dev environment

Everything starts with a `devenv.nix`. It gives you a reproducible shell with Node.js, without polluting your system or relying on whatever version happens to be installed globally:

```nix
{ pkgs, ... }:
{
  name = "portfolio";

  languages.javascript = {
    enable = true;
    npm.enable = true;
    npm.install.enable = true;
  };

  packages = with pkgs; [
    jq
    just
  ];
}
```

`npm.install.enable = true` runs `npm install` automatically whenever `package.json` changes and you re-enter the shell — one less step to remember. From here on, everything runs through `devenv shell -- <command>`.

## Scaffolding Astro

```sh
devenv shell -- npm create astro@latest -- --template basics
```

Then add the integrations this site actually uses:

```sh
devenv shell -- npx astro add react tailwind mdx sitemap
```

`astro add` does the annoying part for you: installs the package and wires it into `astro.config.mjs`. After adding math support on top (see below), the config ends up looking like this:

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://yourdomain.example',
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  integrations: [react(), mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
```

`site` matters here — `@astrojs/sitemap` needs an absolute URL to generate correct entries, and it's a one-time setting: every future page or post gets picked up automatically on the next build, no manual sitemap maintenance.

## Content as data: Astro Content Collections

Rather than hardcoding blog posts or project cards into `.astro` files, both live as Markdown with typed frontmatter, validated at build time:

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    link: z.string().url(),
  }),
});

export const collections = { blog, projects };
```

A blog post is then just a file:

```md
---
title: "Hello, World"
description: "First post."
pubDate: 2026-01-01
---

Body content here.
```

And a page lists them with `getCollection('blog')`, sorted by date — no CMS, no database, just files that TypeScript and Zod keep honest.

## Dark mode without a UI framework

Tailwind v4 moved configuration into CSS. A custom variant driven by a `.dark` class (instead of only `prefers-color-scheme`) is one line:

```css
/* src/styles/global.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

The theme itself is a tiny inline script in the `<head>`, applied *before* first paint to avoid a flash of the wrong theme, plus a toggle button:

```html
<script is:inline>
  const theme = localStorage.getItem('theme');
  if (theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
</script>
```

```html
<script is:inline>
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
</script>
```

## Math and prettier prose

If your blog needs LaTeX-style math (`$...$` inline, or a fenced `$$` block for display mode), `remark-math` + `rehype-katex` handle the parsing and rendering — already shown in the `astro.config.mjs` above. One gotcha: a `$$formula$$` written on a single line parses as *inline* math; display math needs the delimiters on their own lines:

```md
$$
\mathrm{Hom}_D(F(X), Y) \;\cong\; \mathrm{Hom}_C(X, G(Y))
$$
```

Import KaTeX's stylesheet on the post page (not globally, to avoid shipping its weight on pages with no math):

```js
import 'katex/dist/katex.min.css';
```

Separately, Tailwind's Preflight strips default styling from every HTML element — so raw Markdown output (headings, lists, code) renders with zero visual hierarchy unless you opt in. The `@tailwindcss/typography` plugin fixes that:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

```html
<div class="prose prose-lg max-w-none dark:prose-invert">
  <Content />
</div>
```

One default worth knowing about: Typography decorates inline `<code>` with literal backtick characters via CSS pseudo-elements. If that's not the look you want, `prose-code:before:content-none prose-code:after:content-none` turns it off.

## A justfile for the recurring commands

[just](https://just.systems) is a thin task runner — each recipe is documented with a `#` comment, which doubles as the `--list` output:

```just
# List available recipes
default:
    @just --list

# Install project dependencies
install:
    npm install

# Start the dev server in the background
dev:
    astro dev --background

# Stop the background dev server
dev-stop:
    astro dev stop

# Build the site for production
build:
    astro build
```

Run inside the devenv shell: `devenv shell -- just dev`.

## Shipping it: Codeberg Pages via Woodpecker CI

Codeberg Pages serves static files from a branch named `pages`. For a repository literally named `pages`, that serves at the root of your `<user>.codeberg.page` subdomain; for any other repo, it serves under a path. The trick is that `pages` isn't something you maintain by hand — it's generated fresh on every deploy.

A `.woodpecker.yml` at the repo root does the whole job:

```yaml
when:
  - event: [push, manual]
    branch: main

steps:
  - name: build
    image: node:22
    commands:
      - npm ci
      - npx astro build

  - name: deploy
    image: alpine/git
    environment:
      CODEBERG_TOKEN:
        from_secret: codeberg_token
    commands:
      - git config --global user.name "Woodpecker CI"
      - git config --global user.email "ci@codeberg.org"
      - cd dist
      - git init
      - git checkout -b pages
      - git add -A
      - git commit -m "Deploy $CI_COMMIT_SHA"
      - git push --force https://USER:$${CODEBERG_TOKEN}@codeberg.org/USER/REPO.git pages:pages
```

The `deploy` step turns `dist/` into a brand-new git repo on every run and force-pushes it as `pages` — that branch only ever holds generated output, so rewriting its history each time is expected, not a bug. `$${CODEBERG_TOKEN}` (doubled `$`) matters: Woodpecker preprocesses `from_secret` values in the compiled pipeline, and the extra `$` escapes that so the shell — not Woodpecker — does the substitution at runtime.

For the site to actually pick up new `pages` pushes promptly, add a Forgejo-type webhook in the repo's settings pointing at the site's own production URL, filtered to the `pages` branch — otherwise Codeberg Pages relies on its own polling interval.

## Secrets, without hardcoding them anywhere

Some things a CI pipeline needs (API tokens) shouldn't live in the repo, but also shouldn't require you to paste raw values into a terminal every time. [secretspec](https://secretspec.dev) declares what a project needs and resolves it from a provider — a local OS keyring for development, CI secret stores in the pipeline:

```toml
# secretspec.toml
[project]
name = "portfolio"
revision = "1.0"

[profiles.default]
SOME_TOKEN = { description = "What this is for", required = true }
```

Setting the value locally:

```sh
secretspec set SOME_TOKEN --provider keyring --profile default
```

And resolving it on demand, with an explicit justification (secretspec requires a `--reason` for programmatic/agent access by default — a deliberate audit trail, not a bug):

```sh
secretspec run --profile default --provider keyring --reason "why you need it" -- your-command
```

One pitfall: devenv has its own secretspec integration (`devenv.yaml`'s `secretspec.enable`) that can wire resolved secrets straight into `env.*`. That's convenient, but it validates *every* declared secret on *every* shell entry — meaning an unrelated command like `just build` would suddenly demand a `--reason` too. If you only need a secret for one occasional task (rotating a token, hitting an external API from a script), it's simpler to skip that integration entirely and call `secretspec run` directly only when you actually need it.

## What's left

That covers the whole path: a reproducible dev shell, a typed content model instead of hardcoded markup, a working dark mode, math and readable prose in blog posts, a documented set of task-runner commands, and a CI pipeline that rebuilds and redeploys on every push — with secrets kept out of the repository and out of the shell history. From here it's mostly content: writing posts, adding projects, and tuning the design.
