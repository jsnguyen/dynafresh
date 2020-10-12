function timedRefresh(img) {
    // just change src attribute, will always trigger the onload callback
    img.src = img.src.split('?')[0] + '?d=' + Date.now()
}

function addFilename(arr) {
  var fs = document.getElementById('fileSelect')
  arr.forEach( element => {
    var option = document.createElement('option')
    option.text = element 
    fs.add(option)
  })
  fs.selectedIndex = '0'
}

function getJSON(img,url,updateCallback){
  var xmlhttp = new XMLHttpRequest()
  xmlhttp.open('GET', url , true)
  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == 4) {
      if(xmlhttp.status == 200) {
        var json_obj = JSON.parse(xmlhttp.responseText)
        console.log(json_obj)
        updateCallback(img,json_obj)
      }
    }
  }
  xmlhttp.timeout=5000
  xmlhttp.send(null)
}

function setOnChange(img) {
  var fs = document.getElementById('fileSelect')
  fs.onchange = () => {
    img.src = 'images/'+fs.options[fs.selectedIndex].text
  }
}

function setDefaultPlot(img){
  var fs = document.getElementById('fileSelect')
  img.src = 'images/'+fs.options[0].text
}

function loadAll(img,json_obj){
  addFilename(json_obj)
  setDefaultPlot(img)
}

function main(){

  var timeoutPeriod = 500
  var x=0, y=0
  var img = new Image()

  img.onload = function() {
      var canvas = document.getElementById('canvas')
      var context = canvas.getContext('2d')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      context.drawImage(img, (canvas.width-img.width)/2, (canvas.height-img.height)/2)
      setTimeout(() => timedRefresh(img),timeoutPeriod)
  }

  setOnChange(img)
  getJSON(img,'response.json', loadAll)

}

main()
