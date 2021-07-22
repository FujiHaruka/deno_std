export function reverseBits(x: number): number {
  return parseInt(x.toString(2).split("").reverse().join(""), 2);
}
