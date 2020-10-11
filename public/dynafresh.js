var timeoutPeriod = 500;
var imageURI = 'images/plot.png';
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

function addFilename(arr) {
  var fs = document.getElementById("fileSelect");
  arr.forEach( element => {
    var option = document.createElement("option");
    option.text = element; 
    fs.add(option, fs[0]);
  });
}

function getJSON(url,updateCallback){
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open('GET', url , true);
  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == 4) {
      if(xmlhttp.status == 200) {
        var json_obj = JSON.parse(xmlhttp.responseText);
        console.log(json_obj);
        updateCallback(json_obj);
      }
    }
  };
  xmlhttp.timeout=5000;
  xmlhttp.send(null);
}

getJSON("response.json", addFilename);
img.src=imageURI;
