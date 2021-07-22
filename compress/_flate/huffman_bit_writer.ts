// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {
  fixedLiteralEncoding,
  fixedOffsetEncoding,
  Hcode,
  HuffmanEncoder,
  MAX_NUM_LIT,
} from "./huffman_code.ts";
import { lengthCode, MATCH_TYPE, offsetCode, Token } from "./token.ts";

// The largest offset code.
const OFFSET_CODE_COUNT = 30;
// The special code used to mark the end of a block.
const END_BLOCK_MARKER = 256;
// The first length code.
const LENGTH_CODES_START = 257;
// The number of codegen codes.
const CODEGEN_CODE_COUNT = 19;
const BAD_CODE = 255;
// bufferFlushSize indicates the buffer size
// after which bytes are flushed to the writer.
// Should preferably be a multiple of 6, since
// we accumulate 6 bytes between writes to the buffer.
const BUFFER_FLUSH_SIZE = 240;
// bufferSize is the actual output byte buffer size.
// It must have additional headroom for a flush
// which can contain up to 8 bytes.
const BUFFER_SIZE = BUFFER_FLUSH_SIZE + 8;

const MAX_STORE_BLOCK_SIZE = 65535;

// The number of extra bits needed by length code X - LENGTH_CODES_START.
// deno-fmt-ignore
const LENGTH_EXTRA_BITS = new Int8Array([
	/* 257 */ 0, 0, 0,
	/* 260 */ 0, 0, 0, 0, 0, 1, 1, 1, 1, 2,
	/* 270 */ 2, 2, 2, 3, 3, 3, 3, 4, 4, 4,
	/* 280 */ 4, 5, 5, 5, 5, 0,
])

// The length indicated by length code X - LENGTH_CODES_START.
// deno-fmt-ignore
const LENGTH_BASE = [
	0, 1, 2, 3, 4, 5, 6, 7, 8, 10,
	12, 14, 16, 20, 24, 28, 32, 40, 48, 56,
	64, 80, 96, 112, 128, 160, 192, 224, 255,
]

// offset code word extra bits.
// deno-fmt-ignore
const OFFSET_EXTRA_BITS = new Int8Array([
	0, 0, 0, 0, 1, 1, 2, 2, 3, 3,
	4, 4, 5, 5, 6, 6, 7, 7, 8, 8,
	9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
])

// deno-fmt-ignore
const OFFSET_BASE = [
	0x000000, 0x000001, 0x000002, 0x000003, 0x000004,
	0x000006, 0x000008, 0x00000c, 0x000010, 0x000018,
	0x000020, 0x000030, 0x000040, 0x000060, 0x000080,
	0x0000c0, 0x000100, 0x000180, 0x000200, 0x000300,
	0x000400, 0x000600, 0x000800, 0x000c00, 0x001000,
	0x001800, 0x002000, 0x003000, 0x004000, 0x006000,
]

// The odd order in which the codegen code sizes are written.
// deno-fmt-ignore
const codegenOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

export class HuffmanBitWriter {
  // Data waiting to be written is bytes[0:nbytes]
  // and then the low nbits of bits.  Data is always written
  // sequentially into the bytes array.
  bits = 0;
  nbits = 0;
  bytes = new Uint8Array(BUFFER_SIZE);
  codegenFreq = new Array<number>(CODEGEN_CODE_COUNT).fill(0);
  nbytes = 0;
  literalFreq = new Array<number>(MAX_NUM_LIT).fill(0);
  offsetFreq = new Array<number>(OFFSET_CODE_COUNT).fill(0);
  codegen = new Uint8Array(MAX_NUM_LIT + OFFSET_CODE_COUNT + 1);
  literalEncoding = new HuffmanEncoder(MAX_NUM_LIT);
  offsetEncoding = new HuffmanEncoder(CODEGEN_CODE_COUNT);
  codegenEncoding = new HuffmanEncoder(OFFSET_CODE_COUNT);
  err?: Error;

  constructor(
    // writer is the underlying writer.
    // Do not use it directly; use the write method, which ensures
    // that Write errors are sticky.
    private writer: Deno.Writer,
  ) {}

