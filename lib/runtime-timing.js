module.exports = function createRuntimeTiming() {
  const capacity = 256;
  const series = new Map();

  function record(name, duration) {
    let entry = series.get(name);
    if (!entry) {
      entry = { count: 0, samples: [] };
      series.set(name, entry);
    }
    entry.samples[entry.count % capacity] = duration;
    entry.count++;
  }

  function measure(name, run) {
    const start = performance.now();
    try {
      return run();
    } finally {
      record(name, performance.now() - start);
    }
  }

  function snapshot() {
    return Object.fromEntries(Array.from(series, ([name, { count, samples }]) => {
      const sorted = [...samples].sort((a, b) => a - b);
      return [name, {
        count,
        samples: sorted.length,
        p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(2)),
      }];
    }));
  }

  return { record, measure, snapshot };
};
