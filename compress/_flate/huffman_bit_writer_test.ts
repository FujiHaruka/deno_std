// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { assertEquals, assertNotEquals } from "../../testing/asserts.ts";
import { expandGlob } from "../../fs/expand_glob.ts";
import { sprintf } from "../../fmt/printf.ts";
import { Buffer } from "../../io/buffer.ts";
import { HuffmanBitWriter } from "./huffman_bit_writer.ts";
import { Token } from "./token.ts";

Deno.test("HuffmanBitWriter / block", async () => {
  const files = expandGlob("testdata/huffman-*.in");

  for await (const file of files) {
    let out = file.path; // for files where input and output are identical
    if (out.endsWith(".in")) {
      out = out.replace(/\.in$/, ".golden");
    }
    await testBlockHuff(file.path, out);
  }

  async function testBlockHuff(src: string, expected: string) {
    const all = await Deno.readFile(src);

    const buf = new Buffer();
    const bw = new HuffmanBitWriter(buf);

    await bw.writeBlockHuff(false, all);
    assertEquals(bw.err, undefined);
    await bw.flush();
    let got = buf.bytes();
    const want = await Deno.readFile(expected);

    await assertBytesEqual(got, want, { src, expected });

    // Test if the writer produces the same output after reset.
    buf.reset();
    bw.reset(buf);
    await bw.writeBlockHuff(false, all);
    await bw.flush();
    got = buf.bytes();
    await assertBytesEqual(got, want, { src, expected });
  }
});

interface HuffTest {
  tokens: Token[];
  // File name of input data matching the tokens.
  input: string;
  // File name of data with the expected output with input available.
  want: string;
  // File name of the expected output when no input is available.
  wantNoInput: string;
}

/** Maximum length token. Used to reduce the size of writeBlockTests */
const ml = 0x7fc00000;

