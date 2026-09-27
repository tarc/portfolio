// Screenshots pages of the site in a headless Windows Edge, driven through
// the Chrome DevTools Protocol. Run by shot.sh with Windows' Node, which can
// reach the Edge it starts; see README.md.
//
// --config is base64-encoded JSON (quotes do not survive the trip through
// WSL interop): {edge, base, urls, themes, viewports: [{name, width, height,
// mobile, scale}], selector, click, styles, pad, out}. Each URL is shot once
// per theme and viewport, in its own tab. Prints saved=NAME for each PNG
// written to out, style lines for --styles, and FAIL lines on errors.
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.match(/^--([^=]+)=(.*)$/s).slice(1)));
const config = JSON.parse(Buffer.from(args.config, 'base64').toString('utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(what, condition, ms = 15000) {
    const deadline = Date.now() + ms;
    for (;;) {
        const value = await condition().catch(() => undefined);
        if (value) return value;
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await sleep(100);
    }
}

// A fresh profile per run: no state (a theme picked by an earlier click, a
// cache) carries over, and the user's own Edge and profile are left alone.
// Port 0 lets Edge pick a free port and write it to DevToolsActivePort.
const profile = await mkdtemp(join(tmpdir(), 'portfolio-shot-'));
const edge = spawn(config.edge, [
    '--headless', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank',
], {stdio: 'ignore', windowsHide: true});

let socket;
let failures = 0;
try {
    const port = await until('Edge to start with remote debugging', async () =>
        (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]);
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, {once: true});
        socket.addEventListener('error', reject, {once: true});
    });

    let nextId = 0;
    const calls = new Map();
    const events = new Set();
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        const call = calls.get(message.id);
        if (call) {
            calls.delete(message.id);
            if (message.error) call.reject(new Error(`${call.method}: ${message.error.message}`));
            else call.resolve(message.result);
        } else {
            for (const listener of events) listener(message);
        }
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => {
            calls.delete(id);
            reject(new Error(`${method} got no answer in 20 s`));
        }, 20000);
        calls.set(id, {method, resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); }});
        socket.send(JSON.stringify({id, method, params, sessionId}));
    });

    for (const url of config.urls) {
        for (const theme of config.themes) {
            for (const viewport of config.viewports) {
                const element = config.selector ? `-${config.selector.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'element'}` : '';
                const label = `${slug(url)}${element}${config.visible && !config.selector ? '-visible' : ''}-${theme}-${viewport.name}`;
                try {
                    await shoot(send, url, theme, viewport, label);
                } catch (error) {
                    failures++;
                    console.log(`FAIL ${label}: ${error.message}`);
                }
            }
        }
    }
} catch (error) {
    failures++;
    console.log(`FAIL ${error.message}`);
} finally {
    socket?.close();
    edge.kill();
    // Edge holds files in the profile for a moment after it exits.
    for (let attempt = 0; attempt < 20; attempt++) {
        try { await rm(profile, {recursive: true, force: true}); break; } catch { await sleep(250); }
    }
}
process.exit(failures ? 1 : 0);

async function shoot(send, url, theme, viewport, label) {
    const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
    const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
    try {
        const evaluate = async expression => {
            const {result, exceptionDetails} = await send('Runtime.evaluate',
                {expression, awaitPromise: true, returnByValue: true}, sessionId);
            if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
            return result.value;
        };
        // Scripts added with addScriptToEvaluateOnNewDocument run only once the
        // Page domain is enabled.
        await send('Page.enable', {}, sessionId);
        await send('Emulation.setDeviceMetricsOverride', {width: viewport.width, height: viewport.height,
            deviceScaleFactor: viewport.scale, mobile: viewport.mobile}, sessionId);
        // The site takes a theme from localStorage first, then from
        // prefers-color-scheme (Layout.astro); set both, before its scripts run.
        await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]}, sessionId);
        await send('Page.addScriptToEvaluateOnNewDocument',
            {source: `try { localStorage.setItem('theme', ${JSON.stringify(theme)}); } catch {}`}, sessionId);
        // The dev server's toolbar is not part of the site. It can be added
        // after the page has loaded, and its own styles win over a stylesheet
        // of ours, so it is removed whenever it appears.
        await send('Page.addScriptToEvaluateOnNewDocument', {source: `new MutationObserver(() => {
            for (const toolbar of document.querySelectorAll('astro-dev-toolbar')) toolbar.remove();
        }).observe(document, {childList: true, subtree: true});`}, sessionId);
        const {errorText} = await send('Page.navigate', {url: new URL(url, config.base).href}, sessionId);
        if (errorText) throw new Error(`Edge could not load ${new URL(url, config.base).href}: ${errorText}`);
        await settle(evaluate);

        if (config.click) {
            const point = await center(evaluate, config.click);
            for (const type of ['mousePressed', 'mouseReleased'])
                await send('Input.dispatchMouseEvent', {type, x: point.x, y: point.y, button: 'left', clickCount: 1}, sessionId);
            await settle(evaluate);
        }

        if (config.styles.length) {
            const selector = config.selector || 'body';
            const values = await evaluate(`(() => {
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
            clip = await evaluate(`(() => {
                const matches = document.querySelectorAll(${JSON.stringify(config.selector)});
                if (!matches.length) return null;
                const r = matches[0].getBoundingClientRect(), pad = ${config.pad};
                const x = Math.max(0, r.left + scrollX - pad), y = Math.max(0, r.top + scrollY - pad);
                return {x, y, width: r.right + scrollX + pad - x, height: r.bottom + scrollY + pad - y, count: matches.length};
            })()`);
            if (!clip) throw new Error(`no element matches ${config.selector}`);
            if (clip.count > 1) console.log(`note ${label}: ${clip.count} elements match ${config.selector}; shot the first`);
            delete clip.count;
        } else if (config.visible) {
            // What the screen shows: the viewport at its current scroll position,
            // after --click has scrolled it, for example.
            const {cssVisualViewport: v} = await send('Page.getLayoutMetrics', {}, sessionId);
            clip = {x: v.pageX, y: v.pageY, width: v.clientWidth, height: v.clientHeight};
        } else {
            const {cssContentSize} = await send('Page.getLayoutMetrics', {}, sessionId);
            clip = {x: 0, y: 0, width: viewport.width, height: Math.ceil(cssContentSize.height)};
        }
        const {data} = await send('Page.captureScreenshot',
            // Capturing beyond the viewport stretches it to the whole page, which
            // unsticks the sticky header; --visible must see the screen as it is.
            {format: 'png', captureBeyondViewport: !(config.visible && !config.selector), clip: {...clip, scale: 1}}, sessionId);
        await writeFile(join(config.out, `${label}.png`), Buffer.from(data, 'base64'));
        console.log(`saved=${label}.png`);
    } finally {
        await send('Target.closeTarget', {targetId}).catch(() => {});
    }
}

// Loaded, fonts in, and two frames painted.
async function settle(evaluate) {
    await until('the page to load', () => evaluate(`document.readyState === 'complete'`));
    await evaluate(`document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`);
    await sleep(200);
}

async function center(evaluate, selector) {
    const point = await evaluate(`(() => {
        const e = document.querySelector(${JSON.stringify(selector)});
        if (!e) return null;
        e.scrollIntoView({block: 'center'});
        const r = e.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    })()`);
    if (!point) throw new Error(`no element matches ${selector}`);
    return point;
}

function slug(url) {
    const path = new URL(url, config.base).pathname.replace(/^\/+|\/+$/g, '');
    return path.replace(/[^a-z0-9]+/gi, '-') || 'home';
}
