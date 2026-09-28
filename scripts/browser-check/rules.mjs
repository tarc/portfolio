// The layout rules check-layout.mjs applies to the site. Each rule records a
// problem fixed or a choice made; its id is the one used in PLAN.md and in
// the output. See README.md for the vocabulary and how to add a rule.
//
// The default export is enforced. pending holds rules that fail on the
// current site until the user decides between fixing the site and changing
// the rule; check-layout --pending runs them too.
import {
    alignedRight, beside, everyPage, fitsScreen, jumpLandsBelowHeader, larger, maxLines, maybe,
    noOverflow, noOverlap, oneRow, page, posts, rounded, sameAcrossPages, sameRowSameHeight, square, stacked,
} from './lib/layout.mjs';

const phones = ['phone-320', 'phone-390'];
const wider = ['tablet-768', 'desktop-1280'];

export default [
    everyPage({
        // The header ran off phones; later long title words and display
        // math did too.
        G1: noOverflow(),
        G2: [
            fitsScreen('header nav a, header nav button'),
            noOverlap('header nav', 'a, button', 'a, button'),
        ],
        // Page tops were 48 px on some pages and 64 px on others, and from
        // md up 64 px on home against 112 px elsewhere.
        G3: sameAcrossPages('main h1', {below: 'body > header'}),
        // The header links on one row: at 320 px "Bio" wrapped onto a row
        // of its own.
        G4: oneRow('[data-check="nav-links"] > a'),
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
        // Long titles ran into the date.
        B2: noOverlap('main li', 'time', 'h2', {gap: 8}),
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

// Rules awaiting a decision: they fail on the current site until the user
// chooses between fixing the site and changing the rule. None at present.
export const pending = [];
