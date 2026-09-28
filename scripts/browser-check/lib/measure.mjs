// Reads positions, font sizes, line counts and corner radii from a rendered
// page. Only numbers come back; the rules in layout.mjs judge them in Node.

// Installed into the page once; every element measured gets a data-check-id,
// so a failing rule can outline exactly the elements it measured.
const script = `window.__check ||= (() => {
    let next = 0;
    const px = value => parseFloat(value) || 0;
    const box = element => {
        element.dataset.checkId ||= String(++next);
        const r = element.getBoundingClientRect(), s = getComputedStyle(element);
        const fontSize = px(s.fontSize);
        const lineHeight = s.lineHeight === 'normal' ? fontSize * 1.2 : px(s.lineHeight);
        // Where its content is drawn: the text, not the padding around it,
        // and a long word past the box's edge.
        const range = document.createRange();
        range.selectNodeContents(element);
        const i = range.getBoundingClientRect();
        const ink = i.width > 0 ? {left: i.left + scrollX, right: i.right + scrollX, top: i.top + scrollY, bottom: i.bottom + scrollY} : null;
        const content = r.height - px(s.paddingTop) - px(s.paddingBottom) - px(s.borderTopWidth) - px(s.borderBottomWidth);
        return {
            id: element.dataset.checkId,
            name: element.tagName.toLowerCase() + (element.id ? '#' + element.id : ''),
            text: element.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40),
            // Page coordinates; vtop/vbottom are relative to the screen.
            left: r.left + scrollX, right: r.right + scrollX,
            top: r.top + scrollY, bottom: r.bottom + scrollY,
            vtop: r.top, vbottom: r.bottom,
            width: r.width, height: r.height, ink,
            visible: r.width > 0 && r.height > 0 && s.visibility !== 'hidden',
            fontSize, lineHeight,
            lines: Math.max(1, Math.round(content / lineHeight)),
            radii: ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(c => px(s['border' + c + 'Radius'])),
        };
    };
    return {
        // Every element matching selector, in document order; with within,
        // one list per element matching within.
        measure(selector, within) {
            if (!within) return [...document.querySelectorAll(selector)].map(box);
            return [...document.querySelectorAll(within)].map(c => ({container: box(c), items: [...c.querySelectorAll(selector)].map(box)}));
        },
        screen() {
            const root = document.documentElement, width = root.clientWidth;
            // What sticks out on the right, to point at on overflow: the
            // elements holding text that runs past the screen (a long word
            // can overflow a box that itself fits), else the deepest elements
            // past it. Content a scrolling or clipping box hides does not count.
            const clipped = e => {
                for (let a = e.parentElement; a && a !== document.body; a = a.parentElement)
                    if (getComputedStyle(a).overflowX !== 'visible') return true;
                return false;
            };
            const out = new Set();
            const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const range = document.createRange();
            while (texts.nextNode()) {
                range.selectNodeContents(texts.currentNode);
                const r = range.getBoundingClientRect();
                const e = texts.currentNode.parentElement;
                if (r.width > 0 && r.right > width + 0.5 && !out.has(e) && !clipped(e)) out.add(e);
            }
            if (!out.size) for (const e of document.body.querySelectorAll('*')) {
                const r = e.getBoundingClientRect();
                if (r.width > 0 && r.right > width + 0.5 && !clipped(e)
                    && ![...e.children].some(c => c.getBoundingClientRect().right > width + 0.5)) out.add(e);
            }
            return {scrollWidth: root.scrollWidth, clientWidth: width, height: innerHeight,
                scrollY, maxScrollY: root.scrollHeight - innerHeight, out: [...out].slice(0, 5).map(box)};
        },
        mark(ids) {
            const style = document.getElementById('check-marks') || document.head.appendChild(Object.assign(document.createElement('style'), {id: 'check-marks'}));
            style.textContent = ids.length
                ? ids.map(id => '[data-check-id="' + id + '"]').join(',') + '{outline: 3px solid red !important; outline-offset: 1px}'
                : '';
        },
    };
})();`;

export async function install(page) {
    await page.evaluate(`${script} true`);
}

export const measure = (page, selector, within) =>
    page.evaluate(`window.__check.measure(${JSON.stringify(selector)}, ${JSON.stringify(within ?? null)})`);
export const screen = page => page.evaluate('window.__check.screen()');
export const mark = (page, ids) => page.evaluate(`window.__check.mark(${JSON.stringify(ids)})`);
