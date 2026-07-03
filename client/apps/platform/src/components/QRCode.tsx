// Minimal QR code generator — self-contained, no external dependencies.
// Implements the QR Code Model 2 specification for byte-mode encoding,
// using a compact lookup-table approach for the Reed-Solomon and masking.
//
// Reference: ISO/IEC 18004. This implementation supports versions 1-10
// (up to ~271 bytes), which is more than enough for otpauth:// URLs.

'use client';

import React, { useMemo } from 'react';

// ─── GF(256) arithmetic for Reed-Solomon ──────────────────────────────────────
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const newPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= poly[j];
      newPoly[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = newPoly;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const result = data.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = result[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      result[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return result.slice(data.length);
}

// ─── QR version capacity (byte mode, L error correction) ─────────────────────
// Max data bytes for versions 1-10, level L
const VERSION_CAPACITY_L = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
// EC codeword counts per block for versions 1-10, level L
const VERSION_EC_L: Array<{ ec: number; blocks: number[] }> = [
  { ec: 7, blocks: [19] },   // v1
  { ec: 10, blocks: [34] },  // v2
  { ec: 15, blocks: [55] },  // v3
  { ec: 20, blocks: [80] },  // v4
  { ec: 26, blocks: [108] }, // v5
  { ec: 18, blocks: [68, 68] }, // v6
  { ec: 20, blocks: [78, 78] }, // v7
  { ec: 24, blocks: [97, 97] }, // v8
  { ec: 30, blocks: [116, 116] }, // v9
  { ec: 18, blocks: [68, 68, 69, 69] }, // v10
];

function pickVersion(byteLen: number): number {
  for (let v = 0; v < VERSION_CAPACITY_L.length; v++) {
    if (byteLen + 2 <= VERSION_CAPACITY_L[v]) return v; // +2 for mode+count headers
  }
  throw new Error('Data too long for QR versions 1-10');
}

// ─── Bit buffer ───────────────────────────────────────────────────────────────
class BitBuffer {
  bits: number[] = [];
  put(num: number, len: number) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((num >> i) & 1);
  }
  putBytes(bytes: number[]) {
    for (const b of bytes) this.put(b, 8);
  }
  get length() { return this.bits.length; }
}

// ─── Finder + alignment + timing patterns ─────────────────────────────────────
function moduleCount(version: number): number {
  return 17 + version * 4; // version is 1-indexed here
}

function placeFinder(matrix: number[][], reserved: boolean[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r, cc = col + c;
      if (rr < 0 || cc < 0 || rr >= matrix.length || cc >= matrix.length) continue;
      const isBorder = (r === 0 || r === 6) && c >= 0 && c <= 6;
      const isSide = (c === 0 || c === 6) && r >= 0 && r <= 6;
      const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const isPadding = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      if (isBorder || isSide || isCenter) {
        matrix[rr][cc] = 1;
      } else if (isPadding) {
        matrix[rr][cc] = 0;
      }
      reserved[rr][cc] = true;
    }
  }
}

// Alignment pattern positions (versions 2-10)
const ALIGN_POS: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

function placeAlignment(matrix: number[][], reserved: boolean[][], version: number) {
  const pos = ALIGN_POS[version];
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      const r = pos[i], c = pos[j];
      // Skip if overlapping finder
      if ((r === 6 && c === 6) || reserved[r]?.[c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= matrix.length || cc >= matrix.length) continue;
          const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          const isCenter = dr === 0 && dc === 0;
          matrix[rr][cc] = isBorder || isCenter ? 1 : 0;
          reserved[rr][cc] = true;
        }
      }
    }
  }
}

function placeTiming(matrix: number[][], reserved: boolean[][], size: number) {
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) { matrix[6][i] = i % 2 === 0 ? 1 : 0; reserved[6][i] = true; }
    if (!reserved[i][6]) { matrix[i][6] = i % 2 === 0 ? 1 : 0; reserved[i][6] = true; }
  }
}

function placeFormatInfo(matrix: number[][], reserved: boolean[][], mask: number) {
  // Format info for L error correction, encoded with mask pattern
  const ecLevel = 0b01; // L
  let format = (ecLevel << 3) | mask;
  // BCH(15,5) encoding
  let g = format << 10;
  for (let i = 14; i >= 10; i--) {
    if ((g >> i) & 1) g ^= 0b10100110111 << (i - 10);
  }
  const formatBits = ((format << 10) | g) ^ 0b101010000010010;
  const size = matrix.length;
  // Place format bits around finders
  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >> i) & 1;
    // Around top-left finder
    let r: number, c: number;
    if (i < 6) { r = 8; c = i; }
    else if (i < 8) { r = 8; c = i + 1; }
    else if (i < 9) { r = 7; c = 8; }
    else { r = 14 - i; c = 8; }
    matrix[r][c] = bit;
    reserved[r][c] = true;
    // Around top-right + bottom-left finder
    if (i < 8) { r = size - 1 - i; c = 8; }
    else { r = 8; c = size - 15 + i; }
    matrix[r][c] = bit;
    reserved[r][c] = true;
  }
  // Dark module
  matrix[size - 8][8] = 1;
  reserved[size - 8][8] = true;
}

