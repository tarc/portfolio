// Screenshots pages of the site in a headless Windows Edge, driven through
// the Chrome DevTools Protocol. Run by shot.sh with Windows' Node, which can
// reach the Edge it starts; see README.md.
//
// --config is base64-encoded JSON: {edge, base, urls, themes, viewports:
// [{name, width, height, mobile, scale}], selector, click, styles, pad, out}.
// Each URL is shot once per theme and viewport, in its own tab. Prints
// saved=NAME for each PNG written to out, style lines for --styles, and FAIL
// lines on errors.
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {withEdge} from './lib/edge.mjs';
import {openPage} from './lib/page.mjs';
import {readConfig} from './lib/util.mjs';

const config = readConfig();

let failures = 0;
try {
    await withEdge(config.edge, async cdp => {
        for (const url of config.urls) {
            for (const theme of config.themes) {
                for (const viewport of config.viewports) {
                    const element = config.selector ? `-${config.selector.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'element'}` : '';
                    const label = `${slug(url)}${element}${config.visible && !config.selector ? '-visible' : ''}-${theme}-${viewport.name}`;
                    try {
                        await shoot(cdp, url, theme, viewport, label);
                    } catch (error) {
                        failures++;
                        console.log(`FAIL ${label}: ${error.message}`);
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

async function shoot(cdp, url, theme, viewport, label) {
    const page = await openPage(cdp, new URL(url, config.base).href, {viewport, theme});
    try {
        if (config.click) await page.click(config.click);

        if (config.styles.length) {
            const selector = config.selector || 'body';
            const values = await page.evaluate(`(() => {
                const e = document.querySelector(${JSON.stringify(selector)});
                if (!e) return null;
                const style = getComputedStyle(e);
                return ${JSON.stringify(config.styles)}.map(p => p + '=' + style.getPropertyValue(p));
            })()`);
            if (!values) throw new Error(`no element matches ${selector}`);
            console.log(`style ${label} ${selector}: ${values.join('; ')}`);
        }

        let clip;
        if (config.selector) {
            clip = await page.evaluate(`(() => {
                const matches = document.querySelectorAll(${JSON.stringify(config.selector)});
                if (!matches.length) return null;
                const r = matches[0].getBoundingClientRect(), pad = ${config.pad};
                const x = Math.max(0, r.left + scrollX - pad), y = Math.max(0, r.top + scrollY - pad);
                return {x, y, width: r.right + scrollX + pad - x, height: r.bottom + scrollY + pad - y, count: matches.length};
            })()`);
            if (!clip) throw new Error(`no element matches ${config.selector}`);
            if (clip.count > 1) console.log(`note ${label}: ${clip.count} elements match ${config.selector}; shot the first`);
            delete clip.count;
        }
        // --visible: what the screen shows, after --click has scrolled it, for
        // example.
        const png = await page.screenshot({clip, visible: config.visible && !config.selector});
        await writeFile(join(config.out, `${label}.png`), png);
        console.log(`saved=${label}.png`);
    } finally {
        await page.close();
    }
}

function slug(url) {
    const path = new URL(url, config.base).pathname.replace(/^\/+|\/+$/g, '');
    return path.replace(/[^a-z0-9]+/gi, '-') || 'home';
}
