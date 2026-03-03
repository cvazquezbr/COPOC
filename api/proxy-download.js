
// Vercel Edge Function for streaming proxy
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const urlToProxy = searchParams.get('url');

    if (!urlToProxy) {
      return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Security check: Ensure the URL is from an allowed host.
    const allowedHosts = [
        'blob.vercel-storage.com',
        'youtube.com',
        'youtu.be',
        'vimeo.com',
        'dailymotion.com',
        'dai.ly',
        'cocreatorscollab.com.br',
        'cocreators.app',
        'instagram.com',
        'cdninstagram.com',
        'fbcdn.net',
    ];
    const parsedUrl = new URL(urlToProxy);
    const isAllowedHost = allowedHosts.some(host =>
        parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host)
    );

    if (!isAllowedHost) {
      return new Response(JSON.stringify({
        error: 'URL host is not allowed',
        detectedHost: parsedUrl.host
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the file from the provided URL
    const response = await fetch(urlToProxy);

    if (!response.ok) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // Create a new response that streams the body from the original response
    // We only copy essential headers to avoid conflicts with security policies
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    const contentType = response.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);

    const contentLength = response.headers.get('Content-Length');
    if (contentLength) headers.set('Content-Length', contentLength);

    const acceptRanges = response.headers.get('Accept-Ranges');
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);

    return new Response(response.body, {
      status: 200,
      headers: headers,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