const writeBlockTests: HuffTest[] = [
  {
    input: "testdata/huffman-null-max.in",
    want: "testdata/huffman-null-max.%s.expect",
    wantNoInput: "testdata/huffman-null-max.%s.expect-noinput",
    // deno-fmt-ignore
    tokens: [0x0, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, 0x0, 0x0].map((value) => new Token(value)),
  },
  {
    input: "testdata/huffman-pi.in",
    want: "testdata/huffman-pi.%s.expect",
    wantNoInput: "testdata/huffman-pi.%s.expect-noinput",
    // deno-fmt-ignore
    tokens:      [0x33, 0x2e, 0x31, 0x34, 0x31, 0x35, 0x39, 0x32, 0x36, 0x35, 0x33, 0x35, 0x38, 0x39, 0x37, 0x39, 0x33, 0x32, 0x33, 0x38, 0x34, 0x36, 0x32, 0x36, 0x34, 0x33, 0x33, 0x38, 0x33, 0x32, 0x37, 0x39, 0x35, 0x30, 0x32, 0x38, 0x38, 0x34, 0x31, 0x39, 0x37, 0x31, 0x36, 0x39, 0x33, 0x39, 0x39, 0x33, 0x37, 0x35, 0x31, 0x30, 0x35, 0x38, 0x32, 0x30, 0x39, 0x37, 0x34, 0x39, 0x34, 0x34, 0x35, 0x39, 0x32, 0x33, 0x30, 0x37, 0x38, 0x31, 0x36, 0x34, 0x30, 0x36, 0x32, 0x38, 0x36, 0x32, 0x30, 0x38, 0x39, 0x39, 0x38, 0x36, 0x32, 0x38, 0x30, 0x33, 0x34, 0x38, 0x32, 0x35, 0x33, 0x34, 0x32, 0x31, 0x31, 0x37, 0x30, 0x36, 0x37, 0x39, 0x38, 0x32, 0x31, 0x34, 0x38, 0x30, 0x38, 0x36, 0x35, 0x31, 0x33, 0x32, 0x38, 0x32, 0x33, 0x30, 0x36, 0x36, 0x34, 0x37, 0x30, 0x39, 0x33, 0x38, 0x34, 0x34, 0x36, 0x30, 0x39, 0x35, 0x35, 0x30, 0x35, 0x38, 0x32, 0x32, 0x33, 0x31, 0x37, 0x32, 0x35, 0x33, 0x35, 0x39, 0x34, 0x30, 0x38, 0x31, 0x32, 0x38, 0x34, 0x38, 0x31, 0x31, 0x31, 0x37, 0x34, 0x4040007e, 0x34, 0x31, 0x30, 0x32, 0x37, 0x30, 0x31, 0x39, 0x33, 0x38, 0x35, 0x32, 0x31, 0x31, 0x30, 0x35, 0x35, 0x35, 0x39, 0x36, 0x34, 0x34, 0x36, 0x32, 0x32, 0x39, 0x34, 0x38, 0x39, 0x35, 0x34, 0x39, 0x33, 0x30, 0x33, 0x38, 0x31, 0x40400012, 0x32, 0x38, 0x38, 0x31, 0x30, 0x39, 0x37, 0x35, 0x36, 0x36, 0x35, 0x39, 0x33, 0x33, 0x34, 0x34, 0x36, 0x40400047, 0x37, 0x35, 0x36, 0x34, 0x38, 0x32, 0x33, 0x33, 0x37, 0x38, 0x36, 0x37, 0x38, 0x33, 0x31, 0x36, 0x35, 0x32, 0x37, 0x31, 0x32, 0x30, 0x31, 0x39, 0x30, 0x39, 0x31, 0x34, 0x4040001a, 0x35, 0x36, 0x36, 0x39, 0x32, 0x33, 0x34, 0x36, 0x404000b2, 0x36, 0x31, 0x30, 0x34, 0x35, 0x34, 0x33, 0x32, 0x36, 0x40400032, 0x31, 0x33, 0x33, 0x39, 0x33, 0x36, 0x30, 0x37, 0x32, 0x36, 0x30, 0x32, 0x34, 0x39, 0x31, 0x34, 0x31, 0x32, 0x37, 0x33, 0x37, 0x32, 0x34, 0x35, 0x38, 0x37, 0x30, 0x30, 0x36, 0x36, 0x30, 0x36, 0x33, 0x31, 0x35, 0x35, 0x38, 0x38, 0x31, 0x37, 0x34, 0x38, 0x38, 0x31, 0x35, 0x32, 0x30, 0x39, 0x32, 0x30, 0x39, 0x36, 0x32, 0x38, 0x32, 0x39, 0x32, 0x35, 0x34, 0x30, 0x39, 0x31, 0x37, 0x31, 0x35, 0x33, 0x36, 0x34, 0x33, 0x36, 0x37, 0x38, 0x39, 0x32, 0x35, 0x39, 0x30, 0x33, 0x36, 0x30, 0x30, 0x31, 0x31, 0x33, 0x33, 0x30, 0x35, 0x33, 0x30, 0x35, 0x34, 0x38, 0x38, 0x32, 0x30, 0x34, 0x36, 0x36, 0x35, 0x32, 0x31, 0x33, 0x38, 0x34, 0x31, 0x34, 0x36, 0x39, 0x35, 0x31, 0x39, 0x34, 0x31, 0x35, 0x31, 0x31, 0x36, 0x30, 0x39, 0x34, 0x33, 0x33, 0x30, 0x35, 0x37, 0x32, 0x37, 0x30, 0x33, 0x36, 0x35, 0x37, 0x35, 0x39, 0x35, 0x39, 0x31, 0x39, 0x35, 0x33, 0x30, 0x39, 0x32, 0x31, 0x38, 0x36, 0x31, 0x31, 0x37, 0x404000e9, 0x33, 0x32, 0x40400009, 0x39, 0x33, 0x31, 0x30, 0x35, 0x31, 0x31, 0x38, 0x35, 0x34, 0x38, 0x30, 0x37, 0x4040010e, 0x33, 0x37, 0x39, 0x39, 0x36, 0x32, 0x37, 0x34, 0x39, 0x35, 0x36, 0x37, 0x33, 0x35, 0x31, 0x38, 0x38, 0x35, 0x37, 0x35, 0x32, 0x37, 0x32, 0x34, 0x38, 0x39, 0x31, 0x32, 0x32, 0x37, 0x39, 0x33, 0x38, 0x31, 0x38, 0x33, 0x30, 0x31, 0x31, 0x39, 0x34, 0x39, 0x31, 0x32, 0x39, 0x38, 0x33, 0x33, 0x36, 0x37, 0x33, 0x33, 0x36, 0x32, 0x34, 0x34, 0x30, 0x36, 0x35, 0x36, 0x36, 0x34, 0x33, 0x30, 0x38, 0x36, 0x30, 0x32, 0x31, 0x33, 0x39, 0x34, 0x39, 0x34, 0x36, 0x33, 0x39, 0x35, 0x32, 0x32, 0x34, 0x37, 0x33, 0x37, 0x31, 0x39, 0x30, 0x37, 0x30, 0x32, 0x31, 0x37, 0x39, 0x38, 0x40800099, 0x37, 0x30, 0x32, 0x37, 0x37, 0x30, 0x35, 0x33, 0x39, 0x32, 0x31, 0x37, 0x31, 0x37, 0x36, 0x32, 0x39, 0x33, 0x31, 0x37, 0x36, 0x37, 0x35, 0x40800232, 0x37, 0x34, 0x38, 0x31, 0x40400006, 0x36, 0x36, 0x39, 0x34, 0x30, 0x404001e7, 0x30, 0x30, 0x30, 0x35, 0x36, 0x38, 0x31, 0x32, 0x37, 0x31, 0x34, 0x35, 0x32, 0x36, 0x33, 0x35, 0x36, 0x30, 0x38, 0x32, 0x37, 0x37, 0x38, 0x35, 0x37, 0x37, 0x31, 0x33, 0x34, 0x32, 0x37, 0x35, 0x37, 0x37, 0x38, 0x39, 0x36, 0x40400129, 0x33, 0x36, 0x33, 0x37, 0x31, 0x37, 0x38, 0x37, 0x32, 0x31, 0x34, 0x36, 0x38, 0x34, 0x34, 0x30, 0x39, 0x30, 0x31, 0x32, 0x32, 0x34, 0x39, 0x35, 0x33, 0x34, 0x33, 0x30, 0x31, 0x34, 0x36, 0x35, 0x34, 0x39, 0x35, 0x38, 0x35, 0x33, 0x37, 0x31, 0x30, 0x35, 0x30, 0x37, 0x39, 0x404000ca, 0x36, 0x40400153, 0x38, 0x39, 0x32, 0x33, 0x35, 0x34, 0x404001c9, 0x39, 0x35, 0x36, 0x31, 0x31, 0x32, 0x31, 0x32, 0x39, 0x30, 0x32, 0x31, 0x39, 0x36, 0x30, 0x38, 0x36, 0x34, 0x30, 0x33, 0x34, 0x34, 0x31, 0x38, 0x31, 0x35, 0x39, 0x38, 0x31, 0x33, 0x36, 0x32, 0x39, 0x37, 0x37, 0x34, 0x40400074, 0x30, 0x39, 0x39, 0x36, 0x30, 0x35, 0x31, 0x38, 0x37, 0x30, 0x37, 0x32, 0x31, 0x31, 0x33, 0x34, 0x39, 0x40800000, 0x38, 0x33, 0x37, 0x32, 0x39, 0x37, 0x38, 0x30, 0x34, 0x39, 0x39, 0x404002da, 0x39, 0x37, 0x33, 0x31, 0x37, 0x33, 0x32, 0x38, 0x4040018a, 0x36, 0x33, 0x31, 0x38, 0x35, 0x40400301, 0x404002e8, 0x34, 0x35, 0x35, 0x33, 0x34, 0x36, 0x39, 0x30, 0x38, 0x33, 0x30, 0x32, 0x36, 0x34, 0x32, 0x35, 0x32, 0x32, 0x33, 0x30, 0x404002e3, 0x40400267, 0x38, 0x35, 0x30, 0x33, 0x35, 0x32, 0x36, 0x31, 0x39, 0x33, 0x31, 0x31, 0x40400212, 0x31, 0x30, 0x31, 0x30, 0x30, 0x30, 0x33, 0x31, 0x33, 0x37, 0x38, 0x33, 0x38, 0x37, 0x35, 0x32, 0x38, 0x38, 0x36, 0x35, 0x38, 0x37, 0x35, 0x33, 0x33, 0x32, 0x30, 0x38, 0x33, 0x38, 0x31, 0x34, 0x32, 0x30, 0x36, 0x40400140, 0x4040012b, 0x31, 0x34, 0x37, 0x33, 0x30, 0x33, 0x35, 0x39, 0x4080032e, 0x39, 0x30, 0x34, 0x32, 0x38, 0x37, 0x35, 0x35, 0x34, 0x36, 0x38, 0x37, 0x33, 0x31, 0x31, 0x35, 0x39, 0x35, 0x40400355, 0x33, 0x38, 0x38, 0x32, 0x33, 0x35, 0x33, 0x37, 0x38, 0x37, 0x35, 0x4080037f, 0x39, 0x4040013a, 0x31, 0x40400148, 0x38, 0x30, 0x35, 0x33, 0x4040018a, 0x32, 0x32, 0x36, 0x38, 0x30, 0x36, 0x36, 0x31, 0x33, 0x30, 0x30, 0x31, 0x39, 0x32, 0x37, 0x38, 0x37, 0x36, 0x36, 0x31, 0x31, 0x31, 0x39, 0x35, 0x39, 0x40400237, 0x36, 0x40800124, 0x38, 0x39, 0x33, 0x38, 0x30, 0x39, 0x35, 0x32, 0x35, 0x37, 0x32, 0x30, 0x31, 0x30, 0x36, 0x35, 0x34, 0x38, 0x35, 0x38, 0x36, 0x33, 0x32, 0x37, 0x4040009a, 0x39, 0x33, 0x36, 0x31, 0x35, 0x33, 0x40400220, 0x4080015c, 0x32, 0x33, 0x30, 0x33, 0x30, 0x31, 0x39, 0x35, 0x32, 0x30, 0x33, 0x35, 0x33, 0x30, 0x31, 0x38, 0x35, 0x32, 0x40400171, 0x40400075, 0x33, 0x36, 0x32, 0x32, 0x35, 0x39, 0x39, 0x34, 0x31, 0x33, 0x40400254, 0x34, 0x39, 0x37, 0x32, 0x31, 0x37, 0x404000de, 0x33, 0x34, 0x37, 0x39, 0x31, 0x33, 0x31, 0x35, 0x31, 0x35, 0x35, 0x37, 0x34, 0x38, 0x35, 0x37, 0x32, 0x34, 0x32, 0x34, 0x35, 0x34, 0x31, 0x35, 0x30, 0x36, 0x39, 0x4040013f, 0x38, 0x32, 0x39, 0x35, 0x33, 0x33, 0x31, 0x31, 0x36, 0x38, 0x36, 0x31, 0x37, 0x32, 0x37, 0x38, 0x40400337, 0x39, 0x30, 0x37, 0x35, 0x30, 0x39, 0x4040010d, 0x37, 0x35, 0x34, 0x36, 0x33, 0x37, 0x34, 0x36, 0x34, 0x39, 0x33, 0x39, 0x33, 0x31, 0x39, 0x32, 0x35, 0x35, 0x30, 0x36, 0x30, 0x34, 0x30, 0x30, 0x39, 0x4040026b, 0x31, 0x36, 0x37, 0x31, 0x31, 0x33, 0x39, 0x30, 0x30, 0x39, 0x38, 0x40400335, 0x34, 0x30, 0x31, 0x32, 0x38, 0x35, 0x38, 0x33, 0x36, 0x31, 0x36, 0x30, 0x33, 0x35, 0x36, 0x33, 0x37, 0x30, 0x37, 0x36, 0x36, 0x30, 0x31, 0x30, 0x34, 0x40400172, 0x38, 0x31, 0x39, 0x34, 0x32, 0x39, 0x4080041e, 0x404000ef, 0x4040028b, 0x37, 0x38, 0x33, 0x37, 0x34, 0x404004a8, 0x38, 0x32, 0x35, 0x35, 0x33, 0x37, 0x40800209, 0x32, 0x36, 0x38, 0x4040002e, 0x34, 0x30, 0x34, 0x37, 0x404001d1, 0x34, 0x404004b5, 0x4040038d, 0x38, 0x34, 0x404003a8, 0x36, 0x40c0031f, 0x33, 0x33, 0x31, 0x33, 0x36, 0x37, 0x37, 0x30, 0x32, 0x38, 0x39, 0x38, 0x39, 0x31, 0x35, 0x32, 0x40400062, 0x35, 0x32, 0x31, 0x36, 0x32, 0x30, 0x35, 0x36, 0x39, 0x36, 0x40400411, 0x30, 0x35, 0x38, 0x40400477, 0x35, 0x40400498, 0x35, 0x31, 0x31, 0x40400209, 0x38, 0x32, 0x34, 0x33, 0x30, 0x30, 0x33, 0x35, 0x35, 0x38, 0x37, 0x36, 0x34, 0x30, 0x32, 0x34, 0x37, 0x34, 0x39, 0x36, 0x34, 0x37, 0x33, 0x32, 0x36, 0x33, 0x4040043e, 0x39, 0x39, 0x32, 0x4040044b, 0x34, 0x32, 0x36, 0x39, 0x40c002c5, 0x37, 0x404001d6, 0x34, 0x4040053d, 0x4040041d, 0x39, 0x33, 0x34, 0x31, 0x37, 0x404001ad, 0x31, 0x32, 0x4040002a, 0x34, 0x4040019e, 0x31, 0x35, 0x30, 0x33, 0x30, 0x32, 0x38, 0x36, 0x31, 0x38, 0x32, 0x39, 0x37, 0x34, 0x35, 0x35, 0x35, 0x37, 0x30, 0x36, 0x37, 0x34, 0x40400135, 0x35, 0x30, 0x35, 0x34, 0x39, 0x34, 0x35, 0x38, 0x404001c5, 0x39, 0x40400051, 0x35, 0x36, 0x404001ec, 0x37, 0x32, 0x31, 0x30, 0x37, 0x39, 0x40400159, 0x33, 0x30, 0x4040010a, 0x33, 0x32, 0x31, 0x31, 0x36, 0x35, 0x33, 0x34, 0x34, 0x39, 0x38, 0x37, 0x32, 0x30, 0x32, 0x37, 0x4040011b, 0x30, 0x32, 0x33, 0x36, 0x34, 0x4040022e, 0x35, 0x34, 0x39, 0x39, 0x31, 0x31, 0x39, 0x38, 0x40400418, 0x34, 0x4040011b, 0x35, 0x33, 0x35, 0x36, 0x36, 0x33, 0x36, 0x39, 0x40400450, 0x32, 0x36, 0x35, 0x404002e4, 0x37, 0x38, 0x36, 0x32, 0x35, 0x35, 0x31, 0x404003da, 0x31, 0x37, 0x35, 0x37, 0x34, 0x36, 0x37, 0x32, 0x38, 0x39, 0x30, 0x39, 0x37, 0x37, 0x37, 0x37, 0x40800453, 0x30, 0x30, 0x30, 0x404005fd, 0x37, 0x30, 0x404004df, 0x36, 0x404003e9, 0x34, 0x39, 0x31, 0x4040041e, 0x40400297, 0x32, 0x31, 0x34, 0x37, 0x37, 0x32, 0x33, 0x35, 0x30, 0x31, 0x34, 0x31, 0x34, 0x40400643, 0x33, 0x35, 0x36, 0x404004af, 0x31, 0x36, 0x31, 0x33, 0x36, 0x31, 0x31, 0x35, 0x37, 0x33, 0x35, 0x32, 0x35, 0x40400504, 0x33, 0x34, 0x4040005b, 0x31, 0x38, 0x4040047b, 0x38, 0x34, 0x404005e7, 0x33, 0x33, 0x32, 0x33, 0x39, 0x30, 0x37, 0x33, 0x39, 0x34, 0x31, 0x34, 0x33, 0x33, 0x33, 0x34, 0x35, 0x34, 0x37, 0x37, 0x36, 0x32, 0x34, 0x40400242, 0x32, 0x35, 0x31, 0x38, 0x39, 0x38, 0x33, 0x35, 0x36, 0x39, 0x34, 0x38, 0x35, 0x35, 0x36, 0x32, 0x30, 0x39, 0x39, 0x32, 0x31, 0x39, 0x32, 0x32, 0x32, 0x31, 0x38, 0x34, 0x32, 0x37, 0x4040023e, 0x32, 0x404000ba, 0x36, 0x38, 0x38, 0x37, 0x36, 0x37, 0x31, 0x37, 0x39, 0x30, 0x40400055, 0x30, 0x40800106, 0x36, 0x36, 0x404003e7, 0x38, 0x38, 0x36, 0x32, 0x37, 0x32, 0x404006dc, 0x31, 0x37, 0x38, 0x36, 0x30, 0x38, 0x35, 0x37, 0x40400073, 0x33, 0x408002fc, 0x37, 0x39, 0x37, 0x36, 0x36, 0x38, 0x31, 0x404002bd, 0x30, 0x30, 0x39, 0x35, 0x33, 0x38, 0x38, 0x40400638, 0x33, 0x404006a5, 0x30, 0x36, 0x38, 0x30, 0x30, 0x36, 0x34, 0x32, 0x32, 0x35, 0x31, 0x32, 0x35, 0x32, 0x4040057b, 0x37, 0x33, 0x39, 0x32, 0x40400297, 0x40400474, 0x34, 0x408006b3, 0x38, 0x36, 0x32, 0x36, 0x39, 0x34, 0x35, 0x404001e5, 0x34, 0x31, 0x39, 0x36, 0x35, 0x32, 0x38, 0x35, 0x30, 0x40400099, 0x4040039c, 0x31, 0x38, 0x36, 0x33, 0x404001be, 0x34, 0x40800154, 0x32, 0x30, 0x33, 0x39, 0x4040058b, 0x34, 0x35, 0x404002bc, 0x32, 0x33, 0x37, 0x4040042c, 0x36, 0x40400510, 0x35, 0x36, 0x40400638, 0x37, 0x31, 0x39, 0x31, 0x37, 0x32, 0x38, 0x40400171, 0x37, 0x36, 0x34, 0x36, 0x35, 0x37, 0x35, 0x37, 0x33, 0x39, 0x40400101, 0x33, 0x38, 0x39, 0x40400748, 0x38, 0x33, 0x32, 0x36, 0x34, 0x35, 0x39, 0x39, 0x35, 0x38, 0x404006a7, 0x30, 0x34, 0x37, 0x38, 0x404001de, 0x40400328, 0x39, 0x4040002d, 0x36, 0x34, 0x30, 0x37, 0x38, 0x39, 0x35, 0x31, 0x4040008e, 0x36, 0x38, 0x33, 0x4040012f, 0x32, 0x35, 0x39, 0x35, 0x37, 0x30, 0x40400468, 0x38, 0x32, 0x32, 0x404002c8, 0x32, 0x4040061b, 0x34, 0x30, 0x37, 0x37, 0x32, 0x36, 0x37, 0x31, 0x39, 0x34, 0x37, 0x38, 0x40400319, 0x38, 0x32, 0x36, 0x30, 0x31, 0x34, 0x37, 0x36, 0x39, 0x39, 0x30, 0x39, 0x404004e8, 0x30, 0x31, 0x33, 0x36, 0x33, 0x39, 0x34, 0x34, 0x33, 0x4040027f, 0x33, 0x30, 0x40400105, 0x32, 0x30, 0x33, 0x34, 0x39, 0x36, 0x32, 0x35, 0x32, 0x34, 0x35, 0x31, 0x37, 0x404003b5, 0x39, 0x36, 0x35, 0x31, 0x34, 0x33, 0x31, 0x34, 0x32, 0x39, 0x38, 0x30, 0x39, 0x31, 0x39, 0x30, 0x36, 0x35, 0x39, 0x32, 0x40400282, 0x37, 0x32, 0x32, 0x31, 0x36, 0x39, 0x36, 0x34, 0x36, 0x40400419, 0x4040007a, 0x35, 0x4040050e, 0x34, 0x40800565, 0x38, 0x40400559, 0x39, 0x37, 0x4040057b, 0x35, 0x34, 0x4040049d, 0x4040023e, 0x37, 0x4040065a, 0x38, 0x34, 0x36, 0x38, 0x31, 0x33, 0x4040008c, 0x36, 0x38, 0x33, 0x38, 0x36, 0x38, 0x39, 0x34, 0x32, 0x37, 0x37, 0x34, 0x31, 0x35, 0x35, 0x39, 0x39, 0x31, 0x38, 0x35, 0x4040005a, 0x32, 0x34, 0x35, 0x39, 0x35, 0x33, 0x39, 0x35, 0x39, 0x34, 0x33, 0x31, 0x404005b7, 0x37, 0x40400012, 0x36, 0x38, 0x30, 0x38, 0x34, 0x35, 0x404002e7, 0x37, 0x33, 0x4040081e, 0x39, 0x35, 0x38, 0x34, 0x38, 0x36, 0x35, 0x33, 0x38, 0x404006e8, 0x36, 0x32, 0x404000f2, 0x36, 0x30, 0x39, 0x404004b6, 0x36, 0x30, 0x38, 0x30, 0x35, 0x31, 0x32, 0x34, 0x33, 0x38, 0x38, 0x34, 0x4040013a, 0x4040000b, 0x34, 0x31, 0x33, 0x4040030f, 0x37, 0x36, 0x32, 0x37, 0x38, 0x40400341, 0x37, 0x31, 0x35, 0x4040059b, 0x33, 0x35, 0x39, 0x39, 0x37, 0x37, 0x30, 0x30, 0x31, 0x32, 0x39, 0x40400472, 0x38, 0x39, 0x34, 0x34, 0x31, 0x40400277, 0x36, 0x38, 0x35, 0x35, 0x4040005f, 0x34, 0x30, 0x36, 0x33, 0x404008e6, 0x32, 0x30, 0x37, 0x32, 0x32, 0x40400158, 0x40800203, 0x34, 0x38, 0x31, 0x35, 0x38, 0x40400205, 0x404001fe, 0x4040027a, 0x40400298, 0x33, 0x39, 0x34, 0x35, 0x32, 0x32, 0x36, 0x37, 0x40c00496, 0x38, 0x4040058a, 0x32, 0x31, 0x404002ea, 0x32, 0x40400387, 0x35, 0x34, 0x36, 0x36, 0x36, 0x4040051b, 0x32, 0x33, 0x39, 0x38, 0x36, 0x34, 0x35, 0x36, 0x404004c4, 0x31, 0x36, 0x33, 0x35, 0x40800253, 0x40400811, 0x37, 0x404008ad, 0x39, 0x38, 0x4040045e, 0x39, 0x33, 0x36, 0x33, 0x34, 0x4040075b, 0x37, 0x34, 0x33, 0x32, 0x34, 0x4040047b, 0x31, 0x35, 0x30, 0x37, 0x36, 0x404004bb, 0x37, 0x39, 0x34, 0x35, 0x31, 0x30, 0x39, 0x4040003e, 0x30, 0x39, 0x34, 0x30, 0x404006a6, 0x38, 0x38, 0x37, 0x39, 0x37, 0x31, 0x30, 0x38, 0x39, 0x33, 0x404008f0, 0x36, 0x39, 0x31, 0x33, 0x36, 0x38, 0x36, 0x37, 0x32, 0x4040025b, 0x404001fe, 0x35, 0x4040053f, 0x40400468, 0x40400801, 0x31, 0x37, 0x39, 0x32, 0x38, 0x36, 0x38, 0x404008cc, 0x38, 0x37, 0x34, 0x37, 0x4080079e, 0x38, 0x32, 0x34, 0x4040097a, 0x38, 0x4040025b, 0x37, 0x31, 0x34, 0x39, 0x30, 0x39, 0x36, 0x37, 0x35, 0x39, 0x38, 0x404006ef, 0x33, 0x36, 0x35, 0x40400134, 0x38, 0x31, 0x4040005c, 0x40400745, 0x40400936, 0x36, 0x38, 0x32, 0x39, 0x4040057e, 0x38, 0x37, 0x32, 0x32, 0x36, 0x35, 0x38, 0x38, 0x30, 0x40400611, 0x35, 0x40400249, 0x34, 0x32, 0x37, 0x30, 0x34, 0x37, 0x37, 0x35, 0x35, 0x4040081e, 0x33, 0x37, 0x39, 0x36, 0x34, 0x31, 0x34, 0x35, 0x31, 0x35, 0x32, 0x404005fd, 0x32, 0x33, 0x34, 0x33, 0x36, 0x34, 0x35, 0x34, 0x404005de, 0x34, 0x34, 0x34, 0x37, 0x39, 0x35, 0x4040003c, 0x40400523, 0x408008e6, 0x34, 0x31, 0x4040052a, 0x33, 0x40400304, 0x35, 0x32, 0x33, 0x31, 0x40800841, 0x31, 0x36, 0x36, 0x31, 0x404008b2, 0x35, 0x39, 0x36, 0x39, 0x35, 0x33, 0x36, 0x32, 0x33, 0x31, 0x34, 0x404005ff, 0x32, 0x34, 0x38, 0x34, 0x39, 0x33, 0x37, 0x31, 0x38, 0x37, 0x31, 0x31, 0x30, 0x31, 0x34, 0x35, 0x37, 0x36, 0x35, 0x34, 0x40400761, 0x30, 0x32, 0x37, 0x39, 0x39, 0x33, 0x34, 0x34, 0x30, 0x33, 0x37, 0x34, 0x32, 0x30, 0x30, 0x37, 0x4040093f, 0x37, 0x38, 0x35, 0x33, 0x39, 0x30, 0x36, 0x32, 0x31, 0x39, 0x40800299, 0x40400345, 0x38, 0x34, 0x37, 0x408003d2, 0x38, 0x33, 0x33, 0x32, 0x31, 0x34, 0x34, 0x35, 0x37, 0x31, 0x40400284, 0x40400776, 0x34, 0x33, 0x35, 0x30, 0x40400928, 0x40400468, 0x35, 0x33, 0x31, 0x39, 0x31, 0x30, 0x34, 0x38, 0x34, 0x38, 0x31, 0x30, 0x30, 0x35, 0x33, 0x37, 0x30, 0x36, 0x404008bc, 0x4080059d, 0x40800781, 0x31, 0x40400559, 0x37, 0x4040031b, 0x35, 0x404007ec, 0x4040040c, 0x36, 0x33, 0x408007dc, 0x34, 0x40400971, 0x4080034e, 0x408003f5, 0x38, 0x4080052d, 0x40800887, 0x39, 0x40400187, 0x39, 0x31, 0x404008ce, 0x38, 0x31, 0x34, 0x36, 0x37, 0x35, 0x31, 0x4040062b, 0x31, 0x32, 0x33, 0x39, 0x40c001a9, 0x39, 0x30, 0x37, 0x31, 0x38, 0x36, 0x34, 0x39, 0x34, 0x32, 0x33, 0x31, 0x39, 0x36, 0x31, 0x35, 0x36, 0x404001ec, 0x404006bc, 0x39, 0x35, 0x40400926, 0x40400469, 0x4040011b, 0x36, 0x30, 0x33, 0x38, 0x40400a25, 0x4040016f, 0x40400384, 0x36, 0x32, 0x4040045a, 0x35, 0x4040084c, 0x36, 0x33, 0x38, 0x39, 0x33, 0x37, 0x37, 0x38, 0x37, 0x404008c5, 0x404000f8, 0x39, 0x37, 0x39, 0x32, 0x30, 0x37, 0x37, 0x33, 0x404005d7, 0x32, 0x31, 0x38, 0x32, 0x35, 0x36, 0x404007df, 0x36, 0x36, 0x404006d6, 0x34, 0x32, 0x4080067e, 0x36, 0x404006e6, 0x34, 0x34, 0x40400024, 0x35, 0x34, 0x39, 0x32, 0x30, 0x32, 0x36, 0x30, 0x35, 0x40400ab3, 0x408003e4, 0x32, 0x30, 0x31, 0x34, 0x39, 0x404004d2, 0x38, 0x35, 0x30, 0x37, 0x33, 0x40400599, 0x36, 0x36, 0x36, 0x30, 0x40400194, 0x32, 0x34, 0x33, 0x34, 0x30, 0x40400087, 0x30, 0x4040076b, 0x38, 0x36, 0x33, 0x40400956, 0x404007e4, 0x4040042b, 0x40400174, 0x35, 0x37, 0x39, 0x36, 0x32, 0x36, 0x38, 0x35, 0x36, 0x40400140, 0x35, 0x30, 0x38, 0x40400523, 0x35, 0x38, 0x37, 0x39, 0x36, 0x39, 0x39, 0x40400711, 0x35, 0x37, 0x34, 0x40400a18, 0x38, 0x34, 0x30, 0x404008b3, 0x31, 0x34, 0x35, 0x39, 0x31, 0x4040078c, 0x37, 0x30, 0x40400234, 0x30, 0x31, 0x40400be7, 0x31, 0x32, 0x40400c74, 0x30, 0x404003c3, 0x33, 0x39, 0x40400b2a, 0x40400112, 0x37, 0x31, 0x35, 0x404003b0, 0x34, 0x32, 0x30, 0x40800bf2, 0x39, 0x40400bc2, 0x30, 0x37, 0x40400341, 0x40400795, 0x40400aaf, 0x40400c62, 0x32, 0x31, 0x40400960, 0x32, 0x35, 0x31, 0x4040057b, 0x40400944, 0x39, 0x32, 0x404001b2, 0x38, 0x32, 0x36, 0x40400b66, 0x32, 0x40400278, 0x33, 0x32, 0x31, 0x35, 0x37, 0x39, 0x31, 0x39, 0x38, 0x34, 0x31, 0x34, 0x4080087b, 0x39, 0x31, 0x36, 0x34, 0x408006e8, 0x39, 0x40800b58, 0x404008db, 0x37, 0x32, 0x32, 0x40400321, 0x35, 0x404008a4, 0x40400141, 0x39, 0x31, 0x30, 0x404000bc, 0x40400c5b, 0x35, 0x32, 0x38, 0x30, 0x31, 0x37, 0x40400231, 0x37, 0x31, 0x32, 0x40400914, 0x38, 0x33, 0x32, 0x40400373, 0x31, 0x40400589, 0x30, 0x39, 0x33, 0x35, 0x33, 0x39, 0x36, 0x35, 0x37, 0x4040064b, 0x31, 0x30, 0x38, 0x33, 0x40400069, 0x35, 0x31, 0x4040077a, 0x40400d5a, 0x31, 0x34, 0x34, 0x34, 0x32, 0x31, 0x30, 0x30, 0x40400202, 0x30, 0x33, 0x4040019c, 0x31, 0x31, 0x30, 0x33, 0x40400c81, 0x40400009, 0x40400026, 0x40c00602, 0x35, 0x31, 0x36, 0x404005d9, 0x40800883, 0x4040092a, 0x35, 0x40800c42, 0x38, 0x35, 0x31, 0x37, 0x31, 0x34, 0x33, 0x37, 0x40400605, 0x4040006d, 0x31, 0x35, 0x35, 0x36, 0x35, 0x30, 0x38, 0x38, 0x404003b9, 0x39, 0x38, 0x39, 0x38, 0x35, 0x39, 0x39, 0x38, 0x32, 0x33, 0x38, 0x404001cf, 0x404009ba, 0x33, 0x4040016c, 0x4040043e, 0x404009c3, 0x38, 0x40800e05, 0x33, 0x32, 0x40400107, 0x35, 0x40400305, 0x33, 0x404001ca, 0x39, 0x4040041b, 0x39, 0x38, 0x4040087d, 0x34, 0x40400cb8, 0x37, 0x4040064b, 0x30, 0x37, 0x404000e5, 0x34, 0x38, 0x31, 0x34, 0x31, 0x40400539, 0x38, 0x35, 0x39, 0x34, 0x36, 0x31, 0x40400bc9, 0x38, 0x30].map((value) => new Token(value)),
  },
  {
    input: "testdata/huffman-rand-1k.in",
    want: "testdata/huffman-rand-1k.%s.expect",
    wantNoInput: "testdata/huffman-rand-1k.%s.expect-noinput",
    // deno-fmt-ignore
    tokens:      [0xf8, 0x8b, 0x96, 0x76, 0x48, 0xd, 0x85, 0x94, 0x25, 0x80, 0xaf, 0xc2, 0xfe, 0x8d, 0xe8, 0x20, 0xeb, 0x17, 0x86, 0xc9, 0xb7, 0xc5, 0xde, 0x6, 0xea, 0x7d, 0x18, 0x8b, 0xe7, 0x3e, 0x7, 0xda, 0xdf, 0xff, 0x6c, 0x73, 0xde, 0xcc, 0xe7, 0x6d, 0x8d, 0x4, 0x19, 0x49, 0x7f, 0x47, 0x1f, 0x48, 0x15, 0xb0, 0xe8, 0x9e, 0xf2, 0x31, 0x59, 0xde, 0x34, 0xb4, 0x5b, 0xe5, 0xe0, 0x9, 0x11, 0x30, 0xc2, 0x88, 0x5b, 0x7c, 0x5d, 0x14, 0x13, 0x6f, 0x23, 0xa9, 0xd, 0xbc, 0x2d, 0x23, 0xbe, 0xd9, 0xed, 0x75, 0x4, 0x6c, 0x99, 0xdf, 0xfd, 0x70, 0x66, 0xe6, 0xee, 0xd9, 0xb1, 0x9e, 0x6e, 0x83, 0x59, 0xd5, 0xd4, 0x80, 0x59, 0x98, 0x77, 0x89, 0x43, 0x38, 0xc9, 0xaf, 0x30, 0x32, 0x9a, 0x20, 0x1b, 0x46, 0x3d, 0x67, 0x6e, 0xd7, 0x72, 0x9e, 0x4e, 0x21, 0x4f, 0xc6, 0xe0, 0xd4, 0x7b, 0x4, 0x8d, 0xa5, 0x3, 0xf6, 0x5, 0x9b, 0x6b, 0xdc, 0x2a, 0x93, 0x77, 0x28, 0xfd, 0xb4, 0x62, 0xda, 0x20, 0xe7, 0x1f, 0xab, 0x6b, 0x51, 0x43, 0x39, 0x2f, 0xa0, 0x92, 0x1, 0x6c, 0x75, 0x3e, 0xf4, 0x35, 0xfd, 0x43, 0x2e, 0xf7, 0xa4, 0x75, 0xda, 0xea, 0x9b, 0xa, 0x64, 0xb, 0xe0, 0x23, 0x29, 0xbd, 0xf7, 0xe7, 0x83, 0x3c, 0xfb, 0xdf, 0xb3, 0xae, 0x4f, 0xa4, 0x47, 0x55, 0x99, 0xde, 0x2f, 0x96, 0x6e, 0x1c, 0x43, 0x4c, 0x87, 0xe2, 0x7c, 0xd9, 0x5f, 0x4c, 0x7c, 0xe8, 0x90, 0x3, 0xdb, 0x30, 0x95, 0xd6, 0x22, 0xc, 0x47, 0xb8, 0x4d, 0x6b, 0xbd, 0x24, 0x11, 0xab, 0x2c, 0xd7, 0xbe, 0x6e, 0x7a, 0xd6, 0x8, 0xa3, 0x98, 0xd8, 0xdd, 0x15, 0x6a, 0xfa, 0x93, 0x30, 0x1, 0x25, 0x1d, 0xa2, 0x74, 0x86, 0x4b, 0x6a, 0x95, 0xe8, 0xe1, 0x4e, 0xe, 0x76, 0xb9, 0x49, 0xa9, 0x5f, 0xa0, 0xa6, 0x63, 0x3c, 0x7e, 0x7e, 0x20, 0x13, 0x4f, 0xbb, 0x66, 0x92, 0xb8, 0x2e, 0xa4, 0xfa, 0x48, 0xcb, 0xae, 0xb9, 0x3c, 0xaf, 0xd3, 0x1f, 0xe1, 0xd5, 0x8d, 0x42, 0x6d, 0xf0, 0xfc, 0x8c, 0xc, 0x0, 0xde, 0x40, 0xab, 0x8b, 0x47, 0x97, 0x4e, 0xa8, 0xcf, 0x8e, 0xdb, 0xa6, 0x8b, 0x20, 0x9, 0x84, 0x7a, 0x66, 0xe5, 0x98, 0x29, 0x2, 0x95, 0xe6, 0x38, 0x32, 0x60, 0x3, 0xe3, 0x9a, 0x1e, 0x54, 0xe8, 0x63, 0x80, 0x48, 0x9c, 0xe7, 0x63, 0x33, 0x6e, 0xa0, 0x65, 0x83, 0xfa, 0xc6, 0xba, 0x7a, 0x43, 0x71, 0x5, 0xf5, 0x68, 0x69, 0x85, 0x9c, 0xba, 0x45, 0xcd, 0x6b, 0xb, 0x19, 0xd1, 0xbb, 0x7f, 0x70, 0x85, 0x92, 0xd1, 0xb4, 0x64, 0x82, 0xb1, 0xe4, 0x62, 0xc5, 0x3c, 0x46, 0x1f, 0x92, 0x31, 0x1c, 0x4e, 0x41, 0x77, 0xf7, 0xe7, 0x87, 0xa2, 0xf, 0x6e, 0xe8, 0x92, 0x3, 0x6b, 0xa, 0xe7, 0xa9, 0x3b, 0x11, 0xda, 0x66, 0x8a, 0x29, 0xda, 0x79, 0xe1, 0x64, 0x8d, 0xe3, 0x54, 0xd4, 0xf5, 0xef, 0x64, 0x87, 0x3b, 0xf4, 0xc2, 0xf4, 0x71, 0x13, 0xa9, 0xe9, 0xe0, 0xa2, 0x6, 0x14, 0xab, 0x5d, 0xa7, 0x96, 0x0, 0xd6, 0xc3, 0xcc, 0x57, 0xed, 0x39, 0x6a, 0x25, 0xcd, 0x76, 0xea, 0xba, 0x3a, 0xf2, 0xa1, 0x95, 0x5d, 0xe5, 0x71, 0xcf, 0x9c, 0x62, 0x9e, 0x6a, 0xfa, 0xd5, 0x31, 0xd1, 0xa8, 0x66, 0x30, 0x33, 0xaa, 0x51, 0x17, 0x13, 0x82, 0x99, 0xc8, 0x14, 0x60, 0x9f, 0x4d, 0x32, 0x6d, 0xda, 0x19, 0x26, 0x21, 0xdc, 0x7e, 0x2e, 0x25, 0x67, 0x72, 0xca, 0xf, 0x92, 0xcd, 0xf6, 0xd6, 0xcb, 0x97, 0x8a, 0x33, 0x58, 0x73, 0x70, 0x91, 0x1d, 0xbf, 0x28, 0x23, 0xa3, 0xc, 0xf1, 0x83, 0xc3, 0xc8, 0x56, 0x77, 0x68, 0xe3, 0x82, 0xba, 0xb9, 0x57, 0x56, 0x57, 0x9c, 0xc3, 0xd6, 0x14, 0x5, 0x3c, 0xb1, 0xaf, 0x93, 0xc8, 0x8a, 0x57, 0x7f, 0x53, 0xfa, 0x2f, 0xaa, 0x6e, 0x66, 0x83, 0xfa, 0x33, 0xd1, 0x21, 0xab, 0x1b, 0x71, 0xb4, 0x7c, 0xda, 0xfd, 0xfb, 0x7f, 0x20, 0xab, 0x5e, 0xd5, 0xca, 0xfd, 0xdd, 0xe0, 0xee, 0xda, 0xba, 0xa8, 0x27, 0x99, 0x97, 0x69, 0xc1, 0x3c, 0x82, 0x8c, 0xa, 0x5c, 0x2d, 0x5b, 0x88, 0x3e, 0x34, 0x35, 0x86, 0x37, 0x46, 0x79, 0xe1, 0xaa, 0x19, 0xfb, 0xaa, 0xde, 0x15, 0x9, 0xd, 0x1a, 0x57, 0xff, 0xb5, 0xf, 0xf3, 0x2b, 0x5a, 0x6a, 0x4d, 0x19, 0x77, 0x71, 0x45, 0xdf, 0x4f, 0xb3, 0xec, 0xf1, 0xeb, 0x18, 0x53, 0x3e, 0x3b, 0x47, 0x8, 0x9a, 0x73, 0xa0, 0x5c, 0x8c, 0x5f, 0xeb, 0xf, 0x3a, 0xc2, 0x43, 0x67, 0xb4, 0x66, 0x67, 0x80, 0x58, 0xe, 0xc1, 0xec, 0x40, 0xd4, 0x22, 0x94, 0xca, 0xf9, 0xe8, 0x92, 0xe4, 0x69, 0x38, 0xbe, 0x67, 0x64, 0xca, 0x50, 0xc7, 0x6, 0x67, 0x42, 0x6e, 0xa3, 0xf0, 0xb7, 0x6c, 0xf2, 0xe8, 0x5f, 0xb1, 0xaf, 0xe7, 0xdb, 0xbb, 0x77, 0xb5, 0xf8, 0xcb, 0x8, 0xc4, 0x75, 0x7e, 0xc0, 0xf9, 0x1c, 0x7f, 0x3c, 0x89, 0x2f, 0xd2, 0x58, 0x3a, 0xe2, 0xf8, 0x91, 0xb6, 0x7b, 0x24, 0x27, 0xe9, 0xae, 0x84, 0x8b, 0xde, 0x74, 0xac, 0xfd, 0xd9, 0xb7, 0x69, 0x2a, 0xec, 0x32, 0x6f, 0xf0, 0x92, 0x84, 0xf1, 0x40, 0xc, 0x8a, 0xbc, 0x39, 0x6e, 0x2e, 0x73, 0xd4, 0x6e, 0x8a, 0x74, 0x2a, 0xdc, 0x60, 0x1f, 0xa3, 0x7, 0xde, 0x75, 0x8b, 0x74, 0xc8, 0xfe, 0x63, 0x75, 0xf6, 0x3d, 0x63, 0xac, 0x33, 0x89, 0xc3, 0xf0, 0xf8, 0x2d, 0x6b, 0xb4, 0x9e, 0x74, 0x8b, 0x5c, 0x33, 0xb4, 0xca, 0xa8, 0xe4, 0x99, 0xb6, 0x90, 0xa1, 0xef, 0xf, 0xd3, 0x61, 0xb2, 0xc6, 0x1a, 0x94, 0x7c, 0x44, 0x55, 0xf4, 0x45, 0xff, 0x9e, 0xa5, 0x5a, 0xc6, 0xa0, 0xe8, 0x2a, 0xc1, 0x8d, 0x6f, 0x34, 0x11, 0xb9, 0xbe, 0x4e, 0xd9, 0x87, 0x97, 0x73, 0xcf, 0x3d, 0x23, 0xae, 0xd5, 0x1a, 0x5e, 0xae, 0x5d, 0x6a, 0x3, 0xf9, 0x22, 0xd, 0x10, 0xd9, 0x47, 0x69, 0x15, 0x3f, 0xee, 0x52, 0xa3, 0x8, 0xd2, 0x3c, 0x51, 0xf4, 0xf8, 0x9d, 0xe4, 0x98, 0x89, 0xc8, 0x67, 0x39, 0xd5, 0x5e, 0x35, 0x78, 0x27, 0xe8, 0x3c, 0x80, 0xae, 0x79, 0x71, 0xd2, 0x93, 0xf4, 0xaa, 0x51, 0x12, 0x1c, 0x4b, 0x1b, 0xe5, 0x6e, 0x15, 0x6f, 0xe4, 0xbb, 0x51, 0x9b, 0x45, 0x9f, 0xf9, 0xc4, 0x8c, 0x2a, 0xfb, 0x1a, 0xdf, 0x55, 0xd3, 0x48, 0x93, 0x27, 0x1, 0x26, 0xc2, 0x6b, 0x55, 0x6d, 0xa2, 0xfb, 0x84, 0x8b, 0xc9, 0x9e, 0x28, 0xc2, 0xef, 0x1a, 0x24, 0xec, 0x9b, 0xae, 0xbd, 0x60, 0xe9, 0x15, 0x35, 0xee, 0x42, 0xa4, 0x33, 0x5b, 0xfa, 0xf, 0xb6, 0xf7, 0x1, 0xa6, 0x2, 0x4c, 0xca, 0x90, 0x58, 0x3a, 0x96, 0x41, 0xe7, 0xcb, 0x9, 0x8c, 0xdb, 0x85, 0x4d, 0xa8, 0x89, 0xf3, 0xb5, 0x8e, 0xfd, 0x75, 0x5b, 0x4f, 0xed, 0xde, 0x3f, 0xeb, 0x38, 0xa3, 0xbe, 0xb0, 0x73, 0xfc, 0xb8, 0x54, 0xf7, 0x4c, 0x30, 0x67, 0x2e, 0x38, 0xa2, 0x54, 0x18, 0xba, 0x8, 0xbf, 0xf2, 0x39, 0xd5, 0xfe, 0xa5, 0x41, 0xc6, 0x66, 0x66, 0xba, 0x81, 0xef, 0x67, 0xe4, 0xe6, 0x3c, 0xc, 0xca, 0xa4, 0xa, 0x79, 0xb3, 0x57, 0x8b, 0x8a, 0x75, 0x98, 0x18, 0x42, 0x2f, 0x29, 0xa3, 0x82, 0xef, 0x9f, 0x86, 0x6, 0x23, 0xe1, 0x75, 0xfa, 0x8, 0xb1, 0xde, 0x17, 0x4a].map((value) => new Token(value)),
  },
  {
    input: "testdata/huffman-rand-limit.in",
    want: "testdata/huffman-rand-limit.%s.expect",
    wantNoInput: "testdata/huffman-rand-limit.%s.expect-noinput",
    // deno-fmt-ignore
    tokens:      [0x61, 0x51c00000, 0xa, 0xf8, 0x8b, 0x96, 0x76, 0x48, 0xa, 0x85, 0x94, 0x25, 0x80, 0xaf, 0xc2, 0xfe, 0x8d, 0xe8, 0x20, 0xeb, 0x17, 0x86, 0xc9, 0xb7, 0xc5, 0xde, 0x6, 0xea, 0x7d, 0x18, 0x8b, 0xe7, 0x3e, 0x7, 0xda, 0xdf, 0xff, 0x6c, 0x73, 0xde, 0xcc, 0xe7, 0x6d, 0x8d, 0x4, 0x19, 0x49, 0x7f, 0x47, 0x1f, 0x48, 0x15, 0xb0, 0xe8, 0x9e, 0xf2, 0x31, 0x59, 0xde, 0x34, 0xb4, 0x5b, 0xe5, 0xe0, 0x9, 0x11, 0x30, 0xc2, 0x88, 0x5b, 0x7c, 0x5d, 0x14, 0x13, 0x6f, 0x23, 0xa9, 0xa, 0xbc, 0x2d, 0x23, 0xbe, 0xd9, 0xed, 0x75, 0x4, 0x6c, 0x99, 0xdf, 0xfd, 0x70, 0x66, 0xe6, 0xee, 0xd9, 0xb1, 0x9e, 0x6e, 0x83, 0x59, 0xd5, 0xd4, 0x80, 0x59, 0x98, 0x77, 0x89, 0x43, 0x38, 0xc9, 0xaf, 0x30, 0x32, 0x9a, 0x20, 0x1b, 0x46, 0x3d, 0x67, 0x6e, 0xd7, 0x72, 0x9e, 0x4e, 0x21, 0x4f, 0xc6, 0xe0, 0xd4, 0x7b, 0x4, 0x8d, 0xa5, 0x3, 0xf6, 0x5, 0x9b, 0x6b, 0xdc, 0x2a, 0x93, 0x77, 0x28, 0xfd, 0xb4, 0x62, 0xda, 0x20, 0xe7, 0x1f, 0xab, 0x6b, 0x51, 0x43, 0x39, 0x2f, 0xa0, 0x92, 0x1, 0x6c, 0x75, 0x3e, 0xf4, 0x35, 0xfd, 0x43, 0x2e, 0xf7, 0xa4, 0x75, 0xda, 0xea, 0x9b, 0xa].map((value) => new Token(value)),
  },
  {
    input: "testdata/huffman-shifts.in",
    want: "testdata/huffman-shifts.%s.expect",
    wantNoInput: "testdata/huffman-shifts.%s.expect-noinput",
    // deno-fmt-ignore
    tokens:      [0x31, 0x30, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x52400001, 0xd, 0xa, 0x32, 0x33, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7fc00001, 0x7f400001].map((value) => new Token(value)),
  },
  {
    input: "testdata/huffman-text-shift.in",
    want: "testdata/huffman-text-shift.%s.expect",
    wantNoInput: "testdata/huffman-text-shift.%s.expect-noinput",
    // deno-fmt-ignore
    tokens:      [0x2f, 0x2f, 0x43, 0x6f, 0x70, 0x79, 0x72, 0x69, 0x67, 0x68, 0x74, 0x32, 0x30, 0x30, 0x39, 0x54, 0x68, 0x47, 0x6f, 0x41, 0x75, 0x74, 0x68, 0x6f, 0x72, 0x2e, 0x41, 0x6c, 0x6c, 0x40800016, 0x72, 0x72, 0x76, 0x64, 0x2e, 0xd, 0xa, 0x2f, 0x2f, 0x55, 0x6f, 0x66, 0x74, 0x68, 0x69, 0x6f, 0x75, 0x72, 0x63, 0x63, 0x6f, 0x64, 0x69, 0x67, 0x6f, 0x76, 0x72, 0x6e, 0x64, 0x62, 0x79, 0x42, 0x53, 0x44, 0x2d, 0x74, 0x79, 0x6c, 0x40400020, 0x6c, 0x69, 0x63, 0x6e, 0x74, 0x68, 0x74, 0x63, 0x6e, 0x62, 0x66, 0x6f, 0x75, 0x6e, 0x64, 0x69, 0x6e, 0x74, 0x68, 0x4c, 0x49, 0x43, 0x45, 0x4e, 0x53, 0x45, 0x66, 0x69, 0x6c, 0x2e, 0xd, 0xa, 0xd, 0xa, 0x70, 0x63, 0x6b, 0x67, 0x6d, 0x69, 0x6e, 0x4040000a, 0x69, 0x6d, 0x70, 0x6f, 0x72, 0x74, 0x22, 0x6f, 0x22, 0x4040000c, 0x66, 0x75, 0x6e, 0x63, 0x6d, 0x69, 0x6e, 0x28, 0x29, 0x7b, 0xd, 0xa, 0x9, 0x76, 0x72, 0x62, 0x3d, 0x6d, 0x6b, 0x28, 0x5b, 0x5d, 0x62, 0x79, 0x74, 0x2c, 0x36, 0x35, 0x35, 0x33, 0x35, 0x29, 0xd, 0xa, 0x9, 0x66, 0x2c, 0x5f, 0x3a, 0x3d, 0x6f, 0x2e, 0x43, 0x72, 0x74, 0x28, 0x22, 0x68, 0x75, 0x66, 0x66, 0x6d, 0x6e, 0x2d, 0x6e, 0x75, 0x6c, 0x6c, 0x2d, 0x6d, 0x78, 0x2e, 0x69, 0x6e, 0x22, 0x40800021, 0x2e, 0x57, 0x72, 0x69, 0x74, 0x28, 0x62, 0x29, 0xd, 0xa, 0x7d, 0xd, 0xa, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x58, 0x78, 0x79, 0x7a, 0x21, 0x22, 0x23, 0xc2, 0xa4, 0x25, 0x26, 0x2f, 0x3f, 0x22].map((value) => new Token(value)),
  },
  {
    input: "testdata/huffman-text.in",
    want: "testdata/huffman-text.%s.expect",
    wantNoInput: "testdata/huffman-text.%s.expect-noinput",
    // deno-fmt-ignore
    tokens:      [0x2f, 0x2f, 0x20, 0x43, 0x6f, 0x70, 0x79, 0x72, 0x69, 0x67, 0x68, 0x74, 0x20, 0x32, 0x30, 0x30, 0x39, 0x20, 0x54, 0x68, 0x65, 0x20, 0x47, 0x6f, 0x20, 0x41, 0x75, 0x74, 0x68, 0x6f, 0x72, 0x73, 0x2e, 0x20, 0x41, 0x6c, 0x6c, 0x20, 0x4080001e, 0x73, 0x20, 0x72, 0x65, 0x73, 0x65, 0x72, 0x76, 0x65, 0x64, 0x2e, 0xd, 0xa, 0x2f, 0x2f, 0x20, 0x55, 0x73, 0x65, 0x20, 0x6f, 0x66, 0x20, 0x74, 0x68, 0x69, 0x73, 0x20, 0x73, 0x6f, 0x75, 0x72, 0x63, 0x65, 0x20, 0x63, 0x6f, 0x64, 0x65, 0x20, 0x69, 0x73, 0x20, 0x67, 0x6f, 0x76, 0x65, 0x72, 0x6e, 0x65, 0x64, 0x20, 0x62, 0x79, 0x20, 0x61, 0x20, 0x42, 0x53, 0x44, 0x2d, 0x73, 0x74, 0x79, 0x6c, 0x65, 0x40800036, 0x6c, 0x69, 0x63, 0x65, 0x6e, 0x73, 0x65, 0x20, 0x74, 0x68, 0x61, 0x74, 0x20, 0x63, 0x61, 0x6e, 0x20, 0x62, 0x65, 0x20, 0x66, 0x6f, 0x75, 0x6e, 0x64, 0x20, 0x69, 0x6e, 0x20, 0x74, 0x68, 0x65, 0x20, 0x4c, 0x49, 0x43, 0x45, 0x4e, 0x53, 0x45, 0x20, 0x66, 0x69, 0x6c, 0x65, 0x2e, 0xd, 0xa, 0xd, 0xa, 0x70, 0x61, 0x63, 0x6b, 0x61, 0x67, 0x65, 0x20, 0x6d, 0x61, 0x69, 0x6e, 0x4040000f, 0x69, 0x6d, 0x70, 0x6f, 0x72, 0x74, 0x20, 0x22, 0x6f, 0x73, 0x22, 0x4040000e, 0x66, 0x75, 0x6e, 0x63, 0x4080001b, 0x28, 0x29, 0x20, 0x7b, 0xd, 0xa, 0x9, 0x76, 0x61, 0x72, 0x20, 0x62, 0x20, 0x3d, 0x20, 0x6d, 0x61, 0x6b, 0x65, 0x28, 0x5b, 0x5d, 0x62, 0x79, 0x74, 0x65, 0x2c, 0x20, 0x36, 0x35, 0x35, 0x33, 0x35, 0x29, 0xd, 0xa, 0x9, 0x66, 0x2c, 0x20, 0x5f, 0x20, 0x3a, 0x3d, 0x20, 0x6f, 0x73, 0x2e, 0x43, 0x72, 0x65, 0x61, 0x74, 0x65, 0x28, 0x22, 0x68, 0x75, 0x66, 0x66, 0x6d, 0x61, 0x6e, 0x2d, 0x6e, 0x75, 0x6c, 0x6c, 0x2d, 0x6d, 0x61, 0x78, 0x2e, 0x69, 0x6e, 0x22, 0x4080002a, 0x2e, 0x57, 0x72, 0x69, 0x74, 0x65, 0x28, 0x62, 0x29, 0xd, 0xa, 0x7d, 0xd, 0xa].map((value) => new Token(value)),
  },
  {
    input: "testdata/huffman-zero.in",
    want: "testdata/huffman-zero.%s.expect",
    wantNoInput: "testdata/huffman-zero.%s.expect-noinput",
    // deno-fmt-ignore
    tokens:      [0x30, ml, 0x4b800000].map((value) => new Token(value)),
  },
  {
    input: "",
    want: "",
    wantNoInput: "testdata/null-long-match.%s.expect-noinput",
    // deno-fmt-ignore
    tokens:      [0x0, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, ml, 0x41400000].map((value) => new Token(value)),
  },
];

