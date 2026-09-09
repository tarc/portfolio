// Deno Deploy function for the portfolio's "Get in Touch" form.
//
// Required env vars (set in the Deno Deploy project settings):
//   RESEND_API_KEY    - API key from https://resend.com
//   CONTACT_TO_EMAIL  - where submissions should be delivered
// Optional:
//   CONTACT_FROM_EMAIL - sender address (defaults to Resend's shared
//                         onboarding@resend.dev, which works without
//                         verifying a custom domain)
//   ALLOWED_ORIGIN      - CORS origin to allow (defaults to the site's
//                         production URL)

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://tarcisio.codeberg.page';
const FROM_EMAIL = Deno.env.get('CONTACT_FROM_EMAIL') ?? 'onboarding@resend.dev';

const corsHeaders = {
	'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	if (req.method !== 'POST') {
		return json({ error: 'Method not allowed' }, 405);
	}

	let body: { email?: string; message?: string; website?: string };
	try {
		body = await req.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, 400);
	}

	const { email, message, website } = body;

	// Honeypot: real users never fill this hidden field. Silently succeed
	// so bots don't learn their submission was rejected.
	if (website) {
		return json({ ok: true });
	}

	if (!email || !EMAIL_RE.test(email)) {
		return json({ error: 'A valid email is required' }, 400);
	}
	if (!message || message.trim().length === 0) {
		return json({ error: 'A message is required' }, 400);
	}
	if (message.length > 5000) {
		return json({ error: 'Message is too long' }, 400);
	}

	const toEmail = Deno.env.get('CONTACT_TO_EMAIL');
	const apiKey = Deno.env.get('RESEND_API_KEY');
	if (!toEmail || !apiKey) {
		console.error('Missing CONTACT_TO_EMAIL or RESEND_API_KEY env var');
		return json({ error: 'Server misconfigured' }, 500);
	}

	const resendResponse = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: FROM_EMAIL,
			to: toEmail,
			reply_to: email,
			subject: `Portfolio contact form: ${email}`,
			text: `From: ${email}\n\n${message}`,
		}),
	});

	if (!resendResponse.ok) {
		console.error('Resend API error', await resendResponse.text());
		return json({ error: 'Failed to send message' }, 502);
	}

	return json({ ok: true });
});
