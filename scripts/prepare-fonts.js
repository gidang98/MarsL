const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'fonts');
const bundles = [
  { package: '@fontsource/barlow', license: 'Barlow', css: ['400.css', '500.css', '600.css', '700.css'] },
  { package: '@fontsource/chakra-petch', license: 'Chakra-Petch', css: ['600.css', '700.css'] },
  { package: '@fontsource-variable/fredoka', license: 'Fredoka', css: ['index.css'] },
  { package: '@fontsource-variable/figtree', license: 'Figtree', css: ['index.css'] },
];

fs.mkdirSync(output, { recursive: true });
for (const name of fs.readdirSync(output)) {
  if (/\.(?:woff2?|css|json|txt)$/i.test(name)) fs.rmSync(path.join(output, name));
}

const cssParts = [];
const files = [];
const licenses = [];
for (const bundle of bundles) {
  const packageDir = path.dirname(require.resolve(bundle.package + '/package.json', { paths: [root] }));
  for (const cssName of bundle.css) {
    const sourcePath = path.join(packageDir, cssName);
    let css = fs.readFileSync(sourcePath, 'utf8');
    const references = [...css.matchAll(/url\(['"]?(\.\/files\/[^)'"?]+)['"]?\)/g)].map(match => match[1]);
    assert.ok(references.length > 0, bundle.package + '/' + cssName + ' has no font files');
    for (const reference of references) {
      const source = path.resolve(path.dirname(sourcePath), reference);
      assert.ok(source.startsWith(packageDir + path.sep), 'Font path escapes its package');
      const name = path.basename(source);
      const bytes = fs.readFileSync(source);
      assert.ok(bytes.length > 1000, name + ' is empty');
      fs.writeFileSync(path.join(output, name), bytes);
      if (!files.includes(name)) files.push(name);
    }
    css = css.replace(/url\(['"]?\.\/files\/([^)'"?]+)['"]?\)/g, "url('/fonts/$1')");
    assert.ok(!/https?:\/\//i.test(css), 'External font URL introduced');
    cssParts.push('/* ' + bundle.package + '/' + cssName + ' */\n' + css.trim());
  }
  const licenseSource = ['LICENSE', 'LICENSE.txt', 'OFL.txt'].map(name => path.join(packageDir, name)).find(fs.existsSync);
  assert.ok(licenseSource, 'Missing license for ' + bundle.package);
  const licenseName = 'LICENSE-' + bundle.license + '.txt';
  fs.copyFileSync(licenseSource, path.join(output, licenseName));
  licenses.push(licenseName);
}
files.sort();
const manifest = {
  generatedBy: 'scripts/prepare-fonts.js',
  packages: bundles.map(bundle => ({ name: bundle.package, version: require(path.join(path.dirname(require.resolve(bundle.package + '/package.json', { paths: [root] })), 'package.json')).version })),
  files,
  licenses,
  sha256: Object.fromEntries(files.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(output, name))).digest('hex')])),
};
fs.writeFileSync(path.join(output, 'fonts.css'), cssParts.join('\n\n') + '\n');
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Prepared ' + files.length + ' self-hosted font files and ' + licenses.length + ' font licenses.');
