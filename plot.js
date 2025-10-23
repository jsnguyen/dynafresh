#!/usr/bin/env node

const { io } = require('socket.io-client');
const path = require('path');

const port = 12301;

// Get filepaths from command line arguments
const filepaths = process.argv.slice(2).map(fp => path.resolve(fp));

if (filepaths.length === 0) {
  console.error('Usage: ./plot.js <filepath1> [filepath2] [...]');
  process.exit(1);
}

console.log(`Opening ${filepaths.length} plot(s)...`);

const socket = io(`http://localhost:${port}`, {
  reconnection: false,
  timeout: 5000
});

socket.on('connect', () => {
  console.log('✓ Connected to server');
  socket.emit('openPlots', filepaths);
  console.log(`✓ Sent ${filepaths.length} plot(s) to server`);
  
  // Disconnect and exit after sending
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 500);
});

socket.on('connect_error', (error) => {
  console.error(`✗ Failed to connect to server: ${error.message}`);
  console.error(`  Make sure the server is running on port ${port}`);
  process.exit(1);
});
