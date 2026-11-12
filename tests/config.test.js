// Config structure tests
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkSyntax(filepath) {
  try {
    execSync(`node --check "${filepath}"`, { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

describe('Config files exist and are valid', () => {
  const configDir = path.join(__dirname, '../config');
  const files = fs.readdirSync(configDir).filter(f => f.endsWith('.js'));

  it('has 12+ config files', () => {
    assert.ok(files.length >= 12, `Expected >= 12, got ${files.length}`);
  });

  for (const file of files) {
    it(`${file} is valid JavaScript`, () => {
      const filepath = path.join(configDir, file);
      assert.ok(checkSyntax(filepath), `${file} should be valid JS`);
    });
  }
});

describe('Game files exist and are valid', () => {
  const gameDir = path.join(__dirname, '../game');
  const files = fs.readdirSync(gameDir).filter(f => f.endsWith('.js'));

  it('has 5+ game files', () => {
    assert.ok(files.length >= 5);
  });

  for (const file of files) {
    it(`${file} is valid JavaScript`, () => {
      const filepath = path.join(gameDir, file);
      assert.ok(checkSyntax(filepath), `${file} should be valid JS`);
    });
  }
});

describe('Lib files exist and are valid', () => {
  const libDir = path.join(__dirname, '../lib');
  const files = fs.readdirSync(libDir).filter(f => f.endsWith('.js'));

  it('has 4+ lib files', () => {
    assert.ok(files.length >= 4);
  });

  for (const file of files) {
    it(`${file} is valid JavaScript`, () => {
      const filepath = path.join(libDir, file);
      assert.ok(checkSyntax(filepath), `${file} should be valid JS`);
    });
  }
});

describe('Route files exist and are valid', () => {
  const routesDir = path.join(__dirname, '../routes');
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

  it('has 4+ route files', () => {
    assert.ok(files.length >= 4);
  });

  for (const file of files) {
    it(`${file} is valid JavaScript`, () => {
      const filepath = path.join(routesDir, file);
      assert.ok(checkSyntax(filepath), `${file} should be valid JS`);
    });
  }
});

describe('Render file exists and is valid', () => {
  const renderPath = path.join(__dirname, '../render/index.js');

  it('render/index.js is valid JavaScript', () => {
    assert.ok(fs.existsSync(renderPath));
    assert.ok(checkSyntax(renderPath), 'render/index.js should be valid JS');
  });
});
