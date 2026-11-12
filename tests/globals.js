// Test globals - define server.js functions that extracted modules depend on
if (typeof UPGRADE_BONUS === 'undefined') global.UPGRADE_BONUS = 0.05;
if (typeof BOOST_PER_LEVEL === 'undefined') global.BOOST_PER_LEVEL = 0.1;

if (typeof perkOf === 'undefined') {
  global.perkOf = function(tribeKey, name) {
    const defaults = { upgradeBonus: 1, carry: 10, attack: 1, defense: 1 };
    return defaults[name] || 1;
  };
}

if (typeof PRODUCTION_SPEED === 'undefined') global.PRODUCTION_SPEED = 1;
if (typeof STARVE_PATIENCE === 'undefined') global.STARVE_PATIENCE = 24;
if (typeof NAME_MAX === 'undefined') global.NAME_MAX = 30;
if (typeof LANDMARK_RANGE === 'undefined') global.LANDMARK_RANGE = 3;
if (typeof LANDMARK_RANGE_PER_LEVEL === 'undefined') global.LANDMARK_RANGE_PER_LEVEL = 1;
if (typeof PROTECTION_BASE_HOURS === 'undefined') global.PROTECTION_BASE_HOURS = 48;
if (typeof PROTECTION_BASE_POINTS === 'undefined') global.PROTECTION_BASE_POINTS = 100;
