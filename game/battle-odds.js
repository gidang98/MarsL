module.exports = function battleOdds(mission, A, D) {
  const attackerWins = A > D;
  const weak = Math.min(A, D);
  const strong = Math.max(A, D);
  const x = Math.pow(strong > 0 ? weak / strong : 0, 1.5);
  let winnerLoss;
  let loserLoss;
  if (mission === "raid") {
    winnerLoss = x / (1 + x);
    loserLoss = 1 / (1 + x);
  } else {
    winnerLoss = x;
    loserLoss = 1;
  }
  return {
    attackerWins,
    atkFrac: attackerWins ? winnerLoss : loserLoss,
    defFrac: attackerWins ? loserLoss : winnerLoss,
  };
};
