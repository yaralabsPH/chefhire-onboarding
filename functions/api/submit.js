const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.APPS_SCRIPT_URL || !env.FORM_SHARED_SECRET) {
    return json({ ok: false, error: 'Server is not configured.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  // Honeypot: bots commonly fill invisible fields.
  if (body.website) {
    return json({ ok: true }, 200);
  }

  const required = [
    'businessName', 'businessAddress', 'primaryContact', 'email', 'phone',
    'ghlUsers', 'operatingCoverage', 'process', 'firstResponseTime',
    'customerComms', 'currentData', 'candidateRecruitment'
  ];

  for (const key of required) {
    if (!String(body[key] || '').trim()) {
      return json({ ok: false, error: `Missing required field: ${key}` }, 422);
    }
  }

  const arrayRequired = ['services', 'sources', 'bookingDetails', 'followupChannels', 'integrations'];
  for (const key of arrayRequired) {
    if (!Array.isArray(body[key]) || body[key].length === 0) {
      return json({ ok: false, error: `Missing required selection: ${key}` }, 422);
    }
  }

  // Keep payload size bounded.
  const serialized = JSON.stringify(body);
  if (serialized.length > 50_000) {
    return json({ ok: false, error: 'Submission is too large.' }, 413);
  }

  const forwarded = {
    ...body,
    _secret: env.FORM_SHARED_SECRET
  };

  try {
    const upstream = await fetch(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(forwarded),
      redirect: 'follow'
    });

    const text = await upstream.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { ok: false, error: 'Unexpected response from storage service.' };
    }

    if (!upstream.ok || !result.ok) {
      console.error('Apps Script error:', upstream.status, text);
      return json({ ok: false, error: result.error || 'Could not save submission.' }, 502);
    }

    return json({ ok: true, submissionId: result.submissionId || body.submissionId }, 200);
  } catch (error) {
    console.error('Submission proxy error:', error);
    return json({ ok: false, error: 'Could not reach storage service.' }, 502);
  }
}

export function onRequestGet() {
  return json({ ok: true, service: 'ChefHire onboarding submission endpoint' }, 200);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS
  });
}
