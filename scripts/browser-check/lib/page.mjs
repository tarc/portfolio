// Opens a page of the site in a new tab, at a given screen size and theme.
import {settle} from './settle.mjs';

// viewport: {width, height, mobile, scale}; theme: 'light' or 'dark'.
// Resolves to helpers for the open tab; call close() when done.
export async function openPage(cdp, url, {viewport, theme}) {
    const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
    const close = () => cdp.send('Target.closeTarget', {targetId}).catch(() => {});
    try {
        const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
        const send = (method, params) => cdp.send(method, params, sessionId);
        const evaluate = async expression => {
            const {result, exceptionDetails} = await send('Runtime.evaluate',
                {expression, awaitPromise: true, returnByValue: true});
            if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
            return result.value;
        };

        // Scripts added with addScriptToEvaluateOnNewDocument run only once the
        // Page domain is enabled.
        await send('Page.enable');
        await send('Emulation.setDeviceMetricsOverride', {width: viewport.width, height: viewport.height,
            deviceScaleFactor: viewport.scale, mobile: viewport.mobile});
        // The site takes a theme from localStorage first, then from
        // prefers-color-scheme (Layout.astro); set both, before its scripts run.
        await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
        await send('Page.addScriptToEvaluateOnNewDocument',
            {source: `try { localStorage.setItem('theme', ${JSON.stringify(theme)}); } catch {}`});
        // The dev server's toolbar is not part of the site. It can be added
        // after the page has loaded, and its own styles win over a stylesheet
        // of ours, so it is removed whenever it appears.
        await send('Page.addScriptToEvaluateOnNewDocument', {source: `new MutationObserver(() => {
            for (const toolbar of document.querySelectorAll('astro-dev-toolbar')) toolbar.remove();
        }).observe(document, {childList: true, subtree: true});`});
        const {errorText} = await send('Page.navigate', {url});
        if (errorText) throw new Error(`Edge could not load ${url}: ${errorText}`);
        await settle(evaluate);

        return {
            send,
            evaluate,
            close,
            // A trusted click at the centre of the first element matching
            // selector, scrolled into view first.
            async click(selector) {
                const point = await evaluate(`(() => {
                    const e = document.querySelector(${JSON.stringify(selector)});
                    if (!e) return null;
                    e.scrollIntoView({block: 'center'});
                    const r = e.getBoundingClientRect();
                    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
                })()`);
                if (!point) throw new Error(`no element matches ${selector}`);
                for (const type of ['mousePressed', 'mouseReleased'])
                    await send('Input.dispatchMouseEvent', {type, x: point.x, y: point.y, button: 'left', clickCount: 1});
                await settle(evaluate);
            },
            // PNG as a Buffer. clip in page coordinates; without one, the
            // whole page. visible: only what the screen shows, where it is
            // scrolled to. scale: pixels per CSS pixel.
            async screenshot({clip, visible = false, scale = 1} = {}) {
                if (!clip) {
                    const {cssContentSize, cssVisualViewport: v} = await send('Page.getLayoutMetrics');
                    clip = visible
                        ? {x: v.pageX, y: v.pageY, width: v.clientWidth, height: v.clientHeight}
                        : {x: 0, y: 0, width: viewport.width, height: Math.ceil(cssContentSize.height)};
                }
                const {data} = await send('Page.captureScreenshot',
                    // Capturing beyond the viewport stretches it to the whole page, which
                    // unsticks the sticky header; visible must see the screen as it is.
                    {format: 'png', captureBeyondViewport: !visible, clip: {...clip, scale}});
                return Buffer.from(data, 'base64');
            },
        };
    } catch (error) {
        await close();
        throw error;
    }
}
