// MarsL Game Logic: Bonus
// Extracted from server.js during Phase 2 modularization

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function bonusOf(upgrades, key, tribe) {
  return 1 + UPGRADE_BONUS * perkOf(tribe && tribe.key, "upgradeBonus") * ((upgrades && upgrades[key]) || 0);
}

function attackOf(troops, tribe, upgrades) {
  const a = { g: 0, a: 0 };
  for (const key in troops) {
    const u = tribe.units[key];
    if (!u) continue;
    a[u.type === "air" ? "a" : "g"] += troops[key] * u.atk * bonusOf(upgrades, key, tribe);
  }
  return a;
}

function defenseOf(troops, tribe, upgrades) {
  const d = { g: 0, a: 0 };
  for (const key in troops) {
    const u = tribe.units[key];
    if (!u) continue;
    const b = bonusOf(upgrades, key, tribe);
    d.g += troops[key] * u.defG * b;
    d.a += troops[key] * u.defA * b;
  }
  return d;
}

module.exports = { attackOf, bonusOf, defenseOf, pick };