Deno.test("writeBlock", async () => {
  // tests if the writeBlock encoding has changed.
  for (const test of writeBlockTests) {
    await testBlock(test, "wb");
  }
});

Deno.test("writeBlockDynamic", async () => {
  // tests if the writeBlockDynamic encoding has changed.
  for (const test of writeBlockTests) {
    await testBlock(test, "dyn");
  }
});

async function testBlock(test: HuffTest, ttype: string) {
  const testWant = test.want ? sprintf(test.want, ttype) : "";
  const wantNoInput = sprintf(test.wantNoInput, ttype);

  if (test.input) {
    const input = await Deno.readFile(test.input);
    const want = await Deno.readFile(testWant);
    const buf = new Buffer();
    const bw = new HuffmanBitWriter(buf);
    await writeToType(ttype, bw, test.tokens, input);
    let got = buf.bytes();
    await assertBytesEqual(got, want, { src: test.input, expected: testWant });

    // Test if the writer produces the same output after reset.
    buf.reset();
    bw.reset(buf);
    await writeToType(ttype, bw, test.tokens, input);
    await bw.flush();
    got = buf.bytes();
    await assertBytesEqual(got, want, { src: test.input, expected: testWant });
    await testWriterEOF(ttype, test, true);
  }

  const wantNI = await Deno.readFile(wantNoInput);
  const buf = new Buffer();
  const bw = new HuffmanBitWriter(buf);
  await writeToType(ttype, bw, test.tokens, null);

  let got = buf.bytes();
  await assertBytesEqual(got, wantNI, {
    src: test.input,
    expected: wantNoInput,
  });
  assertNotEquals(got[0] & 1, 1, "got unexpected EOF");

  // Test if the writer produces the same output after reset.
  buf.reset();
  bw.reset(buf);
  await writeToType(ttype, bw, test.tokens, null);
  await bw.flush();
  got = buf.bytes();
  await assertBytesEqual(got, wantNI, {
    src: test.input,
    expected: wantNoInput,
  });
  await testWriterEOF(ttype, test, false);
}

