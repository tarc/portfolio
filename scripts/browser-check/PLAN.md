# Plan: layout checks and visual comparison for the site

Status: planned 2026-09-27; steps 1–5 done (2026-09-28), all first-run
findings fixed; check-layout confirmed on Windows Edge. Step 6, the first
check-visual run on the user's machine, remains.
Fold into README.md or delete once done.

Four items: shared browser code, a rule checker, proof that the rules catch
real regressions, and an optional screenshot comparison.

Found while planning: between phone and desktop widths the home headline is
smaller than the section headings (650px wide: 58.5px vs 60px; 780px: 70.2px
vs 72px). The first real run is expected to fail there (see step 3).

## Decisions

Decided 2026-09-27; each took the recommended (first) option:

1. What to check by default: a fresh build served on :4322 (recommended),
   or the running dev server. → **Fresh build on :4322.**
2. Headline rule is 1.2× at every width, so tablet widths fail today: fix the
   headline's sizing between `sm` and `lg` (recommended), or require the
   rule only on phones and desktop. → **Fix the headline's sizing.**
3. Screen sizes: 320, 390, 768, 1280 (recommended), or also 1024.
   → **320, 390, 768, 1280.**
4. Visual reference screenshots: local in `.visual/` (recommended), or
   committed despite depending on the machine. → **Local in `.visual/`.**
5. Blog card date as `<time datetime>` (recommended, better markup and a
   stable hook), or keep `<p>` and add `data-check`. → **`<time datetime>`.**

---

## 1. Shared browser code

Goal: `shot`, `check-layout` and `check-visual` share the code for starting
Edge, opening pages and measuring. The browser start stays separable, so a
Linux Chromium could replace it for CI later (CI itself out of scope).

Files in `scripts/browser-check/`:

| File | Contents |
| --- | --- |
| `lib/edge.mjs` | Start headless Edge with a throwaway profile and a free port (`--remote-debugging-port=0`, `DevToolsActivePort`), shut it down cleanly, delete the profile. The only Windows-specific part. |
| `lib/cdp.mjs` | DevTools Protocol connection: send with timeouts, events. |
| `lib/page.mjs` | `openPage(url, {viewport, theme})`: new tab, `Page.enable`, device metrics, `prefers-color-scheme` + `localStorage.theme`, page scripts, navigate, settle. Returns helpers: evaluate, click (trusted `Input.dispatchMouseEvent`), screenshot (full page / element / visible screen), close. |
| `lib/settle.mjs` | Predictable rendering: lazy images made eager and awaited with `decode()`, fonts ready, animations/transitions/caret off (injected CSS), dev toolbar removed via MutationObserver, two frames. Matters most for item 4. |
| `lib/common.sh` | Shared shell: find Edge and Windows' Node, base64 JSON config, check the server answers, start/stop `astro preview --port 4322` after `astro build`. |

`shot.mjs`/`shot.sh` become thin callers; options and behaviour unchanged
(verify by rerunning the README examples before and after).

Risk to check first: Windows' Node importing `./lib/*.mjs` through the
`\\wsl.localhost\…` path. Expected to work; fallback is bundling into one
script at run time.

Done 2026-09-27. The imports work. Also added `lib/util.mjs` (`sleep`,
`until`, `readConfig`). Still to add where first needed: the stabilising
parts of `settle.mjs` (eager lazy images, animations off; item 4) and
starting/stopping `astro preview` in `common.sh` (item 2). The README
examples plus a missing selector and a stopped server gave byte-identical
PNGs and the same messages and exit codes before and after.

## 2. The rule checker

### Running

```
just check-layout                                   # build, serve on :4322, check, stop
just check-layout --base=http://localhost:4321      # check the running dev server instead
just check-layout --pages=home,blog --viewports=phone-390 --verbose
```

- Default target: a fresh production build (what gets deployed; avoids the
  stale dev-server CSS trap).
- Sizes: `phone-320` (320×640), `phone-390` (390×844), `tablet-768`
  (768×1024), `desktop-1280` (1280×800).
- Theme: light by default (geometry does not depend on theme);
  `--themes=both` for dark too.
- Pages: home, blog list, Bio, and every post, discovered from the links on
  the blog list, so new posts are checked automatically.
- Speed: about 7 pages × 4 sizes = 28 loads in one Edge; estimate 20–40 s.

### Writing rules

One readable file, `scripts/browser-check/rules.mjs`:

```js
page('home', '/', [
  larger('#hero h1', 'section h2', 1.2),
  jumpLandsBelowHeader('nav a[href="/#projects"]', '#projects h2'),
  square('#hero a, #about a.inline-block, #about div:has(> img), #contact input, #contact textarea, #contact button'),
  sameRowSameHeight('#projects li'),
]);
```

An injected measuring script reads positions, font sizes, line counts
(height ÷ line-height) and corner radii from the rendered page; Node applies
the rules to those numbers.

