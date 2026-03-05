import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await build({
  entryPoints: [path.join(__dirname, 'dashboard-homepage.tsx')],
  outfile: path.join(__dirname, '..', 'public', 'js', 'dashboard-homepage.bundle.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  logLevel: 'info'
});
