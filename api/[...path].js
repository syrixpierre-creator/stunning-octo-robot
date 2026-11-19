const TARGETS = {
  '1': process.env.TARGET_1 || 'http://200.141.31.158:3001/api',
  '2': process.env.TARGET_2 || 'http://200.141.31.158:3002/api',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const parts = Array.isArray(req.query.path) ? req.query.path : [];
  const server = parts[0];
  const rest = parts.slice(1).join('/');
  const target = TARGETS[server];

  if (!target) {
    return res.status(400).json({ error: 'unknown_server', debug: { parts, server, url: req.url } });
  }

  const targetUrl = `${target}/${rest}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    const init = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    };
    if (req.method === 'POST' && req.body) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, init);
    clearTimeout(timer);

    const text = await upstream.text();
    res.status(upstream.status);
    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'worker_timeout' : 'worker_unreachable';
    return res.status(502).json({ error: msg, target: targetUrl });
  }
}
