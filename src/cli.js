#!/usr/bin/env node
// http-proxy still uses util._extend internally, which Node warns about on
// every start; the warning is noise for CLI users.
process.noDeprecation = true;

import os from 'node:os';
import readline from 'node:readline';
import qrcode from 'qrcode-terminal';
import { findRunningApps, probeHttp } from './detect.js';
import { startProxy } from './proxy.js';

const DEFAULT_LISTEN_PORT = 8790;

const HELP = `beam — view your localhost app on your phone

Usage:
  beam                 scan common dev ports and beam what it finds
  beam <port>          beam the app running on localhost:<port>

Options:
  -p, --port <port>    port for beam to listen on (default ${DEFAULT_LISTEN_PORT})
  -d, --debug          inject eruda, an on-phone devtools console
  -h, --help           show this help

Once running:
  · scan the QR code with your phone (same Wi-Fi network)
  · open the printed /__beam URL on your desktop for a phone-frame preview
`;

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const accent = (s) => `\x1b[36m${s}\x1b[0m`;

function parseArgs(argv) {
  const args = { target: null, listen: DEFAULT_LISTEN_PORT, debug: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') args.help = true;
    else if (a === '-d' || a === '--debug') args.debug = true;
    else if (a === '-p' || a === '--port') args.listen = parseInt(argv[++i], 10);
    else if (/^\d+$/.test(a)) args.target = parseInt(a, 10);
    else {
      console.error(`Unknown argument: ${a}\n`);
      console.error(HELP);
      process.exit(1);
    }
  }
  return args;
}

/** Best-guess LAN IPv4 — prefers typical home/office ranges over VPN tunnels. */
function lanIp() {
  const candidates = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) candidates.push(iface.address);
    }
  }
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  candidates.sort((a, b) => rank(a) - rank(b));
  return candidates[0] || null;
}

async function chooseApp(apps) {
  console.log(`Found ${apps.length} apps running:\n`);
  apps.forEach((a, i) => {
    const label = a.server ? dim(`  (${a.server})`) : '';
    console.log(`  ${i + 1}. http://localhost:${a.port}${label}`);
  });
  console.log();
  if (!process.stdin.isTTY) {
    console.log(dim(`Not a terminal — picking localhost:${apps[0].port}. Run \`beam <port>\` to choose.`));
    return apps[0];
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question(`Beam which one? [1-${apps.length}] `, r));
  rl.close();
  const idx = parseInt(answer, 10) - 1;
  return apps[idx] || apps[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  let targetPort = args.target;
  if (targetPort) {
    const alive = await probeHttp(targetPort);
    if (!alive) {
      console.log(dim(`Heads up: nothing is answering on localhost:${targetPort} yet — beaming anyway.`));
    }
  } else {
    console.log(dim('Scanning common dev ports…'));
    const apps = await findRunningApps();
    if (apps.length === 0) {
      console.error('No dev server found on the usual ports.');
      console.error('Start your app first, or point beam at it directly: beam <port>');
      process.exit(1);
    }
    targetPort = (apps.length === 1 ? apps[0] : await chooseApp(apps)).port;
  }

  const ip = lanIp();
  let phoneUrl = '';
  const { port } = await startProxy({
    targetPort,
    listenPort: args.listen,
    debug: args.debug,
    phoneUrl: () => phoneUrl,
  });
  phoneUrl = `http://${ip || 'localhost'}:${port}`;

  console.log();
  console.log(`  ${bold('beam')} ${dim('·')} localhost:${targetPort} ${dim('→')} ${accent(phoneUrl)}`);
  console.log();
  if (ip) {
    qrcode.generate(phoneUrl, { small: true }, (qr) => {
      console.log(qr.replace(/^/gm, '  '));
    });
    console.log(`  ${bold('Phone')}    scan the QR code ${dim('(same Wi-Fi as this machine)')}`);
  } else {
    console.log(`  ${bold('Note')}     no LAN address found — phones can't reach this machine right now.`);
  }
  console.log(`  ${bold('Desktop')}  ${accent(`http://localhost:${port}/__beam`)} ${dim('(phone-frame preview)')}`);
  if (args.debug) {
    console.log(`  ${bold('Debug')}    eruda console injected — tap the gear bubble on the phone`);
  }
  console.log();
  console.log(dim('  Viewport meta tag is auto-injected into pages that lack one. Ctrl+C to stop.'));
}

main().catch((err) => {
  console.error(`beam failed to start: ${err.message}`);
  process.exit(1);
});
