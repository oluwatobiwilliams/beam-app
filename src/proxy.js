import http from 'node:http';
import httpProxy from 'http-proxy';
import { transformHtml } from './inject.js';
import { dashboardHtml } from './dashboard.js';

/**
 * Start the beam proxy: listens on 0.0.0.0 so phones on the same network can
 * reach it, and forwards everything (including WebSockets, so HMR keeps
 * working) to the target app on 127.0.0.1.
 *
 * If the requested listen port is busy, the next few ports are tried.
 * Resolves to { server, port }.
 */
export function startProxy({ targetPort, listenPort, debug = false, phoneUrl = () => '' }) {
  const proxy = httpProxy.createProxyServer({
    target: `http://127.0.0.1:${targetPort}`,
    changeOrigin: true, // upstream sees Host: localhost — keeps host-checking dev servers happy
    ws: true,
    selfHandleResponse: true, // we rewrite HTML responses ourselves
  });

  // Dev servers increasingly reject traffic that doesn't look same-origin:
  // Next.js 15+ returns 403 for /_next/* client chunks when Origin/Referer is
  // an unlisted host (so pages load but never hydrate), and Server Actions
  // compare Origin against Host. Since we already rewrite Host via
  // changeOrigin, rewrite Origin/Referer to match it.
  const localOrigin = `http://127.0.0.1:${targetPort}`;
  const disguiseOrigin = (proxyReq, req) => {
    if (req.headers.origin) proxyReq.setHeader('origin', localOrigin);
    if (req.headers.referer) {
      try {
        const u = new URL(req.headers.referer);
        proxyReq.setHeader('referer', localOrigin + u.pathname + u.search);
      } catch {
        proxyReq.setHeader('referer', `${localOrigin}/`);
      }
    }
  };

  // Ask upstream for uncompressed responses so HTML can be rewritten in place.
  proxy.on('proxyReq', (proxyReq, req) => {
    proxyReq.setHeader('accept-encoding', 'identity');
    disguiseOrigin(proxyReq, req);
  });

  // Same for WebSocket upgrades (HMR), which also carry an Origin header.
  proxy.on('proxyReqWs', (proxyReq, req) => {
    disguiseOrigin(proxyReq, req);
  });

  proxy.on('proxyRes', (proxyRes, req, res) => {
    const headers = { ...proxyRes.headers };
    // Dev tool: allow the app inside the /__beam iframe.
    delete headers['x-frame-options'];

    const isHtml = (headers['content-type'] || '').includes('text/html');
    // If upstream compressed anyway, pass it through untouched rather than corrupt it.
    if (!isHtml || headers['content-encoding']) {
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
      return;
    }

    const chunks = [];
    proxyRes.on('data', (c) => chunks.push(c));
    proxyRes.on('end', () => {
      const body = transformHtml(Buffer.concat(chunks).toString('utf8'), { debug });
      headers['content-length'] = Buffer.byteLength(body);
      res.writeHead(proxyRes.statusCode, headers);
      res.end(body);
    });
  });

  proxy.on('error', (err, req, res) => {
    if (res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/html' });
      res.end(
        `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">` +
          `<body style="font-family:sans-serif;padding:2rem"><h2>beam: can't reach localhost:${targetPort}</h2>` +
          `<p>The dev server looks like it stopped. Restart it and reload this page.</p>` +
          `<p style="color:#888">${err.code || err.message}</p></body>`
      );
    } else if (res && typeof res.destroy === 'function') {
      res.destroy(); // ws upgrade socket
    }
  });

  const server = http.createServer((req, res) => {
    if (req.url === '/__beam' || req.url === '/__beam/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(dashboardHtml({ phoneUrl: phoneUrl(), targetPort }));
      return;
    }
    proxy.web(req, res);
  });

  server.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head);
  });

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryListen = (port) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempts < 10) {
          attempts += 1;
          tryListen(port + 1);
        } else {
          reject(err);
        }
      });
      server.listen(port, '0.0.0.0', () => {
        server.removeAllListeners('error');
        resolve({ server, port });
      });
    };
    tryListen(listenPort);
  });
}
