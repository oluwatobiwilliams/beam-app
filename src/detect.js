import http from 'node:http';

// Ports that common dev servers default to.
const COMMON_PORTS = [
  3000, // Next.js, CRA, Remix
  5173, // Vite
  5174, // Vite (fallback)
  8080, // webpack-dev-server, generic
  4200, // Angular
  8000, // Django, python -m http.server
  3001, // CRA fallback
  4000, // Phoenix, Gatsby serve
  4321, // Astro
  1234, // Parcel
  8081, // generic fallback
  6006, // Storybook
  9000, // generic
];

/**
 * Probe a port with a real HTTP request. A TCP connect alone isn't enough —
 * macOS AirPlay listens on 5000/7000 and would show up as a false positive.
 */
export function probeHttp(port, timeout = 800) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout }, (res) => {
      res.resume();
      const server = res.headers.server || '';
      if (/airtunes|airplay/i.test(server)) return resolve(null);
      resolve({ port, status: res.statusCode, server });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/** Scan common dev ports and return every one that speaks HTTP. */
export async function findRunningApps() {
  const results = await Promise.all(COMMON_PORTS.map((p) => probeHttp(p)));
  return results.filter(Boolean);
}
