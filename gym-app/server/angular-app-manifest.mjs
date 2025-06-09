
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: 'C:/Program Files/Git/gym-app/',
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
    'index.csr.html': {size: 2858, hash: '20d5c475bdf51ea1a629449b3ad37fde41b10dcdaa80c7162a920f9d2056f7e8', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1525, hash: '07de3174d610a00aa86cf3bf2f903b26d0b7c14066ca29d4dc7b86f7187cb36f', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-7PXMFGEA.css': {size: 57621, hash: 'fxQo7I+yQsc', text: () => import('./assets-chunks/styles-7PXMFGEA_css.mjs').then(m => m.default)}
  },
};