| Rule | Meaning |
| --- | --- |
| `noOverflow()` | Page never wider than the screen (`scrollWidth ≤ clientWidth`). |
| `fitsScreen(sel)` | Matched elements lie fully inside the screen width. |
| `larger(a, b, ratio)` | a's font ≥ `ratio` × the largest font among b. |
| `noOverlap(container, a, b, {gap})` | Inside each container, a and b don't intersect and are ≥ `gap` px apart. |
| `stacked(a, b, c…, {gap})` | Top-to-bottom order with ≥ `gap` between. |
| `maxLines(sel, n)` | Text takes at most `n` lines. |
| `sameRowSameHeight(items)` | Cards in the same row have equal height. |
| `square(sel)` / `rounded(sel)` | Corner radius 0 / above 0. |
| `jumpLandsBelowHeader(link, target)` | After clicking, target starts below the sticky header and ≤ 80 px below it. |
| `sameAcrossPages(sel, measure)` | Cross-page, e.g. header-to-first-heading gap equal on all pages (±2 px). |

Options: `{only: ['phone-320', 'phone-390']}` to scope a rule to sizes.
Tolerances: 1% for ratios, 2 px for positions.

### The rules (one per problem fixed or decided on 2026-09-27)

Every page, every size:
- **G1** `noOverflow()`: header running off phones.
- **G2** `fitsScreen('header nav a, header nav button')`; name, links and
  icons don't overlap.
- **G3** `sameAcrossPages`: first heading at the same height below the
  header on home, blog list, Bio and posts (the 48 vs 64 px mismatch).

Home:
- **H1** `larger('#hero h1', 'section h2', 1.2)`: inverted headline.
  Currently fails between phone and desktop widths.
- **H2** `jumpLandsBelowHeader` for PROJECTS, CONTACT and Explore Projects.
- **H3** `square(...)`: buttons, form fields, photo, project cards,
  thank-you panel.
- **H4** `sameRowSameHeight('#projects li')`: even card heights.
- **H5** phones: About photo below the text; `sm` and up: beside it.

Blog list:
- **B1** `larger('h1', 'li h2', 1.5)`: "GLOB" too close to card titles.
- **B2** `noOverlap('li', 'h2', <date>, {gap: 8})`: title running into date.
- **B3** cards square, same-row cards equal height.

Every post:
- **P1** `larger('article > h1', '.prose h2, .prose h3, <subtitle>', 1.25)`.
- **P2** `stacked('article > h1', <subtitle>, <date>, '.prose', {gap: 8})`:
  date squeezed against the title.
- **P3** `maxLines('article > h1', 3)` on phones, 2 on desktop.
- **P4** chat posts: user bubbles rounded and right-aligned with the text
  column; thinking line smaller than body text.

Bio:
- **Bio1** `larger('h1', 'h2', 1.5)`; Download CV button square.

Fragile selectors: change the blog card date from `<p class="absolute …">`
to `<time datetime="…">` and match on `time` (decision 5). Elsewhere, add
`data-check="…"` rather than relying on style classes.

### Output

```
FAIL  home  tablet-768   H1 headline ≥ 1.2 × section headings: 69.1px vs 72px (0.96×)
        → /tmp/portfolio-checks/home-tablet-768-H1.png
PASS  28 pages×sizes, 412 checks: 411 passed, 1 failed
```

Failures only by default (`--verbose` for passes); exit 1 on any failure;
each failure saves a screenshot with the offending elements outlined in red
(full page for overflow).

## 3. Proving the checks work

1. First run against the current site. H1 expected to fail at tablet widths.
   Any other findings go to the user to decide: fix the site, or loosen or
   scope the rule. Never adjust rules just to make them pass. Candidates:
   math too wide on phones in the Adjunctions post; long words in project
   descriptions.
2. Mutation tests: reintroduce past bugs one at a time, confirm the matching
   rule fails, restore with `git checkout -- <file>`:

   | Change | Expected failure |
   | --- | --- |
   | Header back to one row (drop `flex-wrap`, `order-last`) | G1, G2 |
   | Card title room `pr-28` → `pr-20` | B2 |
   | Home headline back to screen-width sizing on phones | H1 |
   | `pt-12` on the blog post only | G3 |
   | Remove `scroll-mt-12` | H2 |
   | `rounded-md` on one button | H3 |
   | Post title without `mt-4` on the date | P2 |

3. Record results of both in README.md.

Done 2026-09-28, on Linux Chromium in a cloud session (Edge unavailable
there; a run on Edge is still owed). The first run found, besides H1
(fixed: the headline wraps to two lines at `text-8xl` between `sm` and `lg`):

- G1 at 320 px: "ENGINEER" runs off the home page; the blog cards are
  wider than the screen (the word "BOOTSTRAPPING" plus the room kept for the
  date); the titles of "Bootstrapping This Portfolio" (also at 390 px) and
  "Adjunctions" run off; the Adjunctions display math was wider than the
  screen (fixed: display math scrolls sideways, `.katex-display` in
  global.css).
