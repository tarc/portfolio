// Reads positions, font sizes, line counts and corner radii from a rendered
// page. Only numbers come back; the rules in layout.mjs judge them in Node.
// Also draws the witness of a failure over the page for its screenshot.

// Installed into the page once. Every element measured gets a data-check-id,
// which tells elements apart.
// Runs in the page, not in Node: serialized by install().
function pageSide() {
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
            text: (element.innerText ?? element.textContent).trim().replace(/\s+/g, ' ').slice(0, 40),
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
            // outermost elements whose box runs past the screen, and the
            // elements whose text does though their box fits (a long word).
            // Content a scrolling or clipping box hides does not count.
            const clipped = e => {
                for (let a = e.parentElement; a && a !== document.body; a = a.parentElement)
                    if (getComputedStyle(a).overflowX !== 'visible') return true;
                return false;
            };
            const past = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > width + 0.5; };
            const out = new Set();
            for (const e of document.body.querySelectorAll('*'))
                if (past(e) && !past(e.parentElement) && !clipped(e)) out.add(e);
            const inside = e => [...out].some(o => o.contains(e));
            const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const range = document.createRange();
            while (texts.nextNode()) {
                range.selectNodeContents(texts.currentNode);
                const r = range.getBoundingClientRect();
                const e = texts.currentNode.parentElement;
                if (r.width > 0 && r.right > width + 0.5 && !inside(e) && !clipped(e)) out.add(e);
            }
            return {scrollWidth: root.scrollWidth, clientWidth: width, height: innerHeight,
                scrollY, maxScrollY: root.scrollHeight - innerHeight, out: [...out].slice(0, 5).map(box)};
        },
        // Draws a failure's witness over the page: a red frame around each
        // mark with the label pointing at the first, the screen edge
        // (dashed) and a measured distance. Returns the area to capture:
        // around the drawing, or the screen as it is scrolled (visible).
        annotate({marks, label, edge, span, visible}) {
            this.clear();
            const root = document.documentElement;
            const pageWidth = Math.max(root.scrollWidth, root.clientWidth), pageHeight = root.scrollHeight;
            const layer = document.createElement('div');
            layer.id = 'check-witness';
            layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none';
            const ns = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('width', pageWidth);
            svg.setAttribute('height', pageHeight);
            svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
            svg.innerHTML = '<defs><marker id="check-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#dc2626"/></marker></defs>';
            layer.append(svg);
            document.body.append(layer);
            const draw = (tag, attributes) => {
                const e = document.createElementNS(ns, tag);
                for (const [k, v] of Object.entries(attributes)) e.setAttribute(k, v);
                return svg.appendChild(e);
            };
            // Red on a white halo, so it shows on dark pages too.
            const stroke = (tag, attributes, extra = {}) => {
                draw(tag, {...attributes, fill: 'none', stroke: 'white', 'stroke-width': 7, 'stroke-linecap': 'round'});
                return draw(tag, {...attributes, fill: 'none', stroke: '#dc2626', 'stroke-width': 3, 'stroke-linecap': 'round', ...extra});
            };
            const pad = 6;
            const frames = marks.map(m => ({left: m.left - pad, top: m.top - pad, right: m.right + pad, bottom: m.bottom + pad}))
                .sort((a, b) => a.top - b.top || a.left - b.left);
            for (const f of frames) stroke('rect', {x: f.left, y: f.top, width: f.right - f.left, height: f.bottom - f.top, rx: 10});
            // What the label must stay clear of, and the crop must include.
            const around = [...frames];

            let edgeBox = null;
            if (edge != null) {
                const top = frames.length ? Math.min(...frames.map(f => f.top)) - 60 : 0;
                const bottom = frames.length ? Math.max(...frames.map(f => f.bottom)) + 60 : pageHeight;
                draw('line', {x1: edge, x2: edge, y1: top, y2: bottom, stroke: '#dc2626', 'stroke-width': 2, 'stroke-dasharray': '6 4'});
                const tag = draw('text', {x: edge - 4, y: bottom - 4, 'text-anchor': 'end', fill: '#dc2626', stroke: 'white', 'stroke-width': 3, 'paint-order': 'stroke', 'font-size': 11, 'font-family': 'sans-serif', 'font-weight': 'bold'});
                tag.textContent = 'screen edge';
                edgeBox = {left: edge - 80, right: edge + 10, top, bottom};
            }
            if (span && span.bottom > span.top) {
                const {x, top, bottom} = span;
                stroke('line', {x1: x, x2: x, y1: top + 1, y2: bottom - 1}, {'marker-start': 'url(#check-arrow)', 'marker-end': 'url(#check-arrow)'});
                for (const y of [top, bottom]) draw('line', {x1: x - 10, x2: x + 10, y1: y, y2: y, stroke: '#dc2626', 'stroke-width': 2});
                around.push({left: x - 12, right: x + 12, top, bottom});
            }

            // The label, next to the first frame (above it if there is room,
            // else below), with an arrow to each frame.
            const box = document.createElement('div');
            box.textContent = label;
            const width = Math.min(360, root.clientWidth - 16);
            box.style.cssText = `position:absolute;box-sizing:border-box;width:max-content;max-width:${width}px;padding:6px 9px;background:#dc2626;color:white;font:600 12px/1.35 system-ui,sans-serif;border:2px solid white;border-radius:6px;box-shadow:0 2px 8px rgb(0 0 0 / .35);white-space:pre-wrap;overflow-wrap:anywhere`;
            layer.append(box);
            const w = box.offsetWidth, h = box.offsetHeight, gap = 36;
            const target = frames[0] ?? around[0] ?? {left: 8, right: 8, top: scrollY + 8, bottom: scrollY + 8};
            // What sits level with the first frame: a span or edge beside it.
            const near = around.filter(f => f.top < target.bottom + 40 && target.top < f.bottom + 40);
            const all = near.length ? near : [target];
            const top = Math.min(...all.map(f => f.top)), bottom = Math.max(...all.map(f => f.bottom));
            const screenTop = visible ? scrollY : 0, screenBottom = visible ? scrollY + innerHeight : pageHeight;
            const above = top - gap - h >= screenTop + 4;
            const y = above ? top - gap - h : Math.min(bottom + gap, screenBottom - h - 4);
            const x = Math.max(8, Math.min(target.left, root.clientWidth - w - 8));
            box.style.left = x + 'px';
            box.style.top = y + 'px';
            // An arrow to each frame; with many, to the first only.
            for (const f of frames.length > 3 ? frames.slice(0, 1) : frames.length ? frames : [target]) {
                const below = f.top >= y + h;
                const fromX = Math.max(x + 12, Math.min((f.left + f.right) / 2, x + w - 12));
                const fromY = below ? y + h : f.bottom <= y ? y : y + h / 2;
                const toX = Math.max(f.left, Math.min(fromX, f.right));
                const toY = below ? f.top : f.bottom <= y ? f.bottom : (f.top + f.bottom) / 2;
                if (Math.hypot(toX - fromX, toY - fromY) > 8) stroke('line', {x1: fromX, y1: fromY, x2: toX, y2: toY}, {'marker-end': 'url(#check-arrow)'});
            }
            around.push({left: x, right: x + w, top: y, bottom: y + h});
            if (edgeBox) around.push(edgeBox);

            if (visible) return {x: scrollX, y: scrollY, width: root.clientWidth, height: innerHeight};
            // Full page width, and wider when something runs past the screen,
            // so the overflow shows; at least 240 px tall.
            const margin = 32;
            let y0 = Math.max(0, Math.min(...around.map(f => f.top)) - margin);
            let y1 = Math.min(pageHeight, Math.max(...around.map(f => f.bottom)) + margin);
            if (y1 - y0 < 240) { y0 = Math.max(0, y0 - (240 - (y1 - y0)) / 2); y1 = Math.min(pageHeight, y0 + 240); }
            // Near the top, start at the top, so the header shows whole.
            if (y0 < 160) y0 = 0;
            const x1 = Math.min(pageWidth, Math.max(root.clientWidth, ...around.map(f => f.right + margin)));
            return {x: 0, y: Math.floor(y0), width: Math.ceil(x1), height: Math.ceil(y1 - y0)};
        },
        clear() {
            document.getElementById('check-witness')?.remove();
        },
    };
}

export async function install(page) {
    await page.evaluate(`window.__check ||= (${pageSide})(); true`);
}

export const measure = (page, selector, within) =>
    page.evaluate(`window.__check.measure(${JSON.stringify(selector)}, ${JSON.stringify(within ?? null)})`);
export const screen = page => page.evaluate('window.__check.screen()');
export const annotate = (page, spec) => page.evaluate(`window.__check.annotate(${JSON.stringify(spec)})`);
export const clear = page => page.evaluate('window.__check.clear()');
