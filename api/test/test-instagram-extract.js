import { extractInstagramMp4 } from '../instagram/extract.js';

const testUrls = [
  'https://www.instagram.com/reels/DCP2N2pI737/',
  'https://www.instagram.com/p/DCP2N2pI737/',
  'https://www.instagram.com/p/DOWwKx2guLv/'
];

async function runTests() {
  for (const url of testUrls) {
    console.log(`\nTesting: ${url}`);
    try {
      const result = await extractInstagramMp4(url);
      if (result) {
        console.log(`SUCCESS: Found MP4 URL: ${result.substring(0, 100)}...`);
      } else {
        console.log('FAILED: extractInstagramMp4 returned null');
      }
    } catch (error) {
      console.log(`FAILED: Error during extraction: ${error.message}`);
    }
  }
}

runTests();
