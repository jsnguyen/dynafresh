var fs = require('fs')
var path = require('path')
var express = require('express')
var chokidar = require('chokidar')
var WebSocket = require('ws');

function tlog(msg){
    let date_obj = new Date().toISOString()
    console.log(`[${date_obj}] ${msg}`)
}

// server parameters
var hostname = 'localhost'
const port = 12301

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
    tlog('New connection')

    // if any change to files, send new file list
    var watcher = chokidar.watch([], {ignored: /^\./, persistent: true});
    watcher.on('change', (path) => {
      console.log(`File changed, sending update to client ${path}`);
      fs.copyFileSync(path, imageFiles[path]['copyDestPath']);
      ws.send(`filepath:${imageFiles[path]['destPath']}`);
    })

    ws.on('message', function message(msg) {

      tlog(`Received message: ${msg}`)
      try {
        const data = JSON.parse(msg);
        const srcPath = data.filepath;
        console.log(`Source path: ${srcPath}`);
        if (data.filepath) {
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
      } catch (e) {
        tlog(`Error parsing message: ${e}`);
      }
  })

})
