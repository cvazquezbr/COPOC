import { readdirSync } from 'fs';
import { join } from 'path';

export default function apiMiddleware(req, res, next) {
  const apiDir = join(process.cwd(), 'api');
  const apiFiles = readdirSync(apiDir).map(file => file.replace('.js', ''));
  const url = new URL(req.url, `http://${req.headers.host}`);

  // More robustly extract the API route name from the pathname
  const apiRoute = url.pathname.startsWith('/api/') ? url.pathname.split('/')[2] : null;

  if (apiRoute && apiFiles.includes(apiRoute)) {
    const apiPath = 'file://' + join(apiDir, `${apiRoute}.js`);

    import(apiPath).then(async (module) => {
      try {
        // Construct a WHATWG Request object from the Node.js request.
        // This simulates the Vercel Edge environment.
        const request = new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers: req.headers,
          // Body is not needed for the proxy-download endpoint which uses GET.
        });

        // Await the Edge Function handler.
        const response = await module.default(request);

        // Convert the WHATWG Response object back to a Node.js response.
        res.statusCode = response.status;
        for (const [key, value] of response.headers.entries()) {
          res.setHeader(key, value);
        }

        // Stream the response body
        if (response.body) {
          for await (const chunk of response.body) {
            res.write(chunk);
          }
        }
        res.end();

      } catch (err) {
        console.error(`Error processing API route ${apiRoute}:`, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }).catch(err => {
      console.error(`Error importing API module ${apiRoute}:`, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
  } else {
    next();
  }
}