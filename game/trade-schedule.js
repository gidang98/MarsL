// Keep the original cadence and skip missed runs after downtime.
module.exports = function nextRouteTime(scheduledAt, intervalMs, now) {
  return scheduledAt + (Math.floor((now - scheduledAt) / intervalMs) + 1) * intervalMs;
};
