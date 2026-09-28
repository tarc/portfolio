# Browser checks of the site from WSL2

Read `scripts/browser-check/README.md` for the options, how it works and the
pitfalls. This file is the order of work.

## Shoot

1. Make sure a server is up with the current code: `astro dev status`. If it
   was started before you created or renamed `.astro` files, restart it
   (`astro dev stop`, then `astro dev --background`); it can serve stale CSS.
2. Run `devenv shell -- just shot <path> [options]`, for example
   `just shot /blog/ --viewport=both`. It runs headless and takes over
   nothing, so there is no need to warn the user.
3. Read the PNGs it prints yourself instead of asking the user for
   screenshots. Check light and dark (the default) for any change to colours,
   borders or backgrounds, and `--viewport=mobile` for any change to layout.
4. For a detail such as a radius, a width or a colour, add
   `--selector=CSS --styles=PROP,...` and report the computed values it
   prints alongside the picture.

## Check the layout

After any visual change, also run `devenv shell -- just check-layout`. It
builds the site and checks the rules in `scripts/browser-check/rules.mjs` on
every page at 320, 390, 768 and 1280 px (about 20 s). A failure blocks the
change: read its screenshot (failing elements outlined in red), then fix
the site. Never loosen, scope or delete a rule to make it pass without
asking the user. When a change fixes a problem the rules don't cover, add a
rule for it (README.md, "Rules").

## Rules

- A visual change is reported as done only after it was seen in a shot;
  do not infer how a page looks from the classes alone.
- When you show the user a result, give the PNG paths and say what they show,
  including anything off that you noticed and did not change.
