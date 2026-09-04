/**
 * The /__beam page: a desktop preview of the proxied app inside a phone frame,
 * with device presets, rotate, and reload. Everything is inlined — no assets.
 */
export function dashboardHtml({ phoneUrl, targetPort }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>beam · localhost:${targetPort}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    background: #101014; color: #e8e8ec;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  header {
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    padding: 12px 20px; border-bottom: 1px solid #26262e;
  }
  header h1 { font-size: 15px; margin: 0; font-weight: 600; }
  header h1 span { color: #7c8aff; }
  .url {
    font-family: ui-monospace, Menlo, monospace; font-size: 12px;
    color: #9a9aa5; background: #1a1a21; border: 1px solid #26262e;
    padding: 4px 10px; border-radius: 6px;
  }
  .controls { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  select, button {
    background: #1a1a21; color: #e8e8ec; border: 1px solid #33333d;
    border-radius: 6px; padding: 5px 10px; font-size: 13px; cursor: pointer;
  }
  button:hover, select:hover { border-color: #7c8aff; }
  main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; }
  .phone {
    background: #000; border-radius: 42px; padding: 14px;
    box-shadow: 0 20px 60px rgba(0,0,0,.55), 0 0 0 1px #2c2c34;
    transition: width .25s ease, height .25s ease;
  }
  .phone iframe {
    width: 100%; height: 100%; border: 0; border-radius: 30px; background: #fff;
  }
  .meta { text-align: center; padding: 0 0 16px; color: #63636e; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1><span>beam</span> · previewing localhost:${targetPort}</h1>
  <span class="url">${phoneUrl}</span>
  <div class="controls">
    <select id="device"></select>
    <button id="rotate" title="Rotate">⟳ Rotate</button>
    <button id="reload" title="Reload">↻ Reload</button>
  </div>
</header>
<main>
  <div class="phone" id="frame"><iframe id="view" src="/"></iframe></div>
</main>
<div class="meta" id="dims"></div>
<script>
  const DEVICES = [
    { name: 'iPhone 15 Pro', w: 393, h: 852 },
    { name: 'iPhone SE', w: 375, h: 667 },
    { name: 'Pixel 8', w: 412, h: 915 },
    { name: 'Galaxy S23', w: 360, h: 780 },
    { name: 'iPad Mini', w: 768, h: 1024 },
  ];
  const select = document.getElementById('device');
  const frame = document.getElementById('frame');
  const view = document.getElementById('view');
  const dims = document.getElementById('dims');
  let landscape = false;

  DEVICES.forEach((d, i) => select.add(new Option(d.name + ' — ' + d.w + '×' + d.h, i)));

  function apply() {
    const d = DEVICES[select.value];
    const w = landscape ? d.h : d.w;
    const h = landscape ? d.w : d.h;
    frame.style.width = (w + 28) + 'px';
    frame.style.height = (h + 28) + 'px';
    dims.textContent = d.name + ' · ' + w + '×' + h + (landscape ? ' (landscape)' : '');
  }

  select.onchange = apply;
  document.getElementById('rotate').onclick = () => { landscape = !landscape; apply(); };
  document.getElementById('reload').onclick = () => { view.src = view.src; };
  apply();
</script>
</body>
</html>`;
}
