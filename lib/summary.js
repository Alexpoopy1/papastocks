/* Build a rich, plain-English snapshot from intraday spark data.
   Pure function — safe on both server and client. */

export function smartSummary(q) {
  const bits = [];
  const pct = q.changePct ?? 0;
  const dir = pct >= 0 ? "up" : "down";
  bits.push(`$${q.price?.toFixed(2)}, ${dir} ${Math.abs(pct).toFixed(2)}% today.`);

  if (q.spark?.length > 3) {
    const hi = Math.max(...q.spark);
    const lo = Math.min(...q.spark);
    const avg = q.spark.reduce((a, b) => a + b, 0) / q.spark.length;
    const posInRange = hi === lo ? 0.5 : (q.price - lo) / (hi - lo);

    if (posInRange > 0.85) bits.push(`Trading near today's high of $${hi.toFixed(2)}.`);
    else if (posInRange < 0.15) bits.push(`Sitting near today's low of $${lo.toFixed(2)}.`);
    else bits.push(`Today's range: $${lo.toFixed(2)}–$${hi.toFixed(2)}.`);

    if (q.price > avg * 1.002) bits.push("Buyers are in charge — it's above its session average.");
    else if (q.price < avg * 0.998) bits.push("Sellers have the edge — it's below its session average.");
    else bits.push("Holding steady around its session average.");

    const half = q.spark.slice(-Math.max(3, Math.floor(q.spark.length / 4)));
    const recent = (half[half.length - 1] - half[0]) / half[0] * 100;
    if (recent > 0.35) bits.push("Momentum is picking up right now. 📈");
    else if (recent < -0.35) bits.push("It's been slipping in the last stretch. 📉");
  }
  return bits.join(" ");
}
