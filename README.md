<div align="center">

# Portfolio

**Personal portfolio site for Tarcísio G. Rodrigues**

<p>
<a href="https://devenv.sh" target="_blank">
  <img src="https://devenv.sh/assets/devenv-badge.svg"/>
</a>
</p>

**[Live Site](https://tarcisio.codeberg.page/)** &middot;
[Blog](https://tarcisio.codeberg.page/blog/)

</div>

Built with [Astro](https://astro.build), React, and Tailwind CSS, and deployed to [Codeberg Pages](https://codeberg.page/).

## Project Structure

```text
/
├── public/                    # Static assets (favicon, etc.)
├── src/
│   ├── content/
│   │   ├── blog/               # Blog posts (.md / .mdx)
│   │   └── projects/           # Project entries (.md)
│   ├── content.config.ts       # Content Collections schema
│   ├── layouts/
│   │   └── Layout.astro        # Shared shell: nav, footer, meta tags, dark mode
│   ├── pages/
│   │   ├── index.astro         # Single-page home (hero/about/projects/contact)
│   │   └── blog/                # Blog listing and post routes
│   └── styles/
│       └── global.css          # Tailwind entrypoint + dark mode variant
├── astro.config.mjs
├── devenv.nix                  # Nix dev environment (Node, npm)
└── justfile                    # Task runner recipes
```

## Getting Started Locally

This project uses [devenv](https://devenv.sh/) to manage the Node.js toolchain, and [just](https://just.systems/) as a task runner. Both are provided by the Nix dev shell, so you don't need to install Node or npm yourself.

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

Run `devenv shell -- just` with no arguments to see all available recipes (`build`, `preview`, etc.).

If you have `direnv` set up, `devenv shell --` can be dropped and the recipes run directly (e.g. `just dev`).

## Content

- Blog posts live in `src/content/blog/` as Markdown or MDX files.
- Projects live in `src/content/projects/` as Markdown files with `title`, `description`, `tags`, and `link` frontmatter.

Both are validated against the schemas in `src/content.config.ts`.