  reset(writer: Deno.Writer) {
    this.writer = writer;
    this.bits = 0;
    this.nbits = 0;
    this.nbytes = 0;
    this.err = undefined;
  }

  async flush() {
    if (this.err) {
      this.nbits = 0;
      return;
    }
    const n = this.nbytes;
    while (this.nbits !== 0) {
      // TODO: uint8arrayにこうやって代入できる？
      this.bytes[n] = this.bits;
      this.bits >>= 8;
      if (this.nbits > 8) { // Avoid underflow
        this.nbits -= 8;
      } else {
        this.nbits = 0;
      }
    }
    this.bits = 0;
    await this.write(this.bytes.slice(0, n));
    this.nbytes = 0;
  }

  async write(b: Uint8Array) {
    if (this.err) {
      return;
    }
    try {
      await this.writer.write(b);
    } catch (err) {
      this.err = err;
    }
  }

  async writeBits(b: number, nb: number) {
    if (this.err) {
      return;
    }
    this.bits |= b << this.nbits;
    this.nbits += nb;
    if (this.nbits >= 48) {
      const bits = this.bits;
      this.bits >>= 48;
      this.nbits -= 48;
      let n = this.nbytes;
      const bytes = this.bytes.slice(n, n + 6);
      bytes[0] = bits;
      bytes[1] = bits >> 8;
      bytes[2] = bits >> 16;
      bytes[3] = bits >> 24;
      bytes[4] = bits >> 32;
      bytes[5] = bits >> 40;
      n += 6;
      if (n >= BUFFER_FLUSH_SIZE) {
        await this.write(this.bytes.slice(0, n));
        n = 0;
      }
      this.nbytes = n;
    }
  }

  async writeBytes(bytes: Uint8Array) {
    if (this.err) {
      return;
    }
    let n = this.nbytes;
    if ((this.nbits & 7) !== 0) {
      this.err = new Error(
        "flate: internal error: writeBytes with unfinished bits",
      );
      return;
    }
    while (this.nbits !== 0) {
      this.bytes[n] = this.bits;
      this.bits >>= 8;
      this.nbits -= 8;
      n++;
    }
    if (n !== 0) {
      await this.write(this.bytes.slice(0, n));
    }
    this.nbytes = 0;
    await this.write(bytes);
  }

  // RFC 1951 3.2.7 specifies a special run-length encoding for specifying
  // the literal and offset lengths arrays (which are concatenated into a single
  // array).  This method generates that run-length encoding.
  //
  // The result is written into the codegen array, and the frequencies
  // of each code is written into the codegenFreq array.
  // Codes 0-15 are single byte codes. Codes 16-18 are followed by additional
  // information. Code badCode is an end marker
  //
  //  numLiterals      The number of literals in literalEncoding
  //  numOffsets       The number of offsets in offsetEncoding
  //  litenc, offenc   The literal and offset encoder to use
  generateCodegen(
    numLiterals: number,
    numOffsets: number,
    litEnc: HuffmanEncoder,
    offEnc: HuffmanEncoder,
  ) {
    for (let i = 0; i < this.codegenFreq.length; i++) {
      this.codegenFreq[i] = 0;
    }

    // Note that we are using codegen both as a temporary variable for holding
    // a copy of the frequencies, and as the place where we put the result.
    // This is fine because the output is always shorter than the input used
    // so far.
    const codegen = this.codegen; // cache
    // Copy the concatenated code sizes to codegen. Put a marker at the end.
    let cgnl = codegen.slice(0, numLiterals);
    for (let i = 0; i < cgnl.length; i++) {
      cgnl[i] = litEnc.codes[i].len;
    }

    cgnl = codegen.slice(numLiterals, numLiterals + numOffsets);
    for (let i = 0; i < cgnl.length; i++) {
      cgnl[i] = offEnc.codes[i].len;
    }
    codegen[numLiterals + numOffsets] = BAD_CODE;

    let size = codegen[0];
    let count = 1;
    let outIndex = 0;
    for (let inIndex = 1; size != BAD_CODE; inIndex++) {
      // INVARIANT: We have seen "count" copies of size that have not yet
      // had output generated for them.
      const nextSize = codegen[inIndex];
      if (nextSize === size) {
        count++;
        continue;
      }
      // We need to generate codegen indicating "count" of size.
      if (size !== 0) {
        codegen[outIndex] = size;
        outIndex++;
        this.codegenFreq[size]++;
        count--;
        while (count >= 3) {
          let n = 6;
          if (n > count) {
            n = count;
          }
          codegen[outIndex] = 16;
          outIndex++;
          codegen[outIndex] = n - 3;
          outIndex++;
          this.codegenFreq[16]++;
          count -= n;
        }
      } else {
        while (count >= 11) {
          let n = 138;
          if (n > count) {
            n = count;
          }
          codegen[outIndex] = 18;
          outIndex++;
          codegen[outIndex] = n - 11;
          outIndex++;
          this.codegenFreq[18]++;
          count -= n;
        }
        if (count >= 3) {
          // count >= 3 && count <= 10
          codegen[outIndex] = 17;
          outIndex++;
          codegen[outIndex] = count - 3;
          outIndex++;
          this.codegenFreq[17]++;
          count = 0;
        }
      }
      count--;
      for (; count >= 0; count--) {
        codegen[outIndex] = size;
        outIndex++;
        this.codegenFreq[size]++;
      }
      // Set up invariant for next time through the loop.
      size = nextSize;
      count = 1;
    }
    // Marker indicating the end of the codegen.
    codegen[outIndex] = BAD_CODE;
  }

