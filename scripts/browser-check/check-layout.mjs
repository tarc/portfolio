// Checks the layout rules in rules.mjs on every page of the site, at each
// screen size, in a headless Windows Edge. Run by check-layout.sh with
// Windows' Node; see README.md.
//
// --config is base64-encoded JSON: {edge, base, out, pages, viewports:
// [{name, width, height, mobile, scale}], themes, verbose, pending}; pending
// adds the rules awaiting a decision. pages lists the
// page names to check (home, blog, bio, a post's slug, or posts for every
// post); empty means all. Prints a FAIL line per failed check with shot=NAME
// for its witness picture in out (the failure drawn over the page), PASS
// lines with verbose, then a summary. Exits
// 1 if any check failed.
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {withEdge} from './lib/edge.mjs';
import {annotate, clear, install} from './lib/measure.mjs';
import {openPage} from './lib/page.mjs';
import {findPages} from './lib/pages.mjs';
import {readConfig} from './lib/util.mjs';
import rules, {pending} from './rules.mjs';

const config = readConfig();
const px = n => `${+n.toFixed(1)}px`;
let checks = 0, failed = 0, errors = 0, loads = 0;

try {
    await withEdge(config.edge, async cdp => {
        const targets = await pagesToCheck(cdp);
        const width = Math.max(...targets.map(t => t.name.length));
        const report = (ok, where, id, rule, detail) => {
            checks++;
            if (!ok) failed++;
            if (!ok || config.verbose)
                console.log(`${ok ? 'PASS' : 'FAIL'}  ${where}  ${id} ${rule.describe}: ${detail}`);
        };
        // Values of sameAcrossPages rules, by theme, size and rule.
        const across = new Map();

        for (const theme of config.themes) {
            for (const viewport of config.viewports) {
                for (const target of targets) {
                    const label = `${target.name}-${viewport.name}${config.themes.length > 1 ? `-${theme}` : ''}`;
                    const where = `${target.name.padEnd(width)}  ${viewport.name.padEnd(12)}${config.themes.length > 1 ? ` ${theme.padEnd(5)}` : ''}`;
                    let page;
                    try {
                        page = await openPage(cdp, new URL(target.path, config.base).href, {viewport, theme});
                        loads++;
                        await install(page);
                        for (const [id, rule] of target.rules) {
                            if (rule.only && !rule.only.includes(viewport.name)) continue;
                            await page.evaluate('scrollTo(0, 0)');
                            if (rule.across) {
                                const key = `${theme} ${viewport.name} ${id} ${rule.describe}`;
                                const {value, checks: missing} = await rule.measure({page});
                                if (missing) for (const c of missing) report(c.ok, where, id, rule, c.detail);
                                else across.set(key, [...(across.get(key) ?? []), {page: target.name, value, target, viewport, theme, id, rule,
                                    where: `${'*'.padEnd(width)}  ${viewport.name.padEnd(12)}${config.themes.length > 1 ? ` ${theme.padEnd(5)}` : ''}`}]);
                                continue;
                            }
                            let results;
                            try {
                                results = await rule.run({page, viewport});
                            } catch (error) {
                                results = [{ok: false, detail: error.message, marks: []}];
                            }
                            const failed = results.filter(r => !r.ok);
                            for (const r of results) report(r.ok, where, id, rule, r.detail);
                            if (failed.length) await shoot(page, rule, id, viewport, failed, `${label}-${id}`);
                        }
                    } catch (error) {
                        errors++;
                        console.log(`FAIL  ${where}  could not check ${target.path}: ${error.message}`);
                    } finally {
                        await page?.close();
                    }
                }
            }
        }

        for (const values of across.values()) {
            const {where, id, rule} = values[0];
            const r = rule.judge(values);
            report(r.ok, where, id, rule, r.detail);
            if (r.ok) continue;
            // Witnesses: the pages away from what most pages share.
            for (const {page: name, value, target, viewport, theme} of values.filter(v => r.outliers.includes(v.page))) {
                const others = values.filter(v => !r.outliers.includes(v.page)).map(v => v.page);
                const page = await openPage(cdp, new URL(target.path, config.base).href, {viewport, theme});
                try {
                    await install(page);
                    const {marks = [], span} = await rule.measure({page});
                    const detail = `${px(value)} here; ${px(r.common)} on ${others.length > 3 ? `${others.slice(0, 3).join(', ')} and ${others.length - 3} more` : others.join(', ')}`;
                    await shoot(page, rule, id, viewport, [{detail, marks, span}], `${name}-${viewport.name}${config.themes.length > 1 ? `-${theme}` : ''}-${id}`);
                } finally {
                    await page.close();
                }
            }
        }
    });
} catch (error) {
    errors++;
    console.log(`FAIL  ${error.message}`);
}
const bad = failed + errors;
console.log(`${bad ? 'FAIL' : 'PASS'}  ${loads} pages×sizes, ${checks} checks: ${checks - failed} passed, ${failed} failed${errors ? `; ${errors} errors` : ''}`);
process.exit(bad ? 1 : 0);

// The pages to check, each {name, path, post, rules: [[id, rule]]}.
function pagesToCheck(cdp) {
    return findPages(cdp, [...rules, ...(config.pending ? pending : [])],
        {base: config.base, viewport: config.viewports[0], wanted: config.pages});
}

// The witness of a rule's failures on the open page: the elements framed in
// red with a label pointing at them, the screen edge or a measured distance
// where the rule has one, cropped to that area (for jumps, what the screen
// shows after the click).
async function shoot(page, rule, id, viewport, failures, name) {
    const shown = failures.slice(0, 3).map(f => `• ${f.detail}`);
    if (failures.length > 3) shown.push(`• …and ${failures.length - 3} more`);
    const describe = rule.describe.length > 90 ? `${rule.describe.slice(0, 89)}…` : rule.describe;
    const label = `${id} at ${viewport.width}px: ${describe}\n${shown.join('\n')}`;
    try {
        const clip = await annotate(page, {
            marks: failures.flatMap(f => f.marks ?? []),
            edge: failures.find(f => f.edge != null)?.edge,
            span: failures.find(f => f.span)?.span,
            label, visible: rule.visible,
        });
        await writeFile(join(config.out, `${name}.png`), await page.screenshot({clip, visible: rule.visible, scale: 2}));
        await clear(page);
        console.log(`        → shot=${name}.png`);
    } catch (error) {
        console.log(`        (no picture: ${error.message})`);
    }
}
