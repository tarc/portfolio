// Waits until a page is ready to be looked at.
import {sleep, until} from './util.mjs';

// Loaded, fonts in, and two frames painted. steady: also every image loaded
// and decoded, lazy ones included, so two shots of the same page match.
export async function settle(evaluate, {steady = false} = {}) {
    await until('the page to load', () => evaluate(`document.readyState === 'complete'`));
    if (steady) await evaluate(`Promise.all([...document.images].map(img => {
        img.loading = 'eager';
        return img.decode().catch(() => {});
    }))`);
    await evaluate(`document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`);
    await sleep(200);
}

// For steady pages, before the site's own scripts run: no animations,
// transitions or blinking caret, which a screenshot would catch mid-way.
export const steadyScript = `document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }';
    document.head.append(style);
});`;