  // dynamicSize returns the size of dynamically encoded data in bits.
  dynamicSize(
    litEnc: HuffmanEncoder,
    offEnc: HuffmanEncoder,
    extraBits: number,
  ): [number, number] {
    let numCodegens = this.codegenFreq.length;
    while (
      numCodegens > 4 && this.codegenFreq[codegenOrder[numCodegens - 1]] === 0
    ) {
      numCodegens--;
    }
    const header = 3 + 5 + 5 + 4 + (3 * numCodegens) +
      this.codegenEncoding.bitLength(this.codegenFreq.slice()) +
      (this.codegenFreq[16]) * 2 +
      (this.codegenFreq[17]) * 3 +
      (this.codegenFreq[18]) * 7;
    const size = header +
      litEnc.bitLength(this.literalFreq) +
      offEnc.bitLength(this.offsetFreq) +
      extraBits;
    return [size, numCodegens];
  }

  // fixedSize returns the size of dynamically encoded data in bits.
  fixedSize(extraBits: number): number {
    return 3 +
      fixedLiteralEncoding.bitLength(this.literalFreq) +
      fixedOffsetEncoding.bitLength(this.offsetFreq) +
      extraBits;
  }

  // storedSize calculates the stored size, including header.
  // The function returns the size in bits and whether the block
  // fits inside a single block.
  storedSize(inBytes: Uint8Array | null): [number, boolean] {
    if (inBytes === null) {
      return [0, false];
    }
    if (inBytes.length <= MAX_STORE_BLOCK_SIZE) {
      return [(inBytes.length + 5) * 8, true];
    }
    return [0, false];
  }

