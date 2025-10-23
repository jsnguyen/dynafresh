const fs = require('fs')
const path = require('path')
const express = require('express')
const chokidar = require('chokidar')
const { Server } = require('socket.io');
const { program } = require('commander');

function tlog(msg){
    let date_obj = new Date().toISOString()
    console.log(`[${date_obj}] ${msg}`)
}

program
  .option('-f, --file <filename>', 'input filename')
  .option('-p, --port <number>', 'port number for the server', '12301');

program.parse(process.argv);

const initialFilepath = program.opts().file ? path.resolve(program.opts().file) : null;
const port = parseInt(program.opts().port);

// server parameters
var hostname = 'localhost'

var app = express()
app.use(express.static(__dirname + '/public'))

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'))
})

const server = app.listen(port, () => tlog(`Server started on port ${port}`))

// socket.io on same server
tlog(`Socket.io server starting`)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', socket => {

    // send files on first connection
    tlog('New connection');

    // Track files per connection with their plotIds
    const imageFiles = {};
    const plotWatchers = new Map(); // Map of plotId -> {srcPath, watcher}
    
    // Handle openPlots command (from plot.js)
    socket.on('openPlots', (filepaths) => {
      tlog(`Received command to open ${filepaths.length} plots`);
      io.emit('openPlots', filepaths);
    });

    // Create watcher for file changes
    const watcher = chokidar.watch([], { ignored: /^\./, persistent: true, ignoreInitial: true });
    
    watcher.on('change', (changedPath) => {
      console.log(`File changed: ${changedPath}`);
      
      // Find which plots are watching this file
      for (const [plotId, info] of plotWatchers.entries()) {
        if (info.srcPath === changedPath && imageFiles[changedPath]) {
          fs.copyFileSync(changedPath, imageFiles[changedPath]['copyDestPath']);
          socket.emit('filepath', {
            filepath: imageFiles[changedPath]['destPath'],
            plotId: plotId
          });
          console.log(`Sent update to plot ${plotId}`);
        }
      }
    });

    function parseFilepath(srcPath, plotId){
      if (srcPath) {
        const copyDestPath = path.join(__dirname, 'public', 'images', path.basename(srcPath));
        const destPath = path.join('images', path.basename(srcPath));

        console.log(`Plot ${plotId} - Copy Destination path: ${copyDestPath}`);
        console.log(`Plot ${plotId} - Destination path: ${destPath}`);

        // Store file info
        if (!imageFiles[srcPath]) {
          imageFiles[srcPath] = {
            destPath: destPath,
            copyDestPath: copyDestPath
          };
        }

        // Track which plot is watching this file
        plotWatchers.set(plotId, { srcPath: srcPath });

        // Add to watcher if not already watched
        if (!watcher.getWatched()[path.dirname(srcPath)]?.includes(path.basename(srcPath))) {
          watcher.add(srcPath);
        }

        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, copyDestPath);
          socket.emit('filepath', { filepath: destPath, plotId: plotId });
        } else {
          socket.emit('filepath', { filepath: '', plotId: plotId });
        }
      }
    }

    // Handle unwatch action
    socket.on('unwatch', (data) => {
      tlog(`Received unwatch: ${JSON.stringify(data)}`);
      const plotId = data.plotId;
      if (plotWatchers.has(plotId)) {
        const info = plotWatchers.get(plotId);
        console.log(`Plot ${plotId} stopped watching ${info.srcPath}`);
        plotWatchers.delete(plotId);
        
        // If no plots are watching this file anymore, unwatch it
        const stillWatched = Array.from(plotWatchers.values()).some(p => p.srcPath === info.srcPath);
        if (!stillWatched) {
          watcher.unwatch(info.srcPath);
          console.log(`Unwatched file: ${info.srcPath}`);
        }
      }
    });
    
    // Handle filepath watch request
    socket.on('watchFilepath', (data) => {
      tlog(`Received watchFilepath: ${JSON.stringify(data)}`);
      const srcPath = data.filepath;
      const plotId = data.plotId;
      console.log(`Plot ${plotId} - Source path: ${srcPath}`);
      parseFilepath(srcPath, plotId);
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      tlog('Client disconnected, cleaning up watchers');
      watcher.close();
    });

    // on initial connection, if initial filename provided, send it
    if (initialFilepath) {
      const initialPlotId = 1; // First plot will have ID 1
      socket.emit('initialFilepath', { filepath: initialFilepath, plotId: initialPlotId });
      parseFilepath(initialFilepath, initialPlotId);
    }

});
