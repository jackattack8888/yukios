const ICON_DIR_ENTRY_SIZE = 16;
const ICON_TYPE = 1;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const SUPPORTED_BIT_COUNTS = [1, 4, 8, 24, 32];

function readDirectoryEntries(buffer) {
  if (buffer.length < 6) return [];
  if (buffer.readUInt16LE(0) !== 0) return [];
  if (buffer.readUInt16LE(2) !== ICON_TYPE) return [];

  const count = buffer.readUInt16LE(4);
  const entries = [];
  for (let index = 0; index < count; index++) {
    const base = 6 + index * ICON_DIR_ENTRY_SIZE;
    if (base + ICON_DIR_ENTRY_SIZE > buffer.length) break;
    entries.push({
      width: buffer[base] === 0 ? 256 : buffer[base],
      height: buffer[base + 1] === 0 ? 256 : buffer[base + 1],
      bytes: buffer.readUInt32LE(base + 8),
      offset: buffer.readUInt32LE(base + 12)
    });
  }
  return entries;
}

function isPngFrame(frame) {
  return PNG_SIGNATURE.every((byte, index) => frame[index] === byte);
}

function readPalette(frame, bitCount, offset) {
  const colorCount = bitCount === 1 ? 2 : bitCount === 4 ? 16 : 256;
  const entrySize = bitCount === 8 ? 4 : 3;
  const palette = [];
  for (let index = 0; index < colorCount; index++) {
    const at = offset + index * entrySize;
    if (at + 3 > frame.length) return null;
    palette.push([frame[at + 2], frame[at + 1], frame[at], 255]);
  }
  return palette;
}

function paletteEntrySize(bitCount) {
  return bitCount === 8 ? 4 : 3;
}

function decodeDibFrame(frame) {
  if (frame.length < 40) return null;

  const headerSize = frame.readUInt32LE(0);
  if (headerSize < 40) return null;
  if (frame.readUInt32LE(16) !== 0) return null;

  const bitCount = frame.readUInt16LE(14);
  if (!SUPPORTED_BIT_COUNTS.includes(bitCount)) return null;

  const rawHeight = frame.readInt32LE(8);
  const columns = frame.readInt32LE(4);
  const rows = Math.floor(Math.abs(rawHeight) / 2);
  if (columns < 1 || rows < 1) return null;

  const isTopDown = rawHeight < 0;
  const palette = bitCount <= 8 ? readPalette(frame, bitCount, headerSize) : null;
  if (bitCount <= 8 && !palette) return null;

  const dataOffset = headerSize + (palette ? palette.length * paletteEntrySize(bitCount) : 0);
  const rowSize = Math.ceil((columns * bitCount) / 32) * 4;
  if (dataOffset + rowSize * rows > frame.length) return null;

  const rgba = Buffer.alloc(columns * rows * 4);
  let hasVisibleAlpha = false;

  for (let row = 0; row < rows; row++) {
    const sourceRow = isTopDown ? row : rows - 1 - row;
    const rowStart = dataOffset + sourceRow * rowSize;

    for (let column = 0; column < columns; column++) {
      let red;
      let green;
      let blue;
      let alpha = 255;

      if (bitCount === 32) {
        const at = rowStart + column * 4;
        blue = frame[at];
        green = frame[at + 1];
        red = frame[at + 2];
        alpha = frame[at + 3];
        if (alpha !== 0) hasVisibleAlpha = true;
      } else if (bitCount === 24) {
        const at = rowStart + column * 3;
        blue = frame[at];
        green = frame[at + 1];
        red = frame[at + 2];
      } else {
        const pixelsPerByte = 8 / bitCount;
        const byte = frame[rowStart + Math.floor(column / pixelsPerByte)];
        const shift = 8 - bitCount * ((column % pixelsPerByte) + 1);
        const color = palette[(byte >> shift) & ((1 << bitCount) - 1)];
        if (!color) return null;
        [red, green, blue] = color;
      }

      const out = (row * columns + column) * 4;
      rgba[out] = red;
      rgba[out + 1] = green;
      rgba[out + 2] = blue;
      rgba[out + 3] = alpha;
    }
  }

  if (bitCount === 32 && !hasVisibleAlpha) {
    for (let at = 3; at < rgba.length; at += 4) rgba[at] = 255;
  }

  return { data: rgba, width: columns, height: rows };
}

function selectLargestFrame(entries, buffer) {
  let best = null;
  for (const entry of entries) {
    if (entry.bytes === 0 || entry.offset + entry.bytes > buffer.length) continue;
    if (!best || entry.width * entry.height > best.width * best.height) best = entry;
  }
  return best;
}

/**
 * Extracts the highest-resolution frame from an ICO buffer.
 * Returns `{ data, format, width, height }` where format is "png" or "raw" (4-channel BGRA-converted RGBA),
 * or null when the buffer is not a decodable ICO.
 */
export function decodeIco(buffer) {
  const entries = readDirectoryEntries(buffer);
  if (entries.length === 0) return null;

  const best = selectLargestFrame(entries, buffer);
  if (!best) return null;

  const frame = buffer.subarray(best.offset, best.offset + best.bytes);
  if (isPngFrame(frame)) {
    return { data: frame, format: "png", width: best.width, height: best.height };
  }

  const dib = decodeDibFrame(frame);
  if (!dib) return null;
  return { data: dib.data, format: "raw", width: dib.width, height: dib.height };
}

export function isIcoBuffer(buffer) {
  return buffer.length >= 6 && buffer.readUInt16LE(0) === 0 && buffer.readUInt16LE(2) === ICON_TYPE;
}
