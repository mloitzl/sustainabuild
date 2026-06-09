#!/usr/bin/env node
// @ts-check
const esbuild = require('esbuild');
const path = require('path');

esbuild
  .build({
    entryPoints: [path.join(__dirname, '../dist/index.js')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.join(__dirname, '../dist/agent'),
    // dbus-next is optional and only available on Linux; mark as external
    // so the binary doesn't fail to start on non-Linux platforms
    external: ['dbus-next'],
    minify: false,
    sourcemap: true,
  })
  .then(() => {
    console.log('[bundle] dist/agent created');
  })
  .catch((err) => {
    console.error('[bundle] Failed:', err);
    process.exit(1);
  });
