export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Only POST allowed');

  // Verify presence of required secrets
  const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
  const GA_API_SECRET = process.env.GA_API_SECRET;
  if (!GA_MEASUREMENT_ID || !GA_API_SECRET)
    return res.status(500).send('GA credentials not configured');

  // --- Read raw body stream manually ---
  let text = '';
  try {
    for await (const chunk of req) text += chunk;
  } catch {
    return res.status(400).send('Error reading request body');
  }

  // --- Parse JSON safely ---
  let body;
  try {
    body = JSON.parse(text || '{}');
  } catch {
    return res.status(400).send('Invalid JSON');
  }

  // --- Basic authentication ---
  const deviceKey = req.headers['x-device-key'];
  if (!deviceKey || deviceKey !== process.env.DEVICE_KEY)
    return res.status(401).send('Unauthorized');

  // --- Prepare GA4 payload ---
  const payload = {
    client_id: req.headers['x-device-id'] || 'anonymous',
    events: [
      {
        name: body.event || 'feedback_submitted',
        params: body.params || {}
      }
    ]
  };

  // --- Send to Google Analytics ---
  const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;
  const r = await fetch(gaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // --- Pass-through GA response ---
  if (r.ok) {
    return res.status(200).json({ status: 'OK', event: payload.events[0].name });
  } else {
    const t = await r.text();
    return res.status(r.status).send(`GA error ${r.status}: ${t}`);
  }
}

