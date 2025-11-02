export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Only POST');

  const key = req.headers['x-device-key'];
  if (!key || key !== process.env.DEVICE_KEY) return res.status(401).send('Unauthorized');

  const body = await readJson(req);
  const contentB64 = Buffer.from(JSON.stringify(body)).toString('base64');

  const repo = process.env.REPO;         // e.g. "blackapple805/iot-log"
  const path = process.env.FILEPATH;     // e.g. "data.json"
  const token = process.env.GITHUB_TOKEN;

  const base = `https://api.github.com/repos/${repo}/contents/${path}`;
  const ghHeaders = {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'vercel-iot-proxy',
    'Content-Type': 'application/json'
  };

  // 1) get current sha (if file exists)
  let sha = undefined;
  const getResp = await fetch(base, { headers: ghHeaders });
  if (getResp.status === 200) {
    const meta = await getResp.json();
    sha = meta.sha;
  } else if (getResp.status !== 404) {
    const t = await getResp.text();
    return res.status(502).send(`GitHub GET error ${getResp.status}: ${t}`);
  }

  // 2) put new content
  const payload = {
    message: 'update from ESP8266 via Vercel',
    content: contentB64,
    ...(sha ? { sha } : {})
  };

  const putResp = await fetch(base, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify(payload)
  });

  const txt = await putResp.text();
  return res.status(putResp.status).send(txt);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
