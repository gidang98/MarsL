// MarsL Test Helper

function safeRequire(path) {
  try {
    return require(path);
  } catch (e) {
    console.warn(`Warning: could not load ${path}: ${e.message}`);
    return null;
  }
}

function mockColony(overrides = {}) {
  return {
    tribe: 'human',
    buildings: overrides.buildings || [],
    res: overrides.res || { wood: 0, stone: 0, metal: 0, food: 0 },
    fields: overrides.fields || [],
    upgrades: overrides.upgrades || {},
    ...overrides
  };
}

function mockTribe(overrides = {}) {
  return {
    key: 'human',
    units: {
      warrior: { type: 'ground', role: 'Warrior', atk: 10, defG: 8, defA: 4, carry: 10 },
      archer:  { type: 'ground', role: 'Archer',  atk: 12, defG: 3, defA: 6, carry: 8 },
      flyer:   { type: 'air',    role: 'Flyer',   atk: 8,  defG: 2, defA: 8, carry: 5 },
      settler: { type: 'ground', role: 'Settler', atk: 2,  defG: 2, defA: 2, carry: 50 },
    },
    ...overrides
  };
}

function mockTroops(overrides = {}) {
  return { warrior: 100, archer: 50, ...overrides };
}

module.exports = { safeRequire, mockColony, mockTribe, mockTroops };
