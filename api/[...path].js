const TARGETS = {
  '1': process.env.TARGET_1 || 'http://200.141.31.158:3001/api',
  '2': process.env.TARGET_2 || 'http://200.141.31.158:3002/api',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // /api/1/pair -> server "1", rest "pair"
  // /api/2/status/abc -> server "2", rest "status/abc"
  const parts = req.query.path || [];
  const server = parts[0];
  const rest = parts.slice(1).join('/');
  const target = TARGETS[server];
  if (!target) return res.status(400).json({ error: 'unknown_server' });

  const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  const targetUrl = `${target.replace(/\/$/, '')}/${rest}${qs}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    const init = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    };
    if (!['GET', 'HEAD'].includes(req.method) && req.body && Object.keys(req.body).length) {
      init.body = JSON.stringify(req.body);
    }

    const r = await fetch(targetUrl, init);
    clearTimeout(timer);

    const text = await r.text();
    res.status(r.status);
    try {
      res.json(JSON.parse(text));
    } catch {
      res.send(text);
    }
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'worker_timeout' : 'worker_unreachable';
    res.status(502).json({ error: msg });
  }
}
