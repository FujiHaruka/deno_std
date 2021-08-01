// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { assertEquals } from "../testing/asserts.ts";

import { crypto as wasmCrypto } from "./mod.ts";
import { _wasmBytes as wasmBytes } from "./crypto.js";
import * as wasmFileModule from "./crypto.wasm.js";
import { varnum } from "../encoding/binary.ts"

const webCrypto = globalThis.crypto;

Deno.test("test", async () => {
  const input = new TextEncoder().encode("SHA-384");

  const wasmDigest = wasmCrypto.digest("SHA-384", input, undefined);

  const webDigest = new Uint8Array(
    await webCrypto.subtle!.digest("SHA-384", input),
  );

  assertEquals(wasmDigest, webDigest);
});

Deno.test("crc32", () => {
  const test = {
    // This test data is from https://github.com/golang/go/blob/b8ca6e59eda969c1d3aed9b0c5bd9e99cf0e7dfe/src/hash/crc32/crc32_test.go#L64
    // Copyright 2009 The Go Authors. All rights reserved.
    // Use of this source code is governed by a BSD-style
    // license that can be found in the LICENSE file.
    input: "How can you write a big system without C++?  -Paul Glick",
    expected: 0x8e0bb443,
  }
  const input = new TextEncoder().encode(test.input);
  const digest = wasmCrypto.digest("CRC32", input, undefined);
  assertEquals(varnum(digest, { dataType: "uint32" }), test.expected)
})

Deno.test("Inlined WASM file's metadata should match its content", () => {
  assertEquals(wasmBytes.length, wasmFileModule.size);
  assertEquals(wasmBytes.byteLength, wasmFileModule.size);
  assertEquals(wasmFileModule.data.length, wasmFileModule.size);
  assertEquals(wasmFileModule.data.buffer.byteLength, wasmFileModule.size);
});
