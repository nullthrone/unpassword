import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Content Security Policy for the built site. The browser may only talk to
 * this origin and to Google's APIs; everything else – including any attempt
 * to send file contents or passwords elsewhere – is blocked by the browser.
 * (Not applied to the dev server, whose HMR needs inline scripts.)
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: https://*.googleusercontent.com https://ssl.gstatic.com https://www.gstatic.com",
  "connect-src 'self' https://www.googleapis.com https://content.googleapis.com https://accounts.google.com",
  'frame-src https://accounts.google.com https://docs.google.com https://drive.google.com https://content.googleapis.com',
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'unpassword-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      ),
  };
}

export default defineConfig({
  base: './',
  plugins: [csp()],
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  worker: { format: 'es' },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
