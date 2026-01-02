
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
    // This is a basic check. For production, you might want a more robust solution,
    // like a whitelist of domains stored in environment variables.
    const allowedHosts = ['public.blob.vercel-storage.com'];
    const parsedUrl = new URL(urlToProxy);
    if (!allowedHosts.includes(parsedUrl.host)) {
      return new Response(JSON.stringify({ error: 'URL host is not allowed' }), {
        status: 403, // Forbidden
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
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*'); // Allow any origin to access this proxy

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
