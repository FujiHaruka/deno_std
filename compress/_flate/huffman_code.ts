// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { reverseBits } from "./utils.ts";

export const MAX_NUM_LIT = 286;
const MAX_BITS_LIMIT = 16;

const MAX_UINT16 = 2 ^ 16 - 1;
const MAX_INT32 = 2 ^ 31 - 1;

/**
 * the state of the constructed tree for a given depth.
 */
interface LevelInfo {
  // Our level.  for better printing
  level: number;

  // The frequency of the last node at this level
  lastFreq: number;

  // The frequency of the next character to add to this level
  nextCharFreq: number;

  // The frequency of the next pair (from level below) to add to this level.
  // Only valid if the "needed" value of the next lower level is 0.
  nextPairFreq: number;

  // The number of chains remaining to generate for this level before moving
  // up to the next level
  needed: number;
}

/**
 * huffman code with a bit code and bit length.
 */
export class Hcode {
  constructor(
    public code = 0,
    public len = 0,
  ) {}

  // set sets the code and length of an hcode.
  set(code: number, length: number) {
    this.code = code;
    this.len = length;
  }
}

class LiteralNode {
  constructor(
    public literal = 0,
    public freq = 0,
  ) {}
}

function maxNode(): LiteralNode {
  const node = new LiteralNode();
  node.literal = MAX_UINT16;
  node.freq = MAX_INT32;
  return node;
}

/**
 * Generates a HuffmanCode corresponding to the fixed literal table
 */
function generateFixedLiteralEncoding(): HuffmanEncoder {
  const h = new HuffmanEncoder(MAX_NUM_LIT);
  const { codes } = h;
  let ch: number;
  for (ch = 0; ch < h.codes.length; ch++) {
    let bits: number;
    let size: number;
    if (ch < 144) {
      // size 8, 000110000  .. 10111111
      bits = ch + 48;
      size = 8;
    } else if (ch < 256) {
      // size 9, 110010000 .. 111111111
      bits = ch + 400 - 144;
      size = 9;
    } else if (ch < 280) {
      // size 7, 0000000 .. 0010111
      bits = ch - 256;
      size = 7;
    } else {
      // size 8, 11000000 .. 11000111
      bits = ch + 192 - 280;
      size = 8;
    }
    codes[ch] = new Hcode(_reverseBits(bits, size), size);
  }
  return h;
}

function generateFixedOffsetEncoding(): HuffmanEncoder {
  const h = new HuffmanEncoder(30);
  const { codes } = h;
  const offset = 5;
  for (let ch = 0; ch < codes.length; ch++) {
    codes[ch] = new Hcode(_reverseBits(ch, offset), offset);
  }
  return h;
}

export const fixedLiteralEncoding: HuffmanEncoder =
  generateFixedLiteralEncoding();
export const fixedOffsetEncoding: HuffmanEncoder =
  generateFixedOffsetEncoding();

export class HuffmanEncoder {
  codes: Hcode[];
  freqcache: LiteralNode[] = [];
  bitCount: number[] = new Array(17).fill(0);

  constructor(size: number) {
    this.codes = Array.from({ length: size });
  }

  bitLength(freq: number[]): number {
    let total = 0;
    for (let i = 0; i < freq.length; i++) {
      const f = freq[i];
      if (f !== 0) {
        total += f * this.codes[i].len;
      }
    }
    return total;
  }

