// The pages of the site the checks visit, from the entries of rules.mjs:
// its page() entries, and every post linked from the list of a posts()
// entry, so a new post is covered without touching anything.
import {openPage} from './page.mjs';

// Resolves to [{name, path, post, rules: [[id, rule]]}]: each page with the
// everyPage() rules and its own. wanted: page names to keep (a post's slug,
// or posts for every post); empty keeps all. viewport: for opening the lists.
export async function findPages(cdp, entries, {base, viewport, wanted = []}) {
    const shared = entries.filter(r => r.everyPage).flatMap(r => flatten(r.rules));
    // Entries for the same page (or list of posts) are merged.
    const merged = new Map();
    for (const entry of entries.filter(r => !r.everyPage)) {
        const key = entry.posts ? `posts ${entry.posts.path}` : entry.name;
        const known = merged.get(key);
        merged.set(key, {...entry, rules: [...(known?.rules ?? []), ...flatten(entry.rules)]});
    }
    const pages = [];
    for (const entry of merged.values()) {
        if (entry.posts) {
            const list = await openPage(cdp, new URL(entry.posts.path, base).href, {viewport, theme: 'light'});
            try {
                const paths = await list.evaluate(`[...document.querySelectorAll(${JSON.stringify(entry.posts.links)})].map(a => new URL(a.href).pathname)`);
                if (!paths.length) throw new Error(`no links match ${entry.posts.links} on ${entry.posts.path}`);
                for (const path of paths)
                    pages.push({name: path.replace(/^\/+|\/+$/g, '').split('/').pop(), path, post: true, rules: [...shared, ...entry.rules]});
            } finally {
                await list.close();
            }
        } else {
            pages.push({name: entry.name, path: entry.path, rules: [...shared, ...entry.rules]});
        }
    }
    if (!wanted.length) return pages;
    const unknown = wanted.filter(w => w !== 'posts' && !pages.some(p => p.name === w));
    if (unknown.length) throw new Error(`no page named ${unknown.join(', ')}; pages: ${pages.map(p => p.name).join(', ')}, posts`);
    return pages.filter(p => wanted.includes(p.name) || (p.post && wanted.includes('posts')));
}

function flatten(byId) {
    return Object.entries(byId).flatMap(([id, r]) => (Array.isArray(r) ? r : [r]).map(rule => [id, rule]));
}
