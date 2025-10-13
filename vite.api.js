import { readdirSync } from 'fs';
import { join } from 'path';

export default function apiMiddleware(req, res, next) {
  const apiDir = join(process.cwd(), 'api');
  const apiFiles = readdirSync(apiDir).map(file => file.replace('.js', ''));
  const url = new URL(req.url, `http://${req.headers.host}`);
  const [,, apiRoute] = url.pathname.split('/');

  if (apiFiles.includes(apiRoute)) {
    const apiPath = join(apiDir, `${apiRoute}.js`);
    import(apiPath).then(module => {
      module.default(req, res);
    }).catch(err => {
      console.error(err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
  } else {
    next();
  }
}