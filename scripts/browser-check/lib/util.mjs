// Small helpers shared by the drivers that run under Windows' Node.

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function until(what, condition, ms = 15000) {
    const deadline = Date.now() + ms;
    for (;;) {
        const value = await condition().catch(() => undefined);
        if (value) return value;
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await sleep(100);
    }
}

// --config=BASE64 from common.sh: JSON, base64-encoded because quotes do not
// survive the trip through WSL interop.
export function readConfig(argv = process.argv.slice(2)) {
    const args = Object.fromEntries(argv.map(a => a.match(/^--([^=]+)=(.*)$/s).slice(1)));
    return JSON.parse(Buffer.from(args.config, 'base64').toString('utf8'));
}
