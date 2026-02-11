import fetch from 'node-fetch';
import { parse } from 'node-html-parser';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'a-secure-default-secret-for-development';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

/**
 * Clean Instagram URLs by removing escaped characters (\/ and \u0026)
 * Note: The generated .mp4 links have temporary validity due to Instagram's signature tokens.
 */
function cleanUrl(url) {
  return url
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
}

/**
 * Extracts the direct MP4 URL from a given Instagram Post or Reel URL.
 * Uses a lightweight scraping approach (parsing HTML meta tags and JSON).
 */
export async function extractInstagramMp4(url) {
  try {
    // Basic URL cleaning
    let fetchUrl = url.split('?')[0];
    if (!fetchUrl.endsWith('/')) {
      fetchUrl += '/';
    }

    const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': randomUA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Instagram page: ${response.statusText}`);
    }

    const html = await response.text();
    const root = parse(html);

    // 1. Try Meta Tag og:video
    const ogVideo = root.querySelector('meta[property="og:video"]');
    if (ogVideo) {
      const content = ogVideo.getAttribute('content');
      if (content && content.includes('.mp4')) {
        return cleanUrl(content);
      }
    }

    // 2. Try application/ld+json
    const ldJsonScripts = root.querySelectorAll('script[type="application/ld+json"]');
    for (const script of ldJsonScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const findInObject = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.contentUrl && (obj['@type'] === 'VideoObject' || obj.contentUrl.includes('.mp4'))) {
            return obj.contentUrl;
          }
          if (obj.video && obj.video.contentUrl) return obj.video.contentUrl;
          return null;
        };

        if (Array.isArray(data)) {
          for (const item of data) {
            const result = findInObject(item);
            if (result) return cleanUrl(result);
          }
        } else {
          const result = findInObject(data);
          if (result) return cleanUrl(result);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    // 3. Fallback to Regex for video_url or escaped scontent URLs
    // We look for patterns like "video_url":"https://..."
    const regexes = [
      /"video_url":"([^"]+)"/g,
      /"contentUrl":"([^"]+)"/g,
      /https:\\\/\\\/scontent[^"]*\.mp4[^"]*/g,
      /https:\/\/scontent[^"]*\.mp4[^"]*/g,
      /https:[^"]*cdninstagram[^"]*\.mp4[^"]*/g
    ];

    for (const regex of regexes) {
      const matches = html.matchAll(regex);
      for (const match of matches) {
        const potentialUrl = cleanUrl(match[1] || match[0]);
        if (potentialUrl.includes('.mp4') && potentialUrl.startsWith('https://')) {
          return potentialUrl;
        }
      }
    }

    throw new Error('Could not find MP4 video URL in the page content.');
  } catch (error) {
    console.error(`Error extracting from ${url}:`, error.message);
    throw error;
  }
}

export default async function handler(req, res) {
  // CORS Check
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ message: 'An array of URLs is required in the request body.' });
    }

    if (urls.length > 5) { // Adjusted to 5 per requirements
        return res.status(400).json({ message: 'Batch size too large. Maximum 5 URLs allowed per request.' });
    }

    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const mp4_url = await extractInstagramMp4(url);
          return {
            original_url: url,
            mp4_url,
            status: 'success'
          };
        } catch (error) {
          return {
            original_url: url,
            mp4_url: null,
            status: 'error',
            error: error.message
          };
        }
      })
    );

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(results);

  } catch (error) {
    console.error('API /instagram/extract error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
