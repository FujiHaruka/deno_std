export function reverseBits(x: number): number {
  return parseInt(x.toString(2).padStart(16, "0").slice(-16).split("").reverse().join(""), 2);
}
