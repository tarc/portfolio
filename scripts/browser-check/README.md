# Browser checks from WSL2

Screenshots of the site as a real browser renders it, and layout rules
checked on every page at four screen sizes, both taken from WSL2 with
the Microsoft Edge installed on Windows. The approach follows FactorSeal's
`scripts/windows-desktop-check` (browser-check): the browser is driven
through the Chrome DevTools Protocol by a script that runs under Windows'
Node.

| Script | Runs on | What it does |
| --- | --- | --- |
| `shot.sh [options] PATH_OR_URL...` | WSL | Checks the server answers, finds Edge and Windows' Node, and runs `shot.mjs`. Prints the path of every PNG it saved. `shot.sh` with no arguments lists the options. |
| `shot.mjs --config=BASE64` | Windows (Node) | Starts a headless Edge with a throwaway profile, then shoots each URL once per theme and viewport in its own tab, optionally clicking an element first and printing computed styles. Closes Edge and deletes the profile when done. |
| `check-layout.sh [options]` | WSL | Builds the site, serves the build on :4322, runs `check-layout.mjs`, stops the server. `check-layout.sh --help` lists the options. |
| `check-layout.mjs --config=BASE64` | Windows (Node) | Applies the rules in `rules.mjs` to every page at each screen size; prints failures, each with a screenshot. |

Also available as `just shot ...` and `just check-layout ...` (inside
`devenv shell`).

The parts other tools can reuse live in `lib/`:

| File | Contents |
| --- | --- |
| `common.sh` | Shell side: finds Edge and Windows' Node, checks the server answers, runs a driver under Windows' Node with its config. |
| `edge.mjs` | `withEdge(path, use)`: a headless Edge with a throwaway profile, closed and deleted afterwards. The only Windows-specific part. |
| `cdp.mjs` | The DevTools Protocol connection: `send` with a timeout, events. |
| `page.mjs` | `openPage(cdp, url, {viewport, theme})`: a new tab at that size and theme, loaded and settled, with `evaluate`, `click`, `screenshot` and `close`. |
| `settle.mjs` | Waits for the page to load, its fonts, and two painted frames. |
| `util.mjs` | `sleep`, `until`, and reading the `--config` argument. |
| `measure.mjs` | The script injected into the page to measure elements (position, font size, line count, corner radii) and to draw a failure's witness (frames, label, arrows) over the page. |
| `layout.mjs` | The rule vocabulary `rules.mjs` is written in. |
| `preview.mjs` | Serves `dist/` on a port until stopped (WSL side, for `check-layout.sh`). |

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

## Layout checks

```sh
just check-layout                                  # build, serve on :4322, check, stop
just check-layout --base=http://localhost:4321     # the running dev server instead
just check-layout --pages=home,blog --viewports=phone-390 --verbose
just check-layout --pending                        # also the rules awaiting a decision
```

Pages: home, blog, bio, and every post linked from the blog list (so a new
post is checked without touching the rules). Sizes: `phone-320` (320×640),
`phone-390` (390×844), `tablet-768` (768×1024), `desktop-1280` (1280×800).
Light theme unless `--themes=dark|both`; geometry does not depend on it.
About 20 s for all 32 page × size combinations.

Output is failures only (`--verbose` adds passes), then a summary; the exit
status is 1 on any failure. Each failure also gets a witness picture in
`/tmp/portfolio-checks`, named `<page>-<size>-<rule id>.png`: the page
cropped to the failure, with the offending elements framed in red and a
label (rule, size, what was measured) with an arrow to each frame (to the
first only, when there are more than three). An overflow also shows the
screen edge as a dashed line, with the page captured wider than the screen
so what runs past it is visible; a gap between two elements shows as a
dimension line. A jump's picture is what the screen shows after the click.
A rule compared across pages (`sameAcrossPages`) is pictured on the pages
away from what most pages share. Pictures are at twice the CSS pixel size.

```
FAIL  home  tablet-768    H1 #hero h1 font ≥ 1.2 × main h2: 69.1px vs 72px (0.96×)
        → /tmp/portfolio-checks/home-tablet-768-H1.png
FAIL  32 pages×sizes, 2382 checks: 2381 passed, 1 failed
```

