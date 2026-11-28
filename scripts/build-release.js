const fs = require('node:fs');
const path = require('node:path');
const gamePageTemplate = require('../client/game-page');

const root = path.resolve(__dirname, '..');
const imports = new Map([
  ['const runtimeTiming = require("./lib/runtime-timing")();', 'const runtimeTiming = (' + require('../lib/runtime-timing').toString() + ')();'],
  ['const nextRouteTime = require("./game/trade-schedule");', 'const nextRouteTime = ' + require('../game/trade-schedule').toString() + ';'],
  ['const PAGE = require("./client/game-page")(TRIBES, MONSTERS);', 'const PAGE = (' + gamePageTemplate.toString() + ')(TRIBES, MONSTERS);'],
  ['const { createGateway } = require("./lib/gateway");', 'const { createGateway } = (function () { var module = { exports: {} }; ' + fs.readFileSync(path.join(__dirname, '..', 'lib', 'gateway.js'), 'utf8') + '\nreturn module.exports; })();'],
  ['const battleOdds = require("./game/battle-odds");', 'const battleOdds = ' + require('../game/battle-odds').toString() + ';'],
]);
let source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
for (const [statement, bundled] of imports) {
  if (source.split(statement).length !== 2) throw new Error('Expected one import: ' + statement);
  source = source.replace(statement, () => bundled);
}

const fontSource = path.join(root, 'fonts');
const fontManifest = path.join(fontSource, 'manifest.json');
if (!fs.existsSync(fontManifest)) throw new Error('Missing self-hosted fonts; run node scripts/prepare-fonts.js');
const fontOutput = path.join(root, 'dist', 'fonts');
fs.rmSync(fontOutput, { recursive: true, force: true });
fs.cpSync(fontSource, fontOutput, { recursive: true });

const output = path.join(root, 'dist', 'server.js');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, source);
console.log('Built dist/server.js');
