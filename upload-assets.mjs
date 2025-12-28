import { put } from '@vercel/blob';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function uploadFile(filePath, blobName) {
  const fileData = readFileSync(filePath);
  const blob = await put(blobName, fileData, {
    access: 'public',
    addRandomSuffix: false
  });
  console.log(blob.url);
}

async function main() {
  try {
    console.log('Uploading ffmpeg-core.js...');
    await uploadFile(
      resolve('node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js'),
      'ffmpeg-core.js'
    );

    console.log('Uploading ffmpeg-core.wasm...');
    await uploadFile(
      resolve('node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm'),
      'ffmpeg-core.wasm'
    );

    console.log('Upload complete.');
  } catch (error) {
    console.error('Error uploading files:', error);
  }
}

main();
