import { build, context } from 'esbuild';

const sourceRoot = '/home/fridge/serpentine-homepage';
const entryPoint = `${sourceRoot}/dashboard-homepage.tsx`;
const outFile = '/home/fridge/docker/dashboard/public/js/dashboard-homepage.bundle.js';
const watch = process.argv.includes('--watch');

const buildOptions = {
  absWorkingDir: sourceRoot,
  entryPoints: [entryPoint],
  outfile: outFile,
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
  console.log('[dashboard-homepage] watching for changes in /home/fridge/serpentine-homepage');
  const close = async () => {
    await ctx.dispose();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
} else {
  await build(buildOptions);
}