### Rules

`rules.mjs` maps rule ids (as in the output) to rules, per page:
`everyPage({...})`, `page(name, path, {...})`, and `posts(listPath,
linkSelector, {...})` for every post the list links to. Its default export
is enforced; `pending` holds rules that fail on the current site until the
user decides whether to fix the site or change the rule, run with
`--pending`.

| Rule | Passes when |
| --- | --- |
| `noOverflow()` | The page is no wider than the screen. On failure it names the elements whose text or box runs past the edge (content inside a scrolling box does not count). |
| `fitsScreen(sel)` | Matched elements lie fully inside the screen width. |
| `larger(a, b, ratio)` | a's font (the smallest if several) ≥ `ratio` × the largest font among b. |
| `noOverlap(container, a, b, {gap})` | Inside each container, the contents of a and b (the text, not the padding) don't intersect and are ≥ `gap` px apart. |
| `stacked(a, b, …, {gap})` | The first match of each, top to bottom, with ≥ `gap` px between. |
| `beside(a, b)` | b is to the right of a, level with it. |
| `maxLines(sel, n)` | Each match's text takes at most `n` lines (content height ÷ line height). |
| `oneRow(sel)` | All matches sit on one row (their vertical extents overlap): nothing wrapped onto a line of its own. |
| `sameRowSameHeight(sel)` | Matches whose tops line up (a row of cards) are equally tall. |
| `square(sel)` / `rounded(sel)` | Every corner radius is 0 / above 0. Hidden elements count too. |
| `alignedRight(sel, column)` | Each match's right edge lines up with the column's. |
| `jumpLandsBelowHeader(link, target)` | After a real click on link, target starts below the sticky header and at most 80 px under it, or further down only when the page is scrolled to its end (a short last section cannot reach the top). |
| `sameAcrossPages(sel, {below})` | The distance from the bottom of below to the top of sel is the same on every page. |

Every rule takes `{only: ['phone-320', ...]}` to limit it to some sizes.
Every selector must match at least one visible element, or the check fails,
so a renamed class cannot make a rule pass by checking nothing; wrap a
selector in `maybe()` when matching nothing is fine (a post without a
subtitle). Tolerances: ratios 1%, equal positions and sizes 2 px, minimum
distances 0.5 px.

Match on structure (`article > h1`, `time`) or on a `data-check="..."`
attribute added for the purpose (`nav-links`, `subtitle`, `user-turn`,
`thinking`), not
on style classes that a restyle would change.

To add a rule: put it under a new id in `rules.mjs`, with a comment naming
the problem it guards against; run `just check-layout --verbose` and check
its PASS lines measure what you meant; then break the page on purpose (see
below) and see it fail. Never loosen a rule to make it pass without the
user's say.

### Mutation tests

Each past bug put back by hand, one at a time, against the build (with
`--pending`, compared with a run on the unchanged site):

| Change | Failed (new, vs the unchanged site) |
| --- | --- |
| Header in one row (no `flex-wrap`, no `order-last`) | G2 on every page at 320 and 390 px (links and icons past the edge), G1 on every page at 320/390 not already failing |
| Card title room `pr-28` → `pr-20` | B2 at 320, 390 and 1280 px (at 768 px it fails already) |
| Home headline back to `9vw` on phones | H1 at 320 px (28.8 vs 48 px) and 390 px (35.1 vs 48 px), and at 768 px |
| `pt-12` on the blog post only | G3 at 320 and 390 px (posts 48 px, others 64 px) |
| No `scroll-mt-12` | H2 at 320 and 390 px (heading under the header) |
| `rounded-md` on Explore Projects | H3 at every size |
| No `mt-4` on the post date | P2 on every post at every size (0 px gap) |
| Chat bubble `rounded-none` | P4 at every size |

Run 2026-09-28 in a cloud session, on Linux Chromium (the Edge driver code
with Linux's Node and Playwright's Chromium in its place), not yet on
Windows Edge.

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
