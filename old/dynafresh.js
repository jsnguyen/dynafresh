var timeoutPeriod = 500;
var imageURI = 'plot.png';
var x=0, y=0;
var img = new Image();

img.onload = function() {
    var canvas = document.getElementById("canvas");
    var context = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context.drawImage(img, (canvas.width-img.width)/2, (canvas.height-img.height)/2);
    setTimeout(timedRefresh,timeoutPeriod);
};

function timedRefresh() {
    // just change src attribute, will always trigger the onload callback
    img.src = imageURI + '?d=' + Date.now();
}

function addFilename() {
  var x = document.getElementById("fileSelect");
  var option = document.createElement("option");
  option.text = "Kiwi";
  x.add(option, x[0]);
}

img.src=imageURI;
addFilename();
