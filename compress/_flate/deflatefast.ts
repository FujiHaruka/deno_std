// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { MAX_STORE_BLOCK_SIZE } from "./huffman_bit_writer.ts";
import { literalToken, matchToken, Token } from "./token.ts";

// This encoding algorithm, which prioritizes speed over output size, is
// based on Snappy's LZ77-style encoder: github.com/golang/snappy

const MAX_INT32 = 2 ** 31 - 1;

const TABLE_BITS = 14; // Bits used in the table.
const TABLE_SIZE = 1 << TABLE_BITS; // Size of the table.
const TABLE_MASK = TABLE_SIZE - 1; // Mask for table indices. Redundant, but can eliminate bounds checks.
const TABLE_SHIFT = 32 - TABLE_BITS; // Right-shift to get the tableBits most significant bits of a uint32.
// Reset the buffer offset when reaching this.
// Offsets are stored between blocks as int32 values.
// Since the offset we are checking against is at the beginning
// of the buffer, we need to subtract the current and input
// buffer to not risk overflowing the int32.
const BUFFER_RESET = MAX_INT32 - MAX_STORE_BLOCK_SIZE * 2;

const BASE_MATCH_LENGTH = 3; // The smallest match length per the RFC section 3.2.5
const MIN_MATCH_LENGTH = 4; // The smallest match length that the compressor actually emits
const MAX_MATCH_LENGTH = 258; // The largest match length
const BASE_MATCH_OFFSET = 1; // The smallest match offset

const MAX_MATCH_OFFSET = 1 << 15; // The largest match offset

function load32(b: Uint8Array, i: number): number {
  return b[i] | (b[i + 1] * (2 ** 8)) | (b[i + 2] * (2 ** 16)) |
    (b[i + 3] * (2 ** 24));
}

function load64(b: Uint8Array, i: number): bigint {
  return BigInt(b[i]) | BigInt(b[i + 1]) << BigInt(8) |
    BigInt(b[i + 2]) << BigInt(16) | BigInt(b[i + 3]) << BigInt(24) |
    BigInt(b[i + 4]) << BigInt(32) | BigInt(b[i + 5]) << BigInt(40) |
    BigInt(b[i + 6]) << BigInt(48) | BigInt(b[i + 7]) << BigInt(56);
}

function hash(u: number | bigint): number {
  if (typeof u === "bigint") {
    return Math.floor(
      Number((u * BigInt(0x1e35a7bd)) / BigInt(2 ** TABLE_SHIFT)),
    );
  } else {
    return Math.floor((u * 0x1e35a7bd) / (2 ** TABLE_SHIFT));
  }
}

// These constants are defined by the Snappy implementation so that its
// assembly implementation can fast-path some 16-bytes-at-a-time copies. They
// aren't necessary in the pure Go implementation, as we don't use those same
// optimizations, but using the same thresholds doesn't really hurt.
const INPUT_MARGIN = 16 - 1;
const MIN_NON_LITERAL_BLOCK_SIZE = 1 + 1 + INPUT_MARGIN;

interface TableEntry {
  val: number; // Value at destination
  offset: number;
}

// deflateFast maintains the table for matches,
// and the previous byte block for cross block matching.
export class DeflateFast {
  table: TableEntry[] = Array.from({ length: TABLE_SIZE }, () => ({
    val: 0,
    offset: 0,
  }));
  prev = new Uint8Array(MAX_STORE_BLOCK_SIZE); // Previous block, zero length if unknown.
  cur = MAX_STORE_BLOCK_SIZE; // Current match offset.

