<div align="center">

# Portfolio

**Personal portfolio site for Tarcísio G. Rodrigues**

<p>
<a href="https://ci.codeberg.org/repos/17883" target="_blank">
  <img src="https://ci.codeberg.org/api/badges/17883/status.svg?events=push%2Cmanual" alt="status-badge" />
</a>
<a href="https://devenv.sh" target="_blank">
  <img src="https://devenv.sh/assets/devenv-badge.svg"/>
</a>
</p>

**[Live Site](https://tarcisio.codeberg.page/)** &middot;
[Blog](https://tarcisio.codeberg.page/blog/) &middot;
[GitHub mirror](https://github.com/tarc/portfolio)

</div>

Built with [Astro](https://astro.build), React, and Tailwind CSS, and deployed to [Codeberg Pages](https://codeberg.page/).

The source lives on [Codeberg](https://codeberg.org/tarcisio/pages); [GitHub](https://github.com/tarc/portfolio) holds a read-only mirror that Codeberg updates on every push. Changes pushed only to GitHub get overwritten at the next sync.

## Project Structure

```text
/
├── public/                    # Static assets (favicon, CV, Cetacea logo, etc.)
├── server/
│   └── contact/
│       └── main.ts             # Deno Deploy function backing the contact form
├── src/
│   ├── content/
│   │   ├── blog/                # Blog posts (.md / .mdx)
│   │   └── projects/             # Project entries (.md)
│   ├── content.config.ts        # Content Collections schema
│   ├── layouts/
│   │   └── Layout.astro         # Shared shell: nav, footer, meta tags, dark mode
│   ├── lib/
│   │   └── format.ts            # Shared date formatting helper
│   ├── pages/
│   │   ├── index.astro          # Single-page home (hero/about/projects/contact)
│   │   ├── bio.astro            # Bio page: education, publications, CV download
│   │   └── blog/                 # Blog listing and post routes
│   └── styles/
│       └── global.css           # Tailwind entrypoint, dark mode variant, typography plugin
├── astro.config.mjs
├── devenv.nix                  # Nix dev environment (Node, Deno, jq, just)
├── secretspec.toml              # Declares secrets needed for local scripts (resolved via OS keyring)
├── .woodpecker.yml              # CI: builds the CV, builds the site, deploys to Codeberg Pages
└── justfile                    # Task runner recipes
```

## Getting Started Locally

This project uses [devenv](https://devenv.sh/) to manage the Node.js/Deno toolchain, and [just](https://just.systems/) as a task runner. Both are provided by the Nix dev shell, so you don't need to install Node, npm, or Deno yourself.

1. Clone the repository:

   ```sh
   git clone ssh://git@codeberg.org/tarcisio/pages.git
   cd pages
   ```

2. Install dependencies:

   ```sh
   devenv shell -- just install
   ```

3. Start the dev server:

   ```sh
   devenv shell -- just dev
   ```

   The site is served in the background at `http://localhost:4321`. Manage it with `just dev-status`, `just dev-logs`, and `just dev-stop` (all run inside `devenv shell --`).

Run `devenv shell -- just` with no arguments to see all available recipes (`build`, `preview`, `deploy-contact`, `set-curriculum-token`, etc.).

If you have `direnv` set up, `devenv shell --` can be dropped and the recipes run directly (e.g. `just dev`).

## Content

- Blog posts live in `src/content/blog/` as Markdown or MDX files. Math is supported via `$...$` (inline) and a fenced `$$` block on its own lines (display mode), rendered with KaTeX.
- Projects live in `src/content/projects/` as Markdown files with `title`, `description`, `tags`, and `link` frontmatter.

Both are validated against the schemas in `src/content.config.ts`. Post/project bodies render through `@tailwindcss/typography`'s `prose` class, which is what gives raw Markdown output (headings, lists, code) its visual hierarchy.

## Deployment

Every push to `main` triggers a Woodpecker CI pipeline (`.woodpecker.yml`) that:

1. Fetches/builds `public/curriculum.pdf` from a separate private LaTeX source repo — skipped and reused from the last published version unless that repo's source actually changed (checked via `git ls-remote`, compared against a `curriculum.sha` marker published alongside the PDF).
2. Runs `astro build`.
3. Force-pushes the built `dist/` output to this repo's `pages` branch, which Codeberg Pages serves at the live site URL.

The `pages` branch only ever holds generated output — it's rewritten on every deploy, not something to edit by hand.

The contact form is a separate piece: it POSTs to a small [Deno Deploy](https://console.deno.com) function (`server/contact/main.ts`) that forwards messages via [Resend](https://resend.com). Redeploy it after changes with `devenv shell -- just deploy-contact`.

## Secrets

Local scripts that need credentials (e.g. fetching the private CV source repo) use [secretspec](https://secretspec.dev), backed by your OS keyring rather than raw values in the shell or repo. `secretspec.toml` declares what's needed; `devenv shell -- just set-curriculum-token` does the one-time setup. Secrets are intentionally **not** wired into `devenv.nix`'s `env` — that would make devenv validate them on every shell entry, requiring a justification for unrelated commands like `just build`. They're resolved on demand instead, via `secretspec run --reason "..." -- <command>`.
