// Serves the built site (dist/) on the port given as the only argument until
// stopped, for check-layout.sh. Astro's JavaScript API rather than
// `astro preview`: the command detects AI agents and then backgrounds itself,
// one server at a time, which would leave the script nothing to stop.
// Runs under WSL's Node, from the repository root.
import {preview} from 'astro';

const server = await preview({root: process.cwd(), server: {port: Number(process.argv[2])}, logLevel: 'error'});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.stop().then(() => process.exit(0)));
await server.closed();