  // encode encodes a block given in src and appends tokens
  // to dst and returns the result.
  encode(dst: Token[], src: Uint8Array): Token[] {
    // Ensure that e.cur doesn't wrap.
    if (this.cur >= BUFFER_RESET) {
      this.shiftOffsets();
    }

    // This check isn't in the Snappy implementation, but there, the caller
    // instead of the callee handles this case.
    if (src.length < MIN_NON_LITERAL_BLOCK_SIZE) {
      this.cur += MAX_STORE_BLOCK_SIZE;
      this.prev = this.prev.slice(0, 0);
      return emitLiteral(dst, src);
    }

    // sLimit is when to stop looking for offset/length copies. The inputMargin
    // lets us use a fast path for emitLiteral in the main loop, while we are
    // looking for copies.
    const sLimit = src.length - INPUT_MARGIN;

    // nextEmit is where in src the next emitLiteral should start from.
    let nextEmit = 0;
    let s = 0;
    let cv = load32(src, s);
    let nextHash = hash(cv);

    emitRemainder:
    while (true) {
      // Copied from the C++ snappy implementation:
      //
      // Heuristic match skipping: If 32 bytes are scanned with no matches
      // found, start looking only at every other byte. If 32 more bytes are
      // scanned (or skipped), look at every third byte, etc.. When a match
      // is found, immediately go back to looking at every byte. This is a
      // small loss (~5% performance, ~0.1% density) for compressible data
      // due to more bookkeeping, but for non-compressible data (such as
      // JPEG) it's a huge win since the compressor quickly "realizes" the
      // data is incompressible and doesn't bother looking for matches
      // everywhere.
      //
      // The "skip" variable keeps track of how many bytes there are since
      // the last match; dividing it by 32 (ie. right-shifting by five) gives
      // the number of bytes to move ahead for each iteration.
      let skip = 32;

      let nextS = s;
      let candidate: TableEntry;
      while (true) {
        s = nextS;
        const bytesBetweenHashLookups = skip >> 5;
        nextS = s + bytesBetweenHashLookups;
        skip += bytesBetweenHashLookups;
        if (nextS > sLimit) {
          break emitRemainder;
        }
        candidate = this.table[nextHash & TABLE_MASK];
        const now = load32(src, nextS);
        this.table[nextHash & TABLE_MASK] = { offset: s + this.cur, val: cv };
        nextHash = hash(now);

        const offset = s - (candidate.offset - this.cur);
        if (offset > MAX_MATCH_OFFSET || cv != candidate.val) {
          // Out of range or not matched.
          cv = now;
          continue;
        }
        break;
      }

      // A 4-byte match has been found. We'll later see if more than 4 bytes
      // match. But, prior to the match, src[nextEmit:s] are unmatched. Emit
      // them as literal bytes.
      dst = emitLiteral(dst, src.slice(nextEmit, s));

      // Call emitCopy, and then see if another emitCopy could be our next
      // move. Repeat until we find no match for the input immediately after
      // what was consumed by the last emitCopy call.
      //
      // If we exit this loop normally then we need to call emitLiteral next,
      // though we don't yet know how big the literal will be. We handle that
      // by proceeding to the next iteration of the main loop. We also can
      // exit this loop via goto if we get close to exhausting the input.
      while (true) {
        // Invariant: we have a 4-byte match at s, and no need to emit any
        // literal bytes prior to s.

        // Extend the 4-byte match as long as possible.
        //
        s += 4;
        const t = candidate.offset - this.cur + 4;
        const l = this.matchLen(s, t, src);

        // matchToken is flate's equivalent of Snappy's emitCopy. (length,offset)
        dst = dst.concat(
          matchToken(l + 4 - BASE_MATCH_LENGTH, s - t - BASE_MATCH_OFFSET),
        );
        s += l;
        nextEmit = s;
        if (s >= sLimit) {
          break emitRemainder;
        }

        // We could immediately start working at s now, but to improve
        // compression we first update the hash table at s-1 and at s. If
        // another emitCopy is not our next move, also calculate nextHash
        // at s+1. At least on GOARCH=amd64, these three hash calculations
        // are faster as one load64 call (with some shifts) instead of
        // three load32 calls.
        let x = load64(src, s - 1);
        const prevHash = hash(x);
        this.table[prevHash & TABLE_MASK] = {
          offset: this.cur + s - 1,
          val: Number(x),
        };
        x = x >> BigInt(8);
        const currHash = hash(x);
        candidate = this.table[currHash & TABLE_MASK];
        this.table[currHash & TABLE_MASK] = {
          offset: this.cur + s,
          val: Number(x),
        };

        const offset = s - (candidate.offset - this.cur);
        if (offset > MAX_MATCH_OFFSET || Number(x) != candidate.val) {
          cv = Number(x >> BigInt(8));
          nextHash = hash(cv);
          s++;
          break;
        }
      }
    }

    if (nextEmit < src.length) {
      dst = emitLiteral(dst, src.slice(nextEmit));
    }
    this.cur += src.length;
    this.prev = this.prev.slice(0, src.length);
    for (let i = 0; i < src.length; i++) {
      this.prev[i] = src[i];
    }
    return dst;
  }

