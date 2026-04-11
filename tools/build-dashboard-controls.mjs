import { build, context } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, '..', 'frontend', 'dashboard-controls.tsx')],
  outfile: path.join(__dirname, '..', 'public', 'js', 'dashboard-react.bundle.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  logLevel: 'info'
};

if (watch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log('[dashboard-controls] watching for changes');
  const close = async () => {
    await ctx.dispose();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
} else {
  await build(buildOptions);
}
