import { assertEquals } from "../../testing/asserts.ts";
import { reverseBits } from "./utils.ts";

Deno.test({
  name: "[flate/util] reverseBit",
  fn(): void {
    assertEquals(
      reverseBits(0b1011),
      0b1101000000000000,
    );
    assertEquals(
      reverseBits(0b1000101100001001),
      0b1001000011010001,
    );
  },
});