  // matchLen returns the match length between src[s:] and src[t:].
  // t can be negative to indicate the match is starting in e.prev.
  // We assume that src[s-4:s] and src[t-4:t] already match.
  matchLen(s: number, t: number, src: Uint8Array): number {
    let s1 = s + MAX_MATCH_LENGTH - 4;
    if (s1 > src.length) {
      s1 = src.length;
    }

    // If we are inside the current block
    if (t >= 0) {
      let b = src.slice(t);
      const a = src.slice(s, s1);
      b = b.slice(0, a.length);
      // Extend the match to be as long as possible.
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return i;
        }
      }
      return a.length;
    }

    // We found a match in the previous block.
    const tp = this.prev.length + t;
    if (tp < 0) {
      return 0;
    }

    // Extend the match to be as long as possible.
    let a = src.slice(s, s1);
    let b = this.prev.slice(tp);
    if (b.length > a.length) {
      b = b.slice(0, a.length);
    }
    a = a.slice(0, b.length);
    for (let i = 0; i < b.length; i++) {
      if (a[i] !== b[i]) {
        return i;
      }
    }

    // If we reached our limit, we matched everything we are
    // allowed to in the previous block and we return.
    const n = b.length;
    if (s + n === s1) {
      return n;
    }

    // Continue looking for more matches in the current block.
    a = src.slice(s + n, s1);
    b = src.slice(0, a.length);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return i + n;
      }
    }
    return a.length + n;
  }

  // Reset resets the encoding history.
  // This ensures that no matches are made to the previous block.
  reset() {
    this.prev = this.prev.slice(0, 0);
    // Bump the offset, so all matches will fail distance check.
    // Nothing should be >= this.cur in the table.
    this.cur += MAX_MATCH_OFFSET;

    // Protect against this.cur wraparound.
    if (this.cur >= BUFFER_RESET) {
      this.shiftOffsets();
    }
  }

  // shiftOffsets will shift down all match offset.
  // This is only called in rare situations to prevent integer overflow.
  //
  // See https://golang.org/issue/18636 and https://github.com/golang/go/issues/34121.
  shiftOffsets() {
    if (this.prev.length === 0) {
      for (let i = 0; i < this.table.length; i++) {
        this.table[i] = { val: 0, offset: 0 };
      }
      this.cur = MAX_MATCH_OFFSET + 1;
      return;
    }

    // Shift down everything in the table that isn't already too far away.
    for (let i = 0; i < this.table.length; i++) {
      let v = this.table[i].offset - this.cur + MAX_MATCH_OFFSET + 1;
      if (v < 0) {
        // We want to reset this.cur to maxMatchOffset + 1, so we need to shift
        // all table entries down by (this.cur - (maxMatchOffset + 1)).
        // Because we ignore matches > maxMatchOffset, we can cap
        // any negative offsets at 0.
        v = 0;
      }
      this.table[i].offset = v;
    }
    this.cur = MAX_MATCH_OFFSET + 1;
  }
}

function emitLiteral(dst: Token[], lit: Uint8Array): Token[] {
  for (const v of lit) {
    dst.push(literalToken(v));
  }
  return dst;
}