  async writeCode(c: Hcode) {
    if (this.err) {
      return;
    }
    this.bits |= c.code << this.nbits;
    this.nbits += c.len;
    if (this.nbits >= 48) {
      const bits = this.bits;
      this.bits >>= 48;
      this.nbits -= 48;
      let n = this.nbytes;
      const bytes = this.bytes.slice(n, n + 6);
      bytes[0] = bits;
      bytes[1] = bits >> 8;
      bytes[2] = bits >> 16;
      bytes[3] = bits >> 24;
      bytes[4] = bits >> 32;
      bytes[5] = bits >> 40;
      n += 6;
      if (n >= BUFFER_FLUSH_SIZE) {
        await this.write(this.bytes.slice(0, n));
        n = 0;
      }
      this.nbytes = n;
    }
  }
  // Write the header of a dynamic Huffman block to the output stream.
  //
  //  numLiterals  The number of literals specified in codegen
  //  numOffsets   The number of offsets specified in codegen
  //  numCodegens  The number of codegens used in codegen
  async writeDynamicHeader(
    numLiterals: number,
    numOffsets: number,
    numCodegens: number,
    isEof: boolean,
  ) {
    if (this.err) {
      return;
    }
    let firstBits = 4;
    if (isEof) {
      firstBits = 5;
    }
    await this.writeBits(firstBits, 3);
    await this.writeBits(numLiterals - 257, 5);
    await this.writeBits(numOffsets - 1, 5);
    await this.writeBits(numCodegens - 4, 4);

    for (let i = 0; i < numCodegens; i++) {
      const value = this.codegenEncoding.codes[codegenOrder[i]].len;
      await this.writeBits(value, 3);
    }

    let i = 0;
    while (true) {
      const codeWord = this.codegen[i];
      i++;
      if (codeWord === BAD_CODE) {
        break;
      }
      await this.writeCode(this.codegenEncoding.codes[codeWord]);

      switch (codeWord) {
        case 16:
          await this.writeBits(this.codegen[i], 2);
          i++;
          break;
        case 17:
          await this.writeBits(this.codegen[i], 3);
          i++;
          break;
        case 18:
          await this.writeBits(this.codegen[i], 7);
          i++;
          break;
      }
    }
  }

  async writeStoredHeader(length: number, isEof: boolean) {
    if (this.err) {
      return;
    }
    let flag = 0;
    if (isEof) {
      flag = 1;
    }
    await this.writeBits(flag, 3);
    await this.flush();
    await this.writeBits(length, 16);
    await this.writeBits(~length, 16);
  }

  async writeFixedHeader(isEof: boolean) {
    if (this.err) {
      return;
    }
    // Indicate that we are a fixed Huffman block
    let value = 2;
    if (isEof) {
      value = 3;
    }
    await this.writeBits(value, 3);
  }

  // writeBlock will write a block of tokens with the smallest encoding.
  // The original input can be supplied, and if the huffman encoded data
  // is larger than the original bytes, the data will be written as a
  // stored block.
  // If the input is nil, the tokens will always be Huffman encoded.
  async writeBlock(tokens: Token[], eof: boolean, input: Uint8Array) {
    if (this.err) {
      return;
    }

    tokens = tokens.concat(new Token(END_BLOCK_MARKER));
    const [numLiterals, numOffsets] = this.indexTokens(tokens);

    let extraBits = 0;
    const [storedSize, storable] = this.storedSize(input);
    if (storable) {
      // We only bother calculating the costs of the extra bits required by
      // the length of offset fields (which will be the same for both fixed
      // and dynamic encoding), if we need to compare those two encodings
      // against stored encoding.
      for (
        let lengthCode = LENGTH_CODES_START + 8;
        lengthCode < numLiterals;
        lengthCode++
      ) {
        // First eight length codes have extra size = 0.
        extraBits += this.literalFreq[lengthCode] *
          LENGTH_EXTRA_BITS[lengthCode - LENGTH_CODES_START];
      }
      for (let offsetCode = 4; offsetCode < numOffsets; offsetCode++) {
        // First four offset codes have extra size = 0.
        extraBits += this.offsetFreq[offsetCode] *
          OFFSET_EXTRA_BITS[offsetCode];
      }
    }

    // Figure out smallest code.
    // Fixed Huffman baseline.
    var literalEncoding = fixedLiteralEncoding;
    var offsetEncoding = fixedOffsetEncoding;
    var size = this.fixedSize(extraBits);

    // Generate codegen and codegenFrequencies, which indicates how to encode
    // the literalEncoding and the offsetEncoding.
    this.generateCodegen(
      numLiterals,
      numOffsets,
      this.literalEncoding,
      this.offsetEncoding,
    );
    this.codegenEncoding.generate(this.codegenFreq.slice(), 7);
    const [dynamicSize, numCodegens] = this.dynamicSize(
      this.literalEncoding,
      this.offsetEncoding,
      extraBits,
    );

    if (dynamicSize < size) {
      size = dynamicSize;
      literalEncoding = this.literalEncoding;
      offsetEncoding = this.offsetEncoding;
    }

    // Stored bytes?
    if (storable && storedSize < size) {
      await this.writeStoredHeader(input.length, eof);
      await this.writeBytes(input);
      return;
    }

    // Huffman.
    if (literalEncoding === fixedLiteralEncoding) {
      await this.writeFixedHeader(eof);
    } else {
      await this.writeDynamicHeader(numLiterals, numOffsets, numCodegens, eof);
    }

    // Write the tokens.
    await this.writeTokens(tokens, literalEncoding.codes, offsetEncoding.codes);
  }

