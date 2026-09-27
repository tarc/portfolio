// A Chrome DevTools Protocol connection to the browser listening on port.
export async function connect(port) {
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, {once: true});
        socket.addEventListener('error', reject, {once: true});
    });

    let nextId = 0;
    const calls = new Map();
    const listeners = new Set();
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        const call = calls.get(message.id);
        if (call) {
            calls.delete(message.id);
            if (message.error) call.reject(new Error(`${call.method}: ${message.error.message}`));
            else call.resolve(message.result);
        } else {
            for (const listener of listeners) listener(message);
        }
    });

    return {
        // sessionId addresses a tab attached with Target.attachToTarget.
        send: (method, params = {}, sessionId) => new Promise((resolve, reject) => {
            const id = ++nextId;
            const timer = setTimeout(() => {
                calls.delete(id);
                reject(new Error(`${method} got no answer in 20 s`));
            }, 20000);
            calls.set(id, {method, resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); }});
            socket.send(JSON.stringify({id, method, params, sessionId}));
        }),
        // Events; returns a function that stops listening.
        on(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        close: () => socket.close(),
    };
}
