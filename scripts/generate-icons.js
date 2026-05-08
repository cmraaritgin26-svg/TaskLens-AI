import fs from "fs";
import zlib from "zlib";

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

function blend(a, b, amount) {
  return a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
}

function inRoundedRect(x, y, size, radius) {
  const max = size - 1;
  const left = x < radius;
  const right = x > max - radius;
  const top = y < radius;
  const bottom = y > max - radius;

  if (!left && !right) return true;
  if (!top && !bottom) return true;

  const cx = left ? radius : max - radius;
  const cy = top ? radius : max - radius;
  return Math.hypot(x - cx, y - cy) <= radius;
}

function inRect(x, y, left, top, width, height) {
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

function inPoly(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function markAt(x, y, size) {
  const leftBar = inRect(x, y, size * 0.25, size * 0.24, size * 0.15, size * 0.52);
  const rightBar = inRect(x, y, size * 0.6, size * 0.24, size * 0.15, size * 0.52);
  const arrowShaft = inRect(x, y, size * 0.4, size * 0.47, size * 0.38, size * 0.12);
  const arrowHead = inPoly(x, y, [
    [size * 0.4, size * 0.39],
    [size * 0.18, size * 0.53],
    [size * 0.4, size * 0.67]
  ]);

  if (arrowShaft || arrowHead) return [96, 165, 250, 255];
  if (leftBar || rightBar) return [239, 68, 68, 255];
  return null;
}

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const radius = size * 0.17;
  const blueStart = [30, 64, 175];
  const blueMid = [15, 47, 104];
  const blueEnd = [7, 26, 63];

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;

    for (let x = 0; x < size; x += 1) {
      const offset = row + 1 + x * 4;
      const visible = inRoundedRect(x, y, size, radius);
      const diagonal = (x + y) / (size * 2);
      const background = diagonal < 0.55
        ? blend(blueStart, blueMid, diagonal / 0.55)
        : blend(blueMid, blueEnd, (diagonal - 0.55) / 0.45);
      const mark = markAt(x, y, size);
      const color = mark || background;

      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = visible ? color[3] || 255 : 0;
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

function writePng(path, size) {
  fs.mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  fs.writeFileSync(path, makePng(size));
}

const webIcons = [
  ["icons/icon-192.png", 192],
  ["icons/icon-512.png", 512],
  ["www/icons/icon-192.png", 192],
  ["www/icons/icon-512.png", 512],
  ["iphone/icons/icon-192.png", 192],
  ["iphone/icons/icon-512.png", 512],
  ["iphone/ios/App/App/public/icons/icon-192.png", 192],
  ["iphone/ios/App/App/public/icons/icon-512.png", 512],
  ["iphone/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024]
];

for (const [path, size] of webIcons) {
  writePng(path, size);
}

const androidSizes = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192]
];

for (const [folder, size] of androidSizes) {
  for (const name of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
    writePng(`android/app/src/main/res/${folder}/${name}`, size);
  }
}