  // writeBlockDynamic encodes a block using a dynamic Huffman table.
  // This should be used if the symbols used have a disproportionate
  // histogram distribution.
  // If input is supplied and the compression savings are below 1/16th of the
  // input size the block is stored.
  async writeBlockDynamic(tokens: Token[], eof: boolean, input: Uint8Array) {
    if (this.err) {
      return;
    }

    tokens = tokens.concat(new Token(END_BLOCK_MARKER));
    const [numLiterals, numOffsets] = this.indexTokens(tokens);

    // Generate codegen and codegenFrequencies, which indicates how to encode
    // the literalEncoding and the offsetEncoding.
    this.generateCodegen(
      numLiterals,
      numOffsets,
      this.literalEncoding,
      this.offsetEncoding,
    );
    this.codegenEncoding.generate(this.codegenFreq.slice(), 7);
    const [size, numCodegens] = this.dynamicSize(
      this.literalEncoding,
      this.offsetEncoding,
      0,
    );

    // Store bytes, if we don't get a reasonable improvement.
    const [ssize, storable] = this.storedSize(input);
    if (storable && ssize < (size + size >> 4)) {
      await this.writeStoredHeader(input.length, eof);
      await this.writeBytes(input);
      return;
    }

    // Write Huffman table.
    await this.writeDynamicHeader(numLiterals, numOffsets, numCodegens, eof);

    // Write the tokens.
    await this.writeTokens(
      tokens,
      this.literalEncoding.codes,
      this.offsetEncoding.codes,
    );
  }
  // indexTokens indexes a slice of tokens, and updates
  // literalFreq and offsetFreq, and generates literalEncoding
  // and offsetEncoding.
  // The number of literal and offset tokens is returned.
  indexTokens(tokens: Token[]): [number, number] {
    this.literalFreq = this.literalFreq.map(() => 0);
    this.offsetFreq = this.offsetFreq.map(() => 0);

    for (const token of tokens) {
      if (token.value < MATCH_TYPE) {
        this.literalFreq[token.literal()]++;
        continue;
      }
      const length = token.length();
      const offset = token.offset();
      this.literalFreq[LENGTH_CODES_START + lengthCode(length)]++;
      this.offsetFreq[offsetCode(offset)]++;
    }

    // get the number of literals
    let numLiterals = this.literalFreq.length;
    while (this.literalFreq[numLiterals - 1] === 0) {
      numLiterals--;
    }
    // get the number of offsets
    let numOffsets = this.offsetFreq.length;
    while (numOffsets > 0 && this.offsetFreq[numOffsets - 1] === 0) {
      numOffsets--;
    }
    if (numOffsets === 0) {
      // We haven't found a single match. If we want to go with the dynamic encoding,
      // we should count at least one offset to be sure that the offset huffman tree could be encoded.
      this.offsetFreq[0] = 1;
      numOffsets = 1;
    }
    this.literalEncoding.generate(this.literalFreq, 15);
    this.offsetEncoding.generate(this.offsetFreq, 15);
    return [numLiterals, numOffsets];
  }
  // writeTokens writes a slice of tokens to the output.
  // codes for literal and offset encoding must be supplied.
  async writeTokens(tokens: Token[], leCodes: Hcode[], oeCodes: Hcode[]) {
    if (this.err) {
      return;
    }
    for (const token of tokens) {
      if (token.value < MATCH_TYPE) {
        await this.writeCode(leCodes[token.literal()]);
        continue;
      }
      // Write the length
      const length = token.length();
      const lCode = lengthCode(length);
      await this.writeCode(leCodes[lCode + LENGTH_CODES_START]);
      const extraLengthBits = LENGTH_EXTRA_BITS[lCode];
      if (extraLengthBits > 0) {
        const extraLength = length - LENGTH_BASE[lCode];
        await this.writeBits(extraLength, extraLengthBits);
      }
      // Write the offset
      const offset = token.offset();
      const oCode = offsetCode(offset);
      await this.writeCode(oeCodes[oCode]);
      const extraOffsetBits = OFFSET_EXTRA_BITS[oCode];
      if (extraOffsetBits > 0) {
        const extraOffset = offset - OFFSET_BASE[oCode];
        await this.writeBits(extraOffset, extraOffsetBits);
      }
    }
  }

