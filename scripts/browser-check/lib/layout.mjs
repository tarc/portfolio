// The vocabulary of rules.mjs. Each function returns a rule: a description,
// and run(ctx), which measures the open page and returns checks, each
// {ok, detail, marks, edge, span}: what the witness picture of a failure
// shows. marks are the boxes (page coordinates) to draw around, edge an x
// to draw the screen edge at, span a distance {x, top, bottom} to draw.
//
// A selector must match at least one visible element, or the check fails
// (a renamed class should not make a rule pass by checking nothing); wrap it
// in maybe() when matching nothing is fine.
import {measure, screen} from './measure.mjs';

const RATIO = 0.01;   // ratios may miss by 1%
const PX = 2;         // positions and sizes compared for equality may differ by 2 px
const EPS = 0.5;      // minimum distances allow for subpixel rounding

export const maybe = selector => ({selector, optional: true});
const selectorOf = s => s.selector ?? s;
const fmt = n => `${+n.toFixed(1)}px`;
const pass = (ok, detail, marks = [], extra = {}) => ({ok, detail, marks, ...extra});
// The box around an element and whatever of its text runs past it.
const withInk = e => e.ink ? {left: Math.min(e.left, e.ink.left), right: Math.max(e.right, e.ink.right),
    top: Math.min(e.top, e.ink.top), bottom: Math.max(e.bottom, e.ink.bottom)} : e;

// Visible elements matching s; a missing required one becomes a failed check.
async function find(page, s, checks) {
    const found = (await measure(page, selectorOf(s))).filter(e => e.visible);
    if (!found.length && !s.optional) checks.push(pass(false, `${selectorOf(s)} matches nothing visible`));
    return found;
}

// Options every rule takes: {only: ['phone-320', ...]} limits it to those
// screen sizes.
function rule(describe, options, run) {
    return {describe, only: options.only, visible: false, run, ...options.rule};
}

// The page is never wider than the screen.
export const noOverflow = (options = {}) => rule('page no wider than the screen', options, async ({page}) => {
    const s = await screen(page);
    const out = s.out.map(e => `${e.name} "${e.text}"`).join(', ');
    return [pass(s.scrollWidth <= s.clientWidth, `${s.scrollWidth}px wide on a ${s.clientWidth}px screen${out && `: ${out}`}`, s.out.map(withInk), {edge: s.clientWidth})];
});

// Matched elements lie fully inside the screen width.
export const fitsScreen = (selector, options = {}) => rule(`${selector} inside the screen`, options, async ({page}) => {
    const checks = [];
    const {clientWidth} = await screen(page);
    for (const e of await find(page, selector, checks))
        checks.push(pass(e.left >= -EPS && e.right <= clientWidth + EPS,
            `${e.name} "${e.text}" spans ${fmt(e.left)}–${fmt(e.right)} of ${clientWidth}px`, [e], {edge: clientWidth}));
    return checks;
});

// a's font (the smallest, if several match) ≥ ratio × the largest font among b.
export const larger = (a, b, ratio, options = {}) => rule(`${selectorOf(a)} font ≥ ${ratio} × ${selectorOf(b)}`, options, async ({page}) => {
    const checks = [];
    const as = await find(page, a, checks), bs = await find(page, b, checks);
    if (!as.length || !bs.length) return checks;
    const small = as.reduce((x, y) => y.fontSize < x.fontSize ? y : x);
    const big = bs.reduce((x, y) => y.fontSize > x.fontSize ? y : x);
    const actual = small.fontSize / big.fontSize;
    checks.push(pass(actual >= ratio * (1 - RATIO),
        `${fmt(small.fontSize)} vs ${fmt(big.fontSize)} (${actual.toFixed(2)}×)`, [small, big]));
    return checks;
});

