try { require('dotenv').config(); } catch {}

const TARGETS = {
  '1': process.env.TARGET_1 || 'http://200.141.31.158:3001/api',
  '2': process.env.TARGET_2 || 'http://200.141.31.158:3002/api',
};

// vercel.json rewrites /api/<server>/<path> to /api/proxy?s=<server>&p=<path>
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const target = TARGETS[String(req.query.s || '')];
  if (!target) return res.status(400).json({ error: 'unknown_server' });
  const rest = [].concat(req.query.p || []).join('/');
  const targetUrl = `${target.replace(/\/$/, '')}/${rest}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const init = { method: req.method, headers: { 'Content-Type': 'application/json' }, signal: controller.signal };
    if (!['GET', 'HEAD'].includes(req.method) && req.body) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
    const upstream = await fetch(targetUrl, init);
    const text = await upstream.text();
    res.status(upstream.status);
    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (e) {
    return res.status(502).json({ error: e.name === 'AbortError' ? 'worker_timeout' : 'worker_unreachable' });
  } finally {
    clearTimeout(timer);
  }
};
