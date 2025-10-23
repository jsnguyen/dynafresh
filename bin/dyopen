#!/usr/bin/env node

const path = require('path');
const { io } = require('socket.io-client');

const DEFAULT_PORT = 12301;

const resolvePaths = (paths) => paths.map((filepath) => path.resolve(filepath));

const printUsageAndExit = () => {
  console.error('Usage: dyopen <filepath1> [filepath2] [...]');
  process.exit(1);
};

const main = () => {
  const args = process.argv.slice(2);
  if (!args.length) {
    printUsageAndExit();
  }

  const filepaths = resolvePaths(args);
  console.log(`Opening ${filepaths.length} plot(s)...`);

  const socket = io(`http://localhost:${DEFAULT_PORT}`, {
    reconnection: false,
    timeout: 5000
  });

  socket.on('connect', () => {
    console.log('✓ Connected to server');
    socket.emit('openPlots', filepaths);
    console.log(`✓ Sent ${filepaths.length} plot(s) to server`);
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 300);
  });

  socket.on('connect_error', (error) => {
    console.error(`✗ Failed to connect to server: ${error.message}`);
    console.error(`  Make sure the server is running on port ${DEFAULT_PORT}`);
    process.exit(1);
  });
};

main();
