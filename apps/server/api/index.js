// Committed Vercel serverless entry (CommonJS). Vercel auto-detects this file
// as a Serverless Function. It loads the pre-built CJS bundle produced by tsup
// (`pnpm --filter @kushlov/server build` → dist-vercel/index.cjs), so Vercel
// never compiles our TypeScript/ESM app directly.
//
// If the bundle fails to load (missing dependency, bad env, etc.) we still
// respond with CORS headers and the actual error so the browser shows a real
// message instead of an opaque FUNCTION_INVOCATION_FAILED.

function applyCors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,X-Requested-With',
  );
}

let handler;

try {
  const mod = require('../dist-vercel/index.cjs');
  handler = mod && mod.default ? mod.default : mod;
  if (typeof handler !== 'function') {
    throw new Error(
      'Bundle did not export an Express app (got ' + typeof handler + ')',
    );
  }
} catch (err) {
  const message = (err && (err.stack || err.message)) || String(err);
  // eslint-disable-next-line no-console
  console.error('[api/index] Failed to load server bundle:', message);
  handler = function fallback(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: 'Server initialization failed',
        detail: message,
      }),
    );
  };
}

module.exports = handler;
