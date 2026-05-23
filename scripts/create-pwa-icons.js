const { writeFileSync } = require('fs');
const { crc32 } = require('zlib');

function makePngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function makeMinimalPng({ width, height }) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(2, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdr = makePngChunk('IHDR', ihdrData);
  const rawData = Buffer.alloc(width * height * 3 + height);
  const idat = makePngChunk('IDAT', rawData);
  const iend = makePngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

writeFileSync('public/pwa-192x192.png', makeMinimalPng({ width: 192, height: 192 }));
writeFileSync('public/pwa-512x512.png', makeMinimalPng({ width: 512, height: 512 }));
console.log('PWA PNG icons created (replace with real icons before production).');