// Inside each container, the contents of no a and b intersect, and they are
// ≥ gap px apart (horizontally or vertically): a heading's text, not its
// padding. a and b may be the same selector.
export const noOverlap = (container, a, b, {gap = 0, ...options} = {}) =>
    rule(`${a} and ${b} ≥ ${gap}px apart in each ${container}`, options, async ({page}) => {
        const checks = [];
        const groups = await measure(page, container);
        if (!groups.some(c => c.visible)) return [pass(false, `${container} matches nothing visible`)];
        const as = (await measure(page, a, container)), bs = (await measure(page, b, container));
        as.forEach(({container: c, items}, i) => {
            if (!c.visible) return;
            const left = items.filter(e => e.visible), right = bs[i].items.filter(e => e.visible);
            if (!left.length || !right.length) checks.push(pass(false, `no ${!left.length ? a : b} in ${c.name} "${c.text}"`, [c]));
            for (const x of left) for (const y of right) {
                if (x.id === y.id || (a === b && x.id > y.id)) continue;
                const [p, q] = [x.ink ?? x, y.ink ?? y];
                const apart = Math.max(q.left - p.right, p.left - q.right, q.top - p.bottom, p.top - q.bottom);
                checks.push(pass(apart >= gap - EPS, `"${x.text}" and "${y.text}" ${apart < 0 ? 'overlap' : fmt(apart) + ' apart'}`, [p, q]));
            }
        });
        return checks;
    });

// The first match of each selector, top to bottom, each ≥ gap px below the one
// before. Selectors wrapped in maybe() are skipped when absent.
export const stacked = (...args) => {
    const {gap = 0, ...options} = typeof args.at(-1) === 'object' && !args.at(-1).selector ? args.pop() : {};
    return rule(`${args.map(selectorOf).join(' above ')}, ≥ ${gap}px apart`, options, async ({page}) => {
        const checks = [];
        const found = [];
        for (const s of args) {
            const [first] = await find(page, s, checks);
            if (first) found.push(first);
        }
        for (let i = 1; i < found.length; i++) {
            const above = found[i - 1], below = found[i];
            const space = below.top - above.bottom;
            checks.push(pass(space >= gap - EPS, `${above.name} "${above.text}" to ${below.name} "${below.text}": ${fmt(space)}`, [above, below],
                {span: {x: Math.max(above.left, below.left) + 24, top: above.bottom, bottom: below.top}}));
        }
        return checks;
    });
};

// b stands to the right of a, level with it.
export const beside = (a, b, options = {}) => rule(`${b} to the right of ${a}`, options, async ({page}) => {
    const checks = [];
    const [x] = await find(page, a, checks), [y] = await find(page, b, checks);
    if (x && y) checks.push(pass(y.left >= x.right - EPS && y.top < x.bottom && x.top < y.bottom,
        `${a} at ${fmt(x.left)}–${fmt(x.right)} × ${fmt(x.top)}–${fmt(x.bottom)}, ${b} at ${fmt(y.left)}–${fmt(y.right)} × ${fmt(y.top)}–${fmt(y.bottom)}`, [x, y]));
    return checks;
});

// Each matched element's text takes at most n lines.
export const maxLines = (selector, n, options = {}) => rule(`${selector} at most ${n} lines`, options, async ({page}) => {
    const checks = [];
    for (const e of await find(page, selector, checks))
        checks.push(pass(e.lines <= n, `"${e.text}": ${e.lines} lines`, [e]));
    return checks;
});

// All matched elements sit on one row: their vertical extents overlap, so
// none has wrapped onto a line of its own.
export const oneRow = (selector, options = {}) => rule(`${selector} on one row`, options, async ({page}) => {
    const checks = [];
    const found = await find(page, selector, checks);
    if (found.length < 2) return checks;
    const [first] = found;
    for (const e of found.slice(1))
        checks.push(pass(e.top < first.bottom - EPS && first.top < e.bottom - EPS,
            `"${e.text}" at ${fmt(e.top)}–${fmt(e.bottom)}, "${first.text}" at ${fmt(first.top)}–${fmt(first.bottom)}`, [first, e]));
    return checks;
});

