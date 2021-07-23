import { assertEquals } from "../../testing/asserts.ts";
import { Hcode, HuffmanEncoder } from "./huffman_code.ts";

Deno.test("HuffmanEncoder", () => {
  const h = new HuffmanEncoder(4);
  h.generate([1, 3, 2, 4], 7);
  assertEquals(h.codes, [
    new Hcode(3, 3),
    new Hcode(1, 2),
    new Hcode(7, 3),
    new Hcode(0, 1),
  ]);
  assertEquals(h.bitCount, [0, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});
