const VIEWPORT_TAG =
  '<meta name="viewport" content="width=device-width, initial-scale=1">';

// Eruda is a devtools console that runs on the phone itself (console, network,
// elements). Loaded from a CDN, so the phone needs internet access for it.
const ERUDA_SNIPPET =
  '<script src="https://cdn.jsdelivr.net/npm/eruda@3"></script><script>window.eruda&&eruda.init();</script>';

/**
 * Rewrite an HTML document for mobile viewing:
 * - add a viewport meta tag if the page doesn't have one (desktop-first
 *   prototypes render as a tiny zoomed-out page on phones without it)
 * - optionally add the eruda on-device console
 */
export function transformHtml(html, { debug = false } = {}) {
  let out = html;

  if (!/<meta[^>]+name=["']?viewport/i.test(out)) {
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${VIEWPORT_TAG}`);
    } else {
      out = VIEWPORT_TAG + out;
    }
  }

  if (debug) {
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${ERUDA_SNIPPET}\n</body>`);
    } else {
      out += ERUDA_SNIPPET;
    }
  }

  return out;
}