async function writeToType(
  ttype: string,
  bw: HuffmanBitWriter,
  tok: Token[],
  input: Uint8Array | null,
) {
  switch (ttype) {
    case "wb":
      await bw.writeBlock(tok, false, input);
      break;
    case "dyn":
      await bw.writeBlockDynamic(tok, false, input);
      break;
    default:
      throw new Error("unknown test type");
  }

  if (bw.err) {
    throw bw.err;
  }

  await bw.flush();
  if (bw.err) {
    throw bw.err;
  }
}

// testWriterEOF tests if the written block contains an EOF marker.
async function testWriterEOF(ttype: string, test: HuffTest, useInput: boolean) {
  if (useInput && test.input === "") {
    return;
  }
  let input = new Uint8Array();
  if (useInput) {
    input = await Deno.readFile(test.input);
  }
  const buf = new Buffer();
  const bw = new HuffmanBitWriter(buf);
  switch (ttype) {
    case "wb":
      await bw.writeBlock(test.tokens, true, input);
      break;
    case "dyn":
      await bw.writeBlockDynamic(test.tokens, true, input);
      break;
    case "huff":
      await bw.writeBlockHuff(true, input);
      break;
    default:
      throw new Error("unknown test type");
  }
  if (bw.err) {
    throw bw.err;
  }

  await bw.flush();
  if (bw.err) {
    throw bw.err;
  }

  const b = buf.bytes();
  if (b.length === 0) {
    throw new Error("no output received");
  }
  if ((b[0] & 1) !== 1) {
    throw new Error(`block not marked with EOF for input ${test.input}`);
  }
}

async function assertBytesEqual(
  got: Uint8Array,
  want: Uint8Array,
  options: { src: string; expected: string },
) {
  try {
    assertEquals(
      got,
      want,
      `${options.src} != ${options.expected} (see ${options.src}.got)`,
    );
  } catch (err) {
    await Deno.writeFile(options.src + ".got", got, { mode: 0o666 });
    throw err;
  }
}
