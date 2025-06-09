
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/gym-app/',
  locale: undefined,
  routes: undefined,
  entryPointToBrowserMapping: {
  "src/app/features/workout-tracker/workout-tracker.routes.ts": [
    {
      "path": "chunk-GNPNRPY6.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-DTGTDYOV.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-7PRPN7VN.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-WNG5FCQ7.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-33TTW6GX.js",
      "dynamicImport": false
    }
  ],
  "src/app/features/history-stats/history-stats.routes.ts": [
    {
      "path": "chunk-VYASKGX4.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-DTGTDYOV.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-AU2LICDD.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-7PRPN7VN.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-WNG5FCQ7.js",
      "dynamicImport": false
    }
  ],
  "src/app/features/exercise-library/exercise-library.routes.ts": [
    {
      "path": "chunk-ZY6Y7O54.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-AU2LICDD.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-WNG5FCQ7.js",
      "dynamicImport": false
    }
  ],
  "src/app/features/profile-settings/profile-settings.routes.ts": [
    {
      "path": "chunk-T5I2HBCF.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-7PRPN7VN.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-WNG5FCQ7.js",
      "dynamicImport": false
    }
  ],
  "src/app/features/training-programs/training-program-builder/training-program-builder.ts": [
    {
      "path": "chunk-L7SXLIKN.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-33TTW6GX.js",
      "dynamicImport": false
    }
  ],
  "src/app/features/training-programs/training-program.routes.ts": [
    {
      "path": "chunk-AYU4UXH7.js",
      "dynamicImport": false
    },
    {
      "path": "chunk-L7SXLIKN.js",
      "dynamicImport": true
    },
    {
      "path": "chunk-L7SXLIKN.js",
      "dynamicImport": true
    },
    {
      "path": "chunk-L7SXLIKN.js",
      "dynamicImport": true
    }
  ]
},
  assets: {
    'index.csr.html': {size: 2838, hash: 'ce9dff2910acc52c3a995407d63d557d9210d1c899d5a058ac9a78737801e459', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1505, hash: 'bc4b422766a99dbf6f99fe553488e3d7a523052fd6a8d08f805933d73f124e60', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-7PXMFGEA.css': {size: 57621, hash: 'fxQo7I+yQsc', text: () => import('./assets-chunks/styles-7PXMFGEA_css.mjs').then(m => m.default)}
  },
};
