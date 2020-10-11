var fs = require('fs');
var express = require('express');

var app = express();
app.use(express.static(__dirname + '/public'));
console.log(__dirname+'/public')

var hostname = '127.0.0.1';
var port = 8131;

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

var bodyParser = require('body-parser');

var files = fs.readdirSync('public/images');
console.log(files)

app.get('/response.json', bodyParser.json(), function (req, res) {
  res.contentType('application/json');
  res.send(JSON.stringify(files));
});

app.listen(port, () => console.log('Server started on port: '+port));

