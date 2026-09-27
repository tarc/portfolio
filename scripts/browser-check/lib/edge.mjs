// Starts a headless Windows Edge for the DevTools Protocol. The only part
// tied to Windows: a Linux Chromium would need just another version of this.
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {connect} from './cdp.mjs';
import {sleep, until} from './util.mjs';

// Runs use(cdp) with a fresh Edge, then closes it and deletes its profile,
// whether use succeeds or throws.
export async function withEdge(executable, use) {
    // A fresh profile per run: no state (a theme picked by an earlier click, a
    // cache) carries over, and the user's own Edge and profile are left alone.
    // Port 0 lets Edge pick a free port and write it to DevToolsActivePort.
    const profile = await mkdtemp(join(tmpdir(), 'portfolio-shot-'));
    const edge = spawn(executable, [
        '--headless', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
        '--no-default-browser-check', '--remote-debugging-port=0',
        `--user-data-dir=${profile}`, 'about:blank',
    ], {stdio: 'ignore', windowsHide: true});

    let cdp;
    try {
        const port = await until('Edge to start with remote debugging', async () =>
            (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]);
        cdp = await connect(port);
        return await use(cdp);
    } finally {
        cdp?.close();
        edge.kill();
        // Edge holds files in the profile for a moment after it exits.
        for (let attempt = 0; attempt < 20; attempt++) {
            try { await rm(profile, {recursive: true, force: true}); break; } catch { await sleep(250); }
        }
    }
}
