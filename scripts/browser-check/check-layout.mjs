// Checks the layout rules in rules.mjs on every page of the site, at each
// screen size, in a headless Windows Edge. Run by check-layout.sh with
// Windows' Node; see README.md.
//
// --config is base64-encoded JSON: {edge, base, out, pages, viewports:
// [{name, width, height, mobile, scale}], themes, verbose, pending}; pending
// adds the rules awaiting a decision. pages lists the
// page names to check (home, blog, bio, a post's slug, or posts for every
// post); empty means all. Prints a FAIL line per failed check with shot=NAME
// for its screenshot in out, PASS lines with verbose, then a summary. Exits
// 1 if any check failed.
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {withEdge} from './lib/edge.mjs';
import {install, mark} from './lib/measure.mjs';
import {openPage} from './lib/page.mjs';
import {readConfig} from './lib/util.mjs';
import rules, {pending} from './rules.mjs';

const config = readConfig();
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
                                else across.set(key, [...(across.get(key) ?? []), {page: target.name, value, where: `${'*'.padEnd(width)}  ${viewport.name.padEnd(12)}${config.themes.length > 1 ? ` ${theme.padEnd(5)}` : ''}`, id, rule}]);
                                continue;
                            }
                            let results;
                            try {
                                results = await rule.run({page, viewport});
                            } catch (error) {
                                results = [{ok: false, detail: error.message, ids: []}];
                            }
                            const failed = results.filter(r => !r.ok);
                            for (const r of results) report(r.ok, where, id, rule, r.detail);
                            if (failed.length) await shoot(page, rule, failed.flatMap(r => r.ids), `${label}-${id}`);
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
        }
    });
} catch (error) {
    errors++;
    console.log(`FAIL  ${error.message}`);
}
const bad = failed + errors;
console.log(`${bad ? 'FAIL' : 'PASS'}  ${loads} pages×sizes, ${checks} checks: ${checks - failed} passed, ${failed} failed${errors ? `; ${errors} errors` : ''}`);
process.exit(bad ? 1 : 0);

// The pages to check, each {name, path, rules: [[id, rule]]}, with posts
// found by opening the list that links them.
async function pagesToCheck(cdp) {
    const entries = [...rules, ...(config.pending ? pending : [])];
    const shared = entries.filter(r => r.everyPage).flatMap(r => flatten(r.rules));
    // Entries for the same page (or list of posts) are merged.
    const merged = new Map();
    for (const entry of entries.filter(r => !r.everyPage)) {
        const key = entry.posts ? `posts ${entry.posts.path}` : entry.name;
        const known = merged.get(key);
        merged.set(key, {...entry, rules: [...(known?.rules ?? []), ...flatten(entry.rules)]});
    }
    const targets = [];
    for (const entry of merged.values()) {
        if (entry.posts) {
            const list = await openPage(cdp, new URL(entry.posts.path, config.base).href, {viewport: config.viewports[0], theme: 'light'});
            try {
                const paths = await list.evaluate(`[...document.querySelectorAll(${JSON.stringify(entry.posts.links)})].map(a => new URL(a.href).pathname)`);
                if (!paths.length) throw new Error(`no links match ${entry.posts.links} on ${entry.posts.path}`);
                for (const path of paths)
                    targets.push({name: path.replace(/^\/+|\/+$/g, '').split('/').pop(), path, post: true, rules: [...shared, ...entry.rules]});
            } finally {
                await list.close();
            }
        } else {
            targets.push({name: entry.name, path: entry.path, rules: [...shared, ...entry.rules]});
        }
    }
    const wanted = config.pages;
    if (!wanted.length) return targets;
    const chosen = targets.filter(t => wanted.includes(t.name) || (t.post && wanted.includes('posts')));
    const unknown = wanted.filter(w => w !== 'posts' && !targets.some(t => t.name === w));
    if (unknown.length) throw new Error(`no page named ${unknown.join(', ')}; pages: ${targets.map(t => t.name).join(', ')}, posts`);
    return chosen;
}

function flatten(byId) {
    return Object.entries(byId).flatMap(([id, r]) => (Array.isArray(r) ? r : [r]).map(rule => [id, rule]));
}

// Screenshot with the failing elements outlined in red: what the screen shows
// for rules that scroll (jumps), else the whole page.
async function shoot(page, rule, ids, name) {
    try {
        await mark(page, [...new Set(ids)]);
        await writeFile(join(config.out, `${name}.png`), await page.screenshot({visible: rule.visible}));
        await mark(page, []);
        console.log(`        → shot=${name}.png`);
    } catch (error) {
        console.log(`        (no screenshot: ${error.message})`);
    }
}
