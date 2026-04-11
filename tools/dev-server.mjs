import { spawn } from 'node:child_process';

const children = [
  spawn('node', ['tools/build-dashboard-controls.mjs', '--watch'], { stdio: 'inherit' }),
  spawn('node', ['tools/build-dashboard-homepage.mjs', '--watch'], { stdio: 'inherit' }),
  spawn('node', ['--watch', 'index.js'], { stdio: 'inherit' })
];

const shutdown = (signal) => {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
};

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown('SIGTERM');
      process.exit(code);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
