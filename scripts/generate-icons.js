const fs = require("fs");
const zlib = require("zlib");

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const radius = size * 0.18;
  const palette = [
    [255, 247, 163],
    [250, 204, 21],
    [251, 146, 60],
    [249, 115, 22],
    [236, 72, 153],
    [225, 29, 72]
  ];

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = row + 1 + x * 4;
      const inCorner =
        (x < radius && y < radius && Math.hypot(radius - x, radius - y) > radius) ||
        (x > size - radius && y < radius && Math.hypot(x - (size - radius), radius - y) > radius) ||
        (x < radius && y > size - radius && Math.hypot(radius - x, y - (size - radius)) > radius) ||
        (x > size - radius && y > size - radius && Math.hypot(x - (size - radius), y - (size - radius)) > radius);

      const angle = Math.atan2(y - size * 0.5, x - size * 0.5) + Math.PI;
      const ring = Math.floor(Math.hypot(x - size * 0.5, y - size * 0.5) / (size * 0.12));
      const slice = Math.floor(angle / ((Math.PI * 2) / palette.length));
      const color = palette[(slice + ring) % palette.length];

      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = inCorner ? 0 : 255;

      const checkA = y > size * 0.47 && y < size * 0.68 && x > size * 0.25 && x < size * 0.44 && Math.abs(y - (x + size * 0.2)) < size * 0.05;
      const checkB = y > size * 0.28 && y < size * 0.72 && x > size * 0.38 && x < size * 0.74 && Math.abs(y + x - size * 0.95) < size * 0.055;
      const dot = Math.hypot(x - size * 0.32, y - size * 0.31) < size * 0.07 ||
        Math.hypot(x - size * 0.5, y - size * 0.31) < size * 0.07 ||
        Math.hypot(x - size * 0.68, y - size * 0.31) < size * 0.07;

      if (checkA || checkB) {
        raw[offset] = 255;
        raw[offset + 1] = 255;
        raw[offset + 2] = 255;
      } else if (dot) {
        raw[offset] = 255;
        raw[offset + 1] = 255;
        raw[offset + 2] = 255;
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

fs.mkdirSync("icons", { recursive: true });
fs.writeFileSync("icons/icon-192.png", makePng(192));
fs.writeFileSync("icons/icon-512.png", makePng(512));
