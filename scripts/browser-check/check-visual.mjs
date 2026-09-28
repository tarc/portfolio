// Screenshots every page of the site, whole, at each screen size and theme,
// for check-visual.sh to compare with the reference set. Run by
// check-visual.sh with Windows' Node; see README.md.
//
// --config is base64-encoded JSON: {edge, base, out, pages, viewports:
// [{name, width, height, mobile, scale}], themes}. pages as in
// check-layout.mjs. Writes <page>-<size>-<theme>.png to out and prints
// saved=NAME for each, FAIL lines on errors; exits 1 if any shot failed.
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {withEdge} from './lib/edge.mjs';
import {openPage} from './lib/page.mjs';
import {findPages} from './lib/pages.mjs';
import {readConfig} from './lib/util.mjs';
import rules from './rules.mjs';

const config = readConfig();
let failures = 0;

try {
    await withEdge(config.edge, async cdp => {
        const pages = await findPages(cdp, rules, {base: config.base, viewport: config.viewports[0], wanted: config.pages});
        for (const {name, path} of pages) {
            for (const viewport of config.viewports) {
                for (const theme of config.themes) {
                    const file = `${name}-${viewport.name}-${theme}.png`;
                    let page;
                    try {
                        page = await openPage(cdp, new URL(path, config.base).href, {viewport, theme, steady: true});
                        await writeFile(join(config.out, file), await page.screenshot());
                        console.log(`saved=${file}`);
                    } catch (error) {
                        failures++;
                        console.log(`FAIL ${file}: ${error.message}`);
                    } finally {
                        await page?.close();
                    }
                }
            }
        }
    });
} catch (error) {
    failures++;
    console.log(`FAIL ${error.message}`);
}
process.exit(failures ? 1 : 0);