- B2 at 768 px: "BOOTSTRAPPING" runs into its card's date.
- G4 (added 2026-09-28 at the user's request) at 320 px: the header's
  "Bio" link wraps onto a row of its own, on every page.
- G3 from md up: the home headline is 64 px below the header, other pages'
  first headings 112 px. It holds on phones, where it is now enforced.

Fixed 2026-09-28 (G1 and B2 now enforced): post titles scale with the
screen below `sm` (`clamp(1.75rem,10vw,3rem)`, hyphenated as a last
resort) and their section headings with them; blog card dates sit on
their own line above the title; the home headline and section headings
scale on the narrowest phones (`min(18vw,3.75rem)`, `min(14vw,3rem)`).

Also fixed (G3 and G4 now enforced): the header links' gap on phones is
8 px instead of 12, so all five fit on one row at 320 px; the home hero
gets `md:pt-20`, so from md up its headline is 112 px below the header
like every other page's first heading. `pending` in rules.mjs is empty. Two measuring changes came out of the
first run: `noOverlap` compares text rather than padded boxes (a card
title's box includes the room kept for the date), and a jump to the last
section passes below the 80 px band when the page is scrolled to its end.
Starting the server uses Astro's `preview()` API (`lib/preview.mjs`),
since `astro preview` backgrounds itself when an AI agent runs it. Mutation tests are run by hand, not
   kept as a script (could become `just check-layout-selftest` later).

## 4. Screenshot comparison

Done 2026-09-28, tried on Linux Chromium (README.md, "Visual comparison").
Changes from the plan below: same means no differing pixel, not under 0.1%
(a threshold in percent hid a recoloured footer line on long pages; two
runs of an unchanged site match exactly); 64 shots (8 pages); the
comparison lives in `compare-visual.sh`, which runs without a browser.

```
just check-visual --record      # save current screenshots as the reference set
just check-visual               # compare against it, write a report
just check-visual --pages=blog --viewports=phone-390
```

A report, not a gate: exits 0 unless something breaks (no reference, no
server).

1. Full-page shots at the four sizes in both themes: about 7 × 4 × 2 = 56
   images, device scale 1.
2. Stored in gitignored `.visual/`: `reference/`, `latest/`, `diff/`,
   `report.html`. In the repo folder so references survive restarts; not
   committed, since font rendering depends on the machine and Windows/Edge
   versions (decision 4).
3. Comparison on the WSL side with ImageMagick (add `imagemagick` to
   `devenv.nix` packages):
   `magick compare -metric AE -fuzz 1% reference.png latest.png diff.png`.
   If heights differ, pad both to the same size first and report the size
   change (e.g. `2410 → 2460 px tall`).
4. Classes: `same` (< 0.1% of pixels), `changed` (with %), `new` (no
   reference), `missing` (page gone).
5. Terminal summary of changes only, plus `report.html` with reference,
   latest and diff side by side (open from Windows at
   `\\wsl.localhost\NixOS\home\tarci\projects\portfolio\.visual\report.html`).

```
visual: 56 shots — 53 same, 3 changed, 0 new
CHANGED  blog      phone-390  dark   4.8%   → .visual/diff/blog-phone-390-dark.png
CHANGED  blog      phone-390  light  4.8%
CHANGED  home      desktop    light  0.3%   height 2410 → 2460
report: .visual/report.html
```

Workflow: `--record` before a styling change if the reference set is not
current; after it, `check-layout` (pass/fail) then `check-visual` (review
what changed); `--record` again once accepted. Known noise: new posts, edited
text, the copyright year each January, Windows/Edge updates.

## Documentation and wiring

- `justfile`: `check-layout`, `check-visual` recipes with
  `[positional-arguments]`, like `shot`.
- `devenv.nix`: `imagemagick` in `packages`; update the `browser-check`
  skill description to mention layout checks and visual comparison.
- `scripts/browser-check/skill.md`: after any visual change run
  `just check-layout`, failures block; offer `just check-visual` when a
  change could have side effects; never loosen a rule without asking.
- `scripts/browser-check/README.md`: both tools, the rule vocabulary, adding
  a rule, mutation test results.
- `AGENTS.md`: one line next to the existing browser-check line.
- `.gitignore`: `.visual/`.

## Order of work and commits

1. Shared code; `shot` works exactly as before. Commit.
2. Rule checker and rules; first-run findings go to the user. Commit the
   checker with the passing rules; rules awaiting a decision stay out.
3. Approved fixes from the first run (e.g. tablet headline). Separate commit.
4. Mutation tests, results in the README. Commit with the docs.
5. Visual comparison, ImageMagick, report. Commit.
6. Record the first reference set (local), then a trial run after a small
   deliberate change to show the report works.
