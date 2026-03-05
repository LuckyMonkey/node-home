import { build } from 'esbuild';
import path from 'node:path';

await build({
  absWorkingDir: '/home/fridge/snakelet',
  entryPoints: ['/home/fridge/snakelet/serpentine-demo.tsx'],
  outfile: '/home/fridge/docker/dashboard/public/js/snakelet.bundle.js',
  alias: {
    react: '/home/fridge/snakelet/node_modules/react/index.js',
    'react-dom/client': '/home/fridge/snakelet/node_modules/react-dom/client.js'
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  logLevel: 'info'
});
