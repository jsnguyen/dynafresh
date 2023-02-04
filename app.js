var fs = require('fs')
var path = require('path')
var express = require('express')
var chokidar = require('chokidar')
var WebSocket = require('ws')

function getImageFiles(){
  var files = fs.readdirSync('public/images')

  var allowedExt = ['.jpg','.png','.pdf', '.gif']

  var imageFiles=[]
  files.forEach(file => { 
    if ( allowedExt.includes(path.extname(file)) ){
      imageFiles.push(file)
    }
  }) 

  return imageFiles
}

function sendFiles(ws){
    files=getImageFiles()
    json = JSON.stringify(files)
    tlog(`Sent ${json}`)
    ws.send(json)
}

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

var wss = new WebSocket.Server({ port: port+1} )

wss.on('connection', (ws) => {

    // send files on first connection
    tlog('New connection')
    sendFiles(ws)

    // if any change to files, send new file list
    var watcher = chokidar.watch('public/images', {ignored: /^\./, persistent: true});
    watcher.on('change', () => {
        sendFiles(ws)
    })

})
