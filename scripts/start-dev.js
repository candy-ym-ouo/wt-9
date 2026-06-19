const { spawn } = require('child_process');
const { existsSync } = require('fs');
const net = require('net');
const { join } = require('path');

const rootDir = process.cwd();
const backendDir = join(rootDir, 'backend');
const frontendDir = join(rootDir, 'frontend');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

function run(command, args, cwd, name, env = process.env) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
      return;
    }
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
      shutdown();
    }
  });

  return child;
}

function ensureInstalled() {
  const backendModules = existsSync(join(backendDir, 'node_modules'));
  const frontendModules = existsSync(join(frontendDir, 'node_modules'));

  if (!backendModules || !frontendModules) {
    console.error('Dependencies are missing. Run `npm run install:all` first.');
    process.exit(1);
  }
}

const children = [];

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(startPort) {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port += 1;
  }
  return port;
}

function shutdown() {
  while (children.length) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  ensureInstalled();

  const backendPort = await findAvailablePort(3000);
  if (backendPort !== 3000) {
    console.log(`Port 3000 is busy, using backend port ${backendPort} instead.`);
  }

  const sharedEnv = {
    ...process.env,
    PORT: String(backendPort),
    BACKEND_PORT: String(backendPort),
    VITE_API_TARGET: `http://127.0.0.1:${backendPort}`,
  };

  children.push(run(npmCmd, ['run', 'start:dev'], backendDir, 'backend', sharedEnv));
  children.push(run(npmCmd, ['run', 'dev', '--', '--host'], frontendDir, 'frontend', sharedEnv));
}

main().catch((error) => {
  console.error(error);
  shutdown();
  process.exit(1);
});
