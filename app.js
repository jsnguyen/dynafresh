var fs = require('fs')
var path = require('path')
var express = require('express')
var chokidar = require('chokidar');

var app = express()
app.use(express.static(__dirname + '/public'))
console.log(__dirname+'/public')

var hostname = '127.0.0.1'
var port = 8131

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'))
})

var bodyParser = require('body-parser')

function getImageArray(){
  var files = fs.readdirSync('public/images')

  var allowedExt = ['.jpg','.png','.pdf']

  var imageFiles=[]
  files.forEach(file => { 
    if ( allowedExt.includes(path.extname(file)) ){
      imageFiles.push(file)
    }
  }) 

  return imageFiles
}

var watcher = chokidar.watch('public/images', {ignored: /^\./, persistent: true});
watcher.on('add', () => files=getImageArray())

app.get('/response.json', bodyParser.json(), function (req, res) {
  res.contentType('application/json')
  res.send(JSON.stringify(files))
})

app.listen(port, () => console.log('Server started on port: '+port))
