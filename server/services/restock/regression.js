const mean = (v) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
function features(v, i, weekday) {
  return [
    v[i - 1],
    v[i - 7],
    v[i - 14],
    mean(v.slice(i - 7, i)),
    mean(v.slice(i - 28, i)),
    i,
    ...Array.from({ length: 6 }, (_, d) => Number((weekday + i) % 7 === d)),
  ];
}
function solve(matrix, target) {
  const a = matrix.map((r, i) => [...r, target[i]]),
    n = a.length;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    if (Math.abs(a[c][c]) < 1e-10) return null;
    const scale = a[c][c];
    for (let j = c; j <= n; j++) a[c][j] /= scale;
    for (let r = 0; r < n; r++)
      if (r !== c) {
        const factor = a[r][c];
        for (let j = c; j <= n; j++) a[r][j] -= factor * a[c][j];
      }
  }
  return a.map((r) => r[n]);
}
function fit(v, weekday) {
  const x = v.slice(28).map((_, n) => features(v, n + 28, weekday)),
    y = v.slice(28);
  const means = x[0].map((_, j) => mean(x.map((r) => r[j])));
  const scales = means.map(
    (m, j) => Math.sqrt(mean(x.map((r) => (r[j] - m) ** 2))) || 1,
  );
  const rows = x.map((r) => [
      1,
      ...r.map((z, j) => (z - means[j]) / scales[j]),
    ]),
    size = rows[0].length;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0)),
    target = Array(size).fill(0);
  rows.forEach((r, i) =>
    r.forEach((a, j) => {
      target[j] += a * y[i];
      r.forEach((b, k) => (matrix[j][k] += a * b));
    }),
  );
  for (let j = 1; j < size; j++) matrix[j][j] += 1;
  const weights = solve(matrix, target);
  if (!weights) return null;
  return (history) => {
    const f = features(history, history.length, weekday);
    return (
      weights[0] +
      f.reduce(
        (n, a, j) => n + (weights[j + 1] * (a - means[j])) / scales[j],
        0,
      )
    );
  };
}
function predict(v, count, weekday) {
  const model = fit(v, weekday);
  if (!model) return null;
  const history = [...v],
    cap = Math.max(10, Math.max(...v) * 5);
  for (let i = 0; i < count; i++) {
    const next = model(history);
    if (!Number.isFinite(next)) return null;
    history.push(Math.min(cap, Math.max(0, next)));
  }
  return history.slice(v.length);
}
module.exports = { predict, mean };
