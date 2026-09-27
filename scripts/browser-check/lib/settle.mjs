// Waits until a page is ready to be looked at.
import {sleep, until} from './util.mjs';

// Loaded, fonts in, and two frames painted.
export async function settle(evaluate) {
    await until('the page to load', () => evaluate(`document.readyState === 'complete'`));
    await evaluate(`document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`);
    await sleep(200);
}
