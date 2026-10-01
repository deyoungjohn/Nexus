/** Parse human amounts without floating point or inferred precision. */
export function decimalUnits(value: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255 || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) throw new Error("Use a positive decimal amount.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(`Amount supports at most ${decimals} decimal places.`);
  const units = BigInt(`${whole}${fraction.padEnd(decimals,"0")}`);
  if (units <= 0n || units.toString().length > 78) throw new Error("Amount must be positive and fit the supported range.");
  return units.toString();
}
export function formattedUnits(value: string, decimals: number): string {
  const raw = value.padStart(decimals + 1,"0");
  if (decimals === 0) return raw;
  return `${raw.slice(0,-decimals)}.${raw.slice(-decimals).replace(/0+$/,"") || "0"}`;
}
export function targetBps(percent: string): number {
  if (/^0(?:\.0{1,2})?$/.test(percent)) return 0;
  const value = BigInt(decimalUnits(percent,2));
  if (value > 10000n) throw new Error("Target weights must be between 0 and 100%.");
  return Number(value);
}