  // Return the number of literals assigned to each bit size in the Huffman encoding
  //
  // This method is only called when list.length >= 3
  // The cases of 0, 1, and 2 literals are handled by special case code.
  //
  // list  An array of the literals with non-zero frequencies
  //             and their associated frequencies. The array is in order of increasing
  //             frequency, and has as its last element a special element with frequency
  //             MaxInt32
  // maxBits     The maximum number of bits that should be used to encode any literal.
  //             Must be less than 16.
  // return      An integer array in which array[i] indicates the number of literals
  //             that should be encoded in i bits.
  bitCounts(list: LiteralNode[], maxBits: number): number[] {
    if (maxBits >= MAX_BITS_LIMIT) {
      throw new Error("flate: maxBits too large");
    }
    const n = list.length;
    list[n] = maxNode();

    // The tree can't have greater depth than n - 1, no matter what. This
    // saves a little bit of work in some small cases
    if (maxBits > n - 1) {
      maxBits = n - 1;
    }

    // Create information about each of the levels.
    // A bogus "Level 0" whose sole purpose is so that
    // level1.prev.needed==0.  This makes level1.nextPairFreq
    // be a legitimate value that never gets chosen.
    const levels: LevelInfo[] = Array.from({ length: MAX_BITS_LIMIT });

    // leafCounts[i] counts the number of literals at the left
    // of ancestors of the rightmost node at level i.
    // leafCounts[i][j] is the number of literals at the left
    // of the level j ancestor.
    const leafCounts: number[][] = Array.from(
      { length: MAX_BITS_LIMIT },
      () => Array.from<number>({ length: MAX_BITS_LIMIT }).fill(0),
    );

    for (let level = 1; level <= maxBits; level++) {
      // For every level, the first two items are the first two characters.
      // We initialize the levels as if we had already figured this out.
      levels[level] = {
        level: level,
        lastFreq: list[1].freq,
        nextCharFreq: list[2].freq,
        nextPairFreq: list[0].freq + list[1].freq,
        needed: 0,
      };
      leafCounts[level][level] = 2;
      if (level === 1) {
        levels[level].nextPairFreq = MAX_INT32;
      }
    }

    // We need a total of 2*n - 2 items at top level and have already generated 2.
    levels[maxBits].needed = 2 * n - 4;

    let level = maxBits;
    while (true) {
      const l = levels[level];
      if (l.nextPairFreq === Infinity && l.nextCharFreq == Infinity) {
        // We've run out of both leafs and pairs.
        // End all calculations for this level.
        // To make sure we never come back to this level or any lower level,
        // set nextPairFreq impossibly large.
        l.needed = 0;
        levels[level + 1].nextPairFreq = MAX_INT32;
        level++;
        continue;
      }

      const prevFreq = l.lastFreq;
      if (l.nextCharFreq < l.nextPairFreq) {
        // The next item on this row is a leaf node.
        const n = leafCounts[level][level] + 1;
        l.lastFreq = l.nextCharFreq;
        // Lower leafCounts are the same of the previous node.
        leafCounts[level][level] = n;
        l.nextCharFreq = list[n].freq;
      } else {
        // The next item on this row is a pair from the previous row.
        // nextPairFreq isn't valid until we generate two
        // more values in the level below
        l.lastFreq = l.nextPairFreq;
        // Take leaf counts from the lower level, except counts[level] remains the same.
        for (let k = 0; k < level; k++) {
          leafCounts[level - 1][k] = leafCounts[level][k];
        }
        levels[l.level - 1].needed = 2;
      }

      l.needed--;
      if (l.needed === 0) {
        // We've done everything we need to do for this level.
        // Continue calculating one level up. Fill in nextPairFreq
        // of that level with the sum of the two nodes we've just calculated on
        // this level.
        if (l.level == maxBits) {
          // All done!
          break;
        }
        levels[l.level + 1].nextPairFreq = prevFreq + l.lastFreq;
        level++;
      } else {
        // If we stole from below, move down temporarily to replenish it.
        while (levels[level - 1].needed > 0) {
          level--;
        }
      }
    }

    // Somethings is wrong if at the end, the top level is null or hasn't used
    // all of the leaves.
    if (leafCounts[maxBits][maxBits] != n) {
      throw new Error("leafCounts[maxBits][maxBits] != n");
    }

    const bitCount = this.bitCount.slice(0, maxBits + 1);
    let bits = 1;
    const counts = leafCounts[maxBits];
    for (let level = maxBits; level > 0; level--) {
      // chain.leafCount gives the number of literals requiring at least "bits"
      // bits to encode.
      bitCount[bits] = counts[level] - counts[level - 1];
      bits++;
    }
    return bitCount;
  }

  // Look at the leaves and assign them a bit count and an encoding as specified
  // in RFC 1951 3.2.2
  assignEncodingAndSize(bitCount: number[], list: LiteralNode[]) {
    let code = 0;
    for (let n = 0; n < bitCount.length; n++) {
      const bits = bitCount[n];
      code <<= 1;
      if (n === 0 || bits === 0) {
        continue;
      }
      // The literals list[len(list)-bits] .. list[len(list)-bits]
      // are encoded using "bits" bits, and get the values
      // code, code + 1, ....  The code values are
      // assigned in literal order (not frequency order).
      const chunk = list.slice(list.length - bits);

      chunk.sort(compareByLiteral);
      for (const node of chunk) {
        this.codes[node.literal] = new Hcode(_reverseBits(code, n), n);
        code++;
      }
      list = list.slice(0, list.length - bits);
    }
  }

  // Update this Huffman Code object to be the minimum code for the specified frequency count.
  //
  // freq  An array of frequencies, in which frequency[i] gives the frequency of literal i.
  // maxBits  The maximum number of bits to use for any literal.
  generate(freq: number[], maxBits: number) {
    if (this.freqcache == null) {
      // Allocate a reusable buffer with the longest possible frequency table.
      // Possible lengths are codegenCodeCount, offsetCodeCount and maxNumLit.
      // The largest of these is maxNumLit, so we allocate for that case.
      this.freqcache = [];
    }
    const list = this.freqcache.slice(0, freq.length + 1);
    // Number of non-zero literals
    let count = 0;
    // Set list to be the set of all non-zero literals and their frequencies
    for (let i = 0; i < freq.length; i++) {
      const f = freq[i];
      if (f !== 0) {
        list[count] = new LiteralNode(i, f);
        count++;
      } else {
        list[count] = new LiteralNode();
        this.codes[i].len = 0;
      }
    }
    list[freq.length] = new LiteralNode();

    // list = list[:count]
    if (count <= 2) {
      // Handle the small cases here, because they are awkward for the general case code. With
      // two or fewer literals, everything has bit length 1.
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        // "list" is in order of increasing literal value.
        this.codes[node.literal].set(i, 1);
      }
      return;
    }
    list.sort(compareByFreq);

    // Get the number of literals for each bit count
    const bitCount = this.bitCounts(list, maxBits);
    // And do the assignment
    this.assignEncodingAndSize(bitCount, list);
  }
}

function compareByLiteral(lhs: LiteralNode, rhs: LiteralNode) {
  return lhs.literal - rhs.literal;
}

function compareByFreq(lhs: LiteralNode, rhs: LiteralNode) {
  return lhs.freq === rhs.freq
    ? lhs.literal - rhs.literal
    : lhs.freq - rhs.freq;
}

function _reverseBits(number: number, bitLength: number): number {
  return reverseBits(number << (16 - bitLength));
}
