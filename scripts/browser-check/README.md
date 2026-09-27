# Browser checks from WSL2

Screenshots of the site as a real browser renders it, taken from WSL2 with
the Microsoft Edge installed on Windows. The approach follows FactorSeal's
`scripts/windows-desktop-check` (browser-check): the browser is driven
through the Chrome DevTools Protocol by a script that runs under Windows'
Node.

| Script | Runs on | What it does |
| --- | --- | --- |
| `shot.sh [options] PATH_OR_URL...` | WSL | Checks the server answers, finds Edge and Windows' Node, and runs `shot.mjs`. Prints the path of every PNG it saved. `shot.sh` with no arguments lists the options. |
| `shot.mjs --config=BASE64` | Windows (Node) | Starts a headless Edge with a throwaway profile, then shoots each URL once per theme and viewport in its own tab, optionally clicking an element first and printing computed styles. Closes Edge and deletes the profile when done. |

Also available as `just shot ...` (inside `devenv shell`).

## Examples

```sh
# The whole post, light and dark, desktop width.
just shot /blog/la-trahison-des-mots/

# Only the first chat bubble, with the styles that make its corners.
just shot /blog/la-trahison-des-mots/ --selector='.prose > div' --styles=border-radius,width

# The home page on a phone, dark only.
just shot / --viewport=mobile --theme=dark

# Where tapping PROJECTS in the header lands, on a phone.
just shot / --viewport=mobile --click='nav a[href="/#projects"]' --visible

# The header after clicking the theme toggle.
just shot / --theme=light --click='#theme-toggle' --selector=header --pad=0
```

PNGs go to `/tmp/portfolio-shots` (or `--out=DIR`), named
`<path>[-<selector>]-<theme>-<viewport>.png`, so each run overwrites the previous
shots of the same page.

## How it works

- **Why Windows' Node.** Edge runs on Windows and listens for the DevTools
  Protocol on Windows' `127.0.0.1`, which WSL cannot always reach. Windows can
  reach servers in WSL through localhost forwarding, so the driver runs on
  the Windows side and loads the site from `http://localhost:4321`.
- **Headless, throwaway profile.** Nothing appears on screen, the pointer is
  never taken over, and the user's own Edge and profile are left alone. Edge
  picks a free debugging port (`--remote-debugging-port=0`) and reports it in
  the profile's `DevToolsActivePort`.
- **Theme.** The site takes its theme from `localStorage.theme`, then from
  `prefers-color-scheme` (`src/layouts/Layout.astro`). The driver sets both
  before the page's scripts run. Headless Edge otherwise follows the Windows
  theme, whatever `--force-dark-mode` says.
- **Clicks** go through `Input.dispatchMouseEvent`, so the page sees a
  trusted click at the element's centre.
- **Arguments** reach Windows' Node as base64-encoded JSON, since quotes do
  not survive WSL interop.
- Astro's dev toolbar is removed whenever it appears in the page.

## Pitfalls

- **A dev server started before new files were added can serve stale CSS.**
  Tailwind in `astro dev` did not pick up the classes of components created
  while it was running: the page rendered with some of their styles missing.
  After adding `.astro` files, restart it (`astro dev stop`, then
  `astro dev --background`), or shoot the production build: `astro build`,
  `astro preview --port 4322`, then `--base=http://localhost:4322`.
- A path that does not exist still loads Astro's 404 page and is shot; only
  a server that does not answer fails.
- `--selector` shoots the first match and notes how many there were.