// Matched elements whose tops line up (a row of cards) have equal heights.
export const sameRowSameHeight = (selector, options = {}) => rule(`${selector} in a row equally tall`, options, async ({page}) => {
    const checks = [];
    const rows = [];
    for (const e of await find(page, selector, checks)) {
        const row = rows.find(r => Math.abs(r[0].top - e.top) <= PX);
        row ? row.push(e) : rows.push([e]);
    }
    for (const row of rows.filter(r => r.length > 1)) {
        const heights = row.map(e => e.height);
        checks.push(pass(Math.max(...heights) - Math.min(...heights) <= PX,
            `row at ${fmt(row[0].top)}: heights ${heights.map(fmt).join(', ')}`, row));
    }
    return checks;
});

// Corner radii: all 0 (square) or all above 0 (rounded). Hidden elements
// count too, e.g. the contact form's thank-you panel.
const corners = (want, test) => (selector, options = {}) => rule(`${selectorOf(selector)} ${want}`, options, async ({page}) => {
    const all = await measure(page, selectorOf(selector));
    if (!all.length) return selector.optional ? [] : [pass(false, `${selector} matches nothing`)];
    return all.map(e => pass(e.radii.every(test), `${e.name} "${e.text}": radii ${e.radii.map(fmt).join(' ')}`, [e]));
});
export const square = corners('square', r => r === 0);
export const rounded = corners('rounded', r => r > 0);

// Each matched element's right edge lines up with that of column's first match.
export const alignedRight = (selector, column, options = {}) => rule(`${selectorOf(selector)} flush right with ${column}`, options, async ({page}) => {
    const checks = [];
    const [c] = await find(page, column, checks);
    if (!c) return checks;
    for (const e of await find(page, selector, checks))
        checks.push(pass(Math.abs(e.right - c.right) <= PX, `"${e.text}" ends at ${fmt(e.right)}, ${column} at ${fmt(c.right)}`, [e, c]));
    return checks;
});

// After clicking link, target starts below the sticky header, at most 80 px
// below it; or further down if the page is scrolled to its end, as a last
// section can be too short to reach the top.
export const jumpLandsBelowHeader = (link, target, {header = 'body > header', ...options} = {}) =>
    rule(`${link} lands on ${target} below the header`, {...options, rule: {visible: true}}, async ({page}) => {
        await page.click(link);
        const checks = [];
        const [h] = await find(page, header, checks), [t] = await find(page, target, checks);
        const s = await screen(page);
        const atEnd = s.scrollY >= s.maxScrollY - 1;
        if (h && t) checks.push(pass(t.vtop >= h.vbottom - PX && (t.vtop <= h.vbottom + 80 || atEnd),
            `${target} at ${fmt(t.vtop)} on screen, header ends at ${fmt(h.vbottom)}${atEnd ? ', page scrolled to its end' : ''}`, [h, t]));
        return checks;
    });

// A value measured on every page, equal (±2 px) across pages at each screen
// size: the distance from the bottom of below to the top of selector.
export const sameAcrossPages = (selector, {below, ...options}) => ({
    describe: `${selector} top − ${below} bottom equal on every page`,
    only: options.only,
    across: true,
    async measure({page}) {
        const checks = [];
        const [b] = await find(page, below, checks), [e] = await find(page, selector, checks);
        return b && e ? {value: e.top - b.bottom, marks: [e], span: {x: e.left + 24, top: b.bottom, bottom: e.top}} : {checks};
    },
    // values: [{page, value}]. outliers: the pages away from the value
    // most pages share, whose witness pictures are taken.
    judge(values) {
        const numbers = values.map(v => v.value);
        const near = n => values.filter(v => Math.abs(v.value - n) <= PX);
        const common = numbers.reduce((a, b) => near(b).length > near(a).length ? b : a);
        return {...pass(Math.max(...numbers) - Math.min(...numbers) <= PX, values.map(v => `${v.page} ${fmt(v.value)}`).join(', ')),
            common, outliers: values.filter(v => Math.abs(v.value - common) > PX).map(v => v.page)};
    },
});

// What rules.mjs exports: a list of these. rules maps rule ids (G1, H2...)
// to a rule or a list of rules.
export const page = (name, path, rules) => ({name, path, rules});
// Every post linked from the list at path (links matching links), so new
// posts are checked without adding them here.
export const posts = (path, links, rules) => ({posts: {path, links}, rules});
export const everyPage = rules => ({everyPage: true, rules});
