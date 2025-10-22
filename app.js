const fs = require('fs')
const path = require('path')
const express = require('express')
const chokidar = require('chokidar')
const WebSocket = require('ws');
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

app.listen(port, () => tlog(`Server started on port ${port}`))

// websocket on +1 port
tlog(`WebSocket server starting on port ${port+1}`)
var wss = new WebSocket.Server({ port: port + 1 });

let imageFiles = {};

wss.on('connection', ws => {

    // send files on first connection
    tlog('New connection');

    // if any change to files, send new file list
    const watcher = chokidar.watch([], { ignored: /^\./, persistent: true, ignoreInitial: true });
    watcher.on('change', (path) => {
      console.log(`File changed, sending update to client ${path}`);
      fs.copyFileSync(path, imageFiles[path]['copyDestPath']);
      ws.send(`filepath:${imageFiles[path]['destPath']}`);
    })

    function parseFilepath(srcPath){
      if (srcPath) {
        const copyDestPath = path.join(__dirname, 'public', 'images', path.basename(srcPath));
        const destPath = path.join('images', path.basename(srcPath));

        console.log(`Copy Destination path: ${copyDestPath}`);
        console.log(`Destination path: ${destPath}`);

        imageFiles[srcPath] = {}
        imageFiles[srcPath]['destPath'] = destPath;
        imageFiles[srcPath]['copyDestPath'] = copyDestPath;

        watcher.add(srcPath);

        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, copyDestPath);
          ws.send(`filepath:${destPath}`);
        } else {
          ws.send('filepath:');
        }
      }
    }

    ws.on('message', function message(msg) {
      tlog(`Received message: ${msg}`)
      try {
        const data = JSON.parse(msg);
        const srcPath = data.filepath;
        console.log(`Source path: ${srcPath}`);
        parseFilepath(srcPath);
      } catch (e) {
        tlog(`Error parsing message: ${e}`);
      }
    })

    // on initial connection, if initial filename provided, send it
    if (initialFilepath) {
      ws.send(`initialFilepath:${initialFilepath}`);
      parseFilepath(initialFilepath);
    }

})