  // writeBlockHuff encodes a block of bytes as either
  // Huffman encoded literals or uncompressed bytes if the
  // results only gains very little from compression.
  async writeBlockHuff(eof: boolean, input: Uint8Array) {
    if (this.err) {
      return;
    }

    // Clear histogram
    this.literalFreq = this.literalFreq.map(() => 0);

    // Add everything as literals
    histogram(input, this.literalFreq);

    this.literalFreq[END_BLOCK_MARKER] = 1;

    const numLiterals = END_BLOCK_MARKER + 1;
    this.offsetFreq[0] = 1;
    const numOffsets = 1;

    this.literalEncoding.generate(this.literalFreq, 15);

    // Generate codegen and codegenFrequencies, which indicates how to encode
    // the literalEncoding and the offsetEncoding.
    this.generateCodegen(
      numLiterals,
      numOffsets,
      this.literalEncoding,
      huffOffset.instance(),
    );
    this.codegenEncoding.generate(this.codegenFreq.slice(), 7);
    // numCodegens Figure out smallest code.
    // Always use dynamic Huffman or Store
    const [size, numCodegens] = this.dynamicSize(
      this.literalEncoding,
      huffOffset.instance(),
      0,
    );

    // Store bytes, if we don't get a reasonable improvement.
    const [ssize, storable] = this.storedSize(input);
    if (storable && ssize < (size + size >> 4)) {
      await this.writeStoredHeader(input.length, eof);
      await this.writeBytes(input);
      return;
    }

    // Huffman.
    await this.writeDynamicHeader(numLiterals, numOffsets, numCodegens, eof);
    const encoding = this.literalEncoding.codes.slice(0, 257);
    let n = this.nbytes;
    for (const t of input) {
      // Bitwriting inlined, ~30% speedup
      const c = encoding[t];
      this.bits |= c.code << this.nbits;
      this.nbits += c.len;
      if (this.nbits < 48) {
        continue;
      }
      // Store 6 bytes
      const bits = this.bits;
      this.bits >>= 48;
      this.nbits -= 48;
      const bytes = this.bytes.slice(n, n + 6);
      bytes[0] = bits;
      bytes[1] = bits >> 8;
      bytes[2] = bits >> 16;
      bytes[3] = bits >> 24;
      bytes[4] = bits >> 32;
      bytes[5] = bits >> 40;
      n += 6;
      if (n < BUFFER_FLUSH_SIZE) {
        continue;
      }
      await this.write(this.bytes.slice(0, n));
      if (this.err) {
        return; // Return early in the event of write failures
      }
      n = 0;
    }
    this.nbytes = n;
    await this.writeCode(encoding[END_BLOCK_MARKER]);
  }
}

// huffOffset is a static offset encoder used for huffman only encoding.
// It can be reused since we will not be encoding offset values.
const huffOffset = (() => {
  let singleton: HuffmanEncoder | null = null;
  const instance = (): HuffmanEncoder => {
    if (singleton) {
      return singleton;
    }
    const offsetFreq = new Array<number>(OFFSET_CODE_COUNT).fill(0);
    offsetFreq[0] = 1;
    const huffOffset = new HuffmanEncoder(OFFSET_CODE_COUNT);
    huffOffset.generate(offsetFreq, 15);
    singleton = huffOffset;
    return huffOffset;
  };
  return { instance };
})();

// histogram accumulates a histogram of b in h.
//
// len(h) must be >= 256, and h's elements must be all zeroes.
function histogram(b: Uint8Array, h: number[]) {
  h = h.slice(0, 256);
  for (const t of b) {
    h[t]++;
  }
}
