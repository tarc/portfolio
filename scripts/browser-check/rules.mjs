// The layout rules check-layout.mjs applies to the site. Each rule records a
// problem fixed or a choice made; its id is the one used in PLAN.md and in
// the output. See README.md for the vocabulary and how to add a rule.
//
// The default export is enforced. pending holds rules that fail on the
// current site until the user decides between fixing the site and changing
// the rule; check-layout --pending runs them too.
import {
    alignedRight, beside, everyPage, fitsScreen, jumpLandsBelowHeader, larger, maxLines, maybe,
    noOverflow, noOverlap, page, posts, rounded, sameAcrossPages, sameRowSameHeight, square, stacked,
} from './lib/layout.mjs';

const phones = ['phone-320', 'phone-390'];
const wider = ['tablet-768', 'desktop-1280'];

export default [
    everyPage({
        G2: [
            fitsScreen('header nav a, header nav button'),
            noOverlap('header nav', 'a, button', 'a, button'),
        ],
        // Page tops were 48 px on some pages and 64 px on others.
        G3: sameAcrossPages('main h1', {below: 'body > header', only: phones}),
    }),

    page('home', '/', {
        // Headline: clearly bigger than the section headings.
        H1: larger('#hero h1', 'main h2', 1.2),
        // Jumps to a section used to hide its heading under the sticky header.
        H2: [
            jumpLandsBelowHeader('header a[href="/#projects"]', '#projects h2'),
            jumpLandsBelowHeader('header a[href="/#contact"]', '#contact h2'),
            jumpLandsBelowHeader('#hero a[href="#projects"]', '#projects h2'),
        ],
        H3: square('#hero a, #about a.inline-block, #about div:has(> img), #contact input, #contact textarea, #contact button, #projects .grid > a, #contact-success'),
        H4: sameRowSameHeight('#projects .grid > a'),
        // The About photo: under the text on phones, beside it from sm up.
        H5: [
            stacked('#about .grid > div:first-child', '#about div:has(> img)', {only: phones}),
            beside('#about .grid > div:first-child', '#about div:has(> img)', {only: wider}),
        ],
    }),

    page('blog', '/blog/', {
        // "GLOB" was too close in size to the card titles.
        B1: larger('main h1', 'main li h2', 1.5),
        B3: [
            square('main li > a'),
            sameRowSameHeight('main li'),
        ],
    }),

    posts('/blog/', 'main li > a', {
        P1: larger('article > h1', maybe('.prose h2, .prose h3, [data-check="subtitle"]'), 1.25),
        // The date sat right against the title.
        P2: stacked('article > h1', maybe('[data-check="subtitle"]'), 'article > time', '.prose', {gap: 8}),
        P3: [
            maxLines('article > h1', 3, {only: phones}),
            maxLines('article > h1', 2, {only: ['desktop-1280']}),
        ],
        // Chat transcripts: user bubbles rounded and flush right with the
        // text; the thinking line smaller than the text.
        P4: [
            rounded(maybe('[data-check="user-turn"]')),
            alignedRight(maybe('[data-check="user-turn"]'), '.prose'),
            larger(maybe('.prose > p:not([data-check])'), maybe('[data-check="thinking"]'), 1.1),
        ],
    }),

    page('bio', '/bio/', {
        Bio1: [
            larger('main h1', 'main h2', 1.5),
            square('main a.inline-block'),
        ],
    }),
];

// Failing on the first run (2026-09-28); each waits for a decision.
export const pending = [
    everyPage({
        // The header ran off phones. Now fails at 320 px: "ENGINEER" on the
        // home page, the blog cards (a long title word), the titles of
        // "Bootstrapping This Portfolio" (also 390 px) and "Adjunctions", and
        // the Adjunctions display math.
        G1: noOverflow(),
        // From md up the home page's first heading is 64 px below the header,
        // other pages' 112 px.
        G3: sameAcrossPages('main h1', {below: 'body > header', only: wider}),
    }),
    page('blog', '/blog/', {
        // Long titles ran into the date. At 768 px "BOOTSTRAPPING" still does.
        B2: noOverlap('main li', 'h2', 'time', {gap: 8}),
    }),
];
