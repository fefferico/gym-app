import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();

// Create Angular app engine - NO ARGUMENTS HERE
const angularApp = new AngularNodeAppEngine();

// --- Define your baseHref here (should match angular.json) ---
const APP_BASE_HREF = '/gym-app';

// Serve static files for paths containing a dot, under the APP_BASE_HREF
// This ensures requests like /gym-app/assets/icon.svg are attempted first as static files.
app.get(`${APP_BASE_HREF}/*.*`, express.static(browserDistFolder, {
  maxAge: '1y',
  index: false,      // Important: do not serve index.html from the static middleware
  redirect: false,
}));

// Angular app rendering for all other GET requests.
// The AngularNodeAppEngine should internally handle the APP_BASE_HREF for routing.
app.get('*', (req, res, next) => {
  angularApp
    .handle(req) // `req.originalUrl` will be like /gym-app/your-route
    .then((response) => {
      if (response) {
        writeResponseToNodeResponse(response, res);
      } else {
        // If angularApp.handle() returns null/undefined, it means it didn't handle the route.
        // This could be a 404 from Angular's perspective or a request it chose not to process.
        console.warn(`Angular engine did not produce a response for: ${req.originalUrl}`);
        // Fallback to a simple 404 or let Express handle it if there are subsequent error handlers.
        // For an SPA, unhandled GETs that aren't assets usually mean a 404 page served by Angular itself.
        // If this path is reached for a non-asset, it's likely an issue with the Angular routing or SSR setup.
        res.status(404).send('Page not found by Angular application.');
      }
    })
    .catch(next); // Pass errors to Express's default error handler
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}${APP_BASE_HREF}/`);
  });
}

export const reqHandler = createNodeRequestHandler(app);