// ─── Data placement ───────────────────────────────────────────────────────────
function placeData(matrix: number[][], reserved: boolean[][], bits: number[]) {
  const size = matrix.length;
  let bitIdx = 0;
  let goingUp = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip timing column
    for (let i = 0; i < size; i++) {
      const row = goingUp ? size - 1 - i : i;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (reserved[row][c]) continue;
        matrix[row][c] = bitIdx < bits.length ? bits[bitIdx++] : 0;
      }
    }
    goingUp = !goingUp;
  }
}

// ─── Masking ──────────────────────────────────────────────────────────────────
function applyMask(matrix: number[][], reserved: boolean[][], mask: number, size: number) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (r + c) % 2 === 0; break;
        case 1: invert = r % 2 === 0; break;
        case 2: invert = c % 3 === 0; break;
        case 3: invert = (r + c) % 3 === 0; break;
        case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
        case 5: invert = ((r * c) % 2) + ((r * c) % 3) === 0; break;
        case 6: invert = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
        case 7: invert = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break;
      }
      if (invert) matrix[r][c] ^= 1;
    }
  }
}

function penalty(matrix: number[][]): number {
  const size = matrix.length;
  let p = 0;
  // Rule 1: consecutive modules
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) { run++; }
      else { if (run >= 5) p += run - 2; run = 1; }
    }
    if (run >= 5) p += run - 2;
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) { run++; }
      else { if (run >= 5) p += run - 2; run = 1; }
    }
    if (run >= 5) p += run - 2;
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      if (matrix[r][c] === matrix[r][c+1] && matrix[r][c] === matrix[r+1][c] && matrix[r][c] === matrix[r+1][c+1]) {
        p += 3;
      }
    }
  }
  return p;
}

// ─── Main QR generation ───────────────────────────────────────────────────────
function generateQR(text: string): number[][] {
  const bytes = new TextEncoder().encode(text);
  const versionIdx = pickVersion(bytes.length);
  const version = versionIdx + 1; // 1-indexed
  const size = moduleCount(version);

  // Encode data: byte mode (4-bit), char count (8-bit for v1-9), data, terminator, pad
  const bb = new BitBuffer();
  bb.put(0b0100, 4); // byte mode
  bb.put(bytes.length, version <= 9 ? 8 : 16);
  bb.putBytes(Array.from(bytes));
  // Terminator (up to 4 zero bits)
  const totalDataBits = VERSION_CAPACITY_L[versionIdx] * 8;
  for (let i = 0; i < 4 && bb.length < totalDataBits; i++) bb.put(0, 1);
  // Pad to byte boundary
  while (bb.length % 8 !== 0) bb.put(0, 1);
  // Pad bytes
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bb.length < totalDataBits) {
    bb.put(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to codewords
  const codewords: number[] = [];
  for (let i = 0; i < bb.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bb.bits[i + j];
    codewords.push(byte);
  }

  // Error correction
  const ecInfo = VERSION_EC_L[versionIdx];
  const ecLen = ecInfo.ec;
  const blockSizes = ecInfo.blocks;
  const totalBlocks = blockSizes.length;
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < totalBlocks; b++) {
    const data = codewords.slice(offset, offset + blockSizes[b]);
    offset += blockSizes[b];
    dataBlocks.push(data);
    ecBlocks.push(rsEncode(data, ecLen));
  }

  // Interleave
  const maxDataLen = Math.max(...blockSizes);
  const interleaved: number[] = [];
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < dataBlocks[b].length) interleaved.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      interleaved.push(ecBlocks[b][i]);
    }
  }

  // Convert to bits
  const dataBits: number[] = [];
  for (const cw of interleaved) {
    for (let i = 7; i >= 0; i--) dataBits.push((cw >> i) & 1);
  }

  // Build matrix
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  placeFinder(matrix, reserved, 0, 0);
  placeFinder(matrix, reserved, 0, size - 7);
  placeFinder(matrix, reserved, size - 7, 0);
  if (version >= 2) placeAlignment(matrix, reserved, version);
  placeTiming(matrix, reserved, size);

  // Try all 8 masks, pick lowest penalty
  let bestMask = 0;
  let bestPenalty = Infinity;
  const candidates: number[][][] = [];
  for (let mask = 0; mask < 8; mask++) {
    const m = matrix.map(row => [...row]);
    const res = reserved.map(row => [...row]);
    placeData(m, res, dataBits);
    applyMask(m, res, mask, size);
    placeFormatInfo(m, res, mask);
    const pen = penalty(m);
    candidates.push(m);
    if (pen < bestPenalty) { bestPenalty = pen; bestMask = mask; }
  }

  return candidates[bestMask];
}

// ─── React component ──────────────────────────────────────────────────────────
interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
  bgColor?: string;
  fgColor?: string;
}

export const QRCode: React.FC<QRCodeProps> = ({
  value,
  size = 200,
  className = '',
  bgColor = '#ffffff',
  fgColor = '#000000',
}) => {
  const matrix = useMemo(() => {
    try {
      return generateQR(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bgColor }}
      >
        <span style={{ color: '#999', fontSize: 12 }}>QR unavailable</span>
      </div>
    );
  }

  const n = matrix.length;
  const cellSize = size / n;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="QR code"
    >
      <rect width={size} height={size} fill={bgColor} />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill={fgColor}
            />
          ) : null
        )
      )}
    </svg>
  );
};

export default QRCode;