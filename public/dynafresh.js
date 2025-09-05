function timeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) {
    return `(${diffSec} secs ago)`;
  }
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return `(${diffMin} mins ago)`;
  }
  const diffHr = Math.round(diffMin / 60);
  return `(${diffHr} hrs ago)`;
}

function timedRefresh(img) {
  // just change src attribute, will always trigger the onload callback
  img.src = img.src.split("?")[0] + "?d=" + Date.now();
}

// parameters
const port = 12301;

function setCanvasSize() {
  var canvas = document.getElementById("canvas");
  var container = canvas.parentElement;
  var style = window.getComputedStyle(container);
  var width = parseInt(style.getPropertyValue('width'));
  var height = parseInt(style.getPropertyValue('height'));
  if (!width || !height) {
    width = 600;
    height = 400;
  }
  canvas.width = width;
  canvas.height = height;
}


function drawImageActualSize(img) {
  var canvas = document.getElementById("canvas");
  var context = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  context.clearRect(0, 0, img.width, img.height);
  context.drawImage(img, 0, 0);
}

let lastUpdateTime = null;

function updateTimeAgoDisplay() {
  const updateTimeAgoDiv = document.getElementById("updateTimeAgo");
  if (lastUpdateTime) {
    updateTimeAgoDiv.innerHTML = `${timeAgo(lastUpdateTime)}`;
  }
}

function updateTimeDisplay() {
  var updateTime = document.getElementById("updateTime");
  const d = new Date();
  lastUpdateTime = d;
  updateTime.innerHTML = `Last update: ${d.toLocaleTimeString()}`;
  updateTimeAgoDisplay();
}

setInterval(updateTimeAgoDisplay, 1000); // update every second

function main() {
  window.onload = () => {
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    var img = new Image();
    img.onload = function () {
      drawImageActualSize(img);
    };

    const socket = new WebSocket("ws://localhost:" + String(port+1));

    socket.addEventListener("message", function (event) {
      console.log("Message from server ", event.data);
      // If server sends a file path, load it as image
      if (event.data.startsWith("filepath:")) {
        const filepath = event.data.replace("filepath:", "");
        img.src = filepath;
        img.src = img.src.split("?")[0] + "?d=" + Date.now();

        updateTimeDisplay();

      }

      var plotContainer = document.getElementById("plotContainer");
      plotContainer.style.border = "2px solid rgba(85, 183, 85, 1)";

    });

    // Add event for filepath input
    var filepathBtn = document.getElementById("filepathBtn");
    var filepathInput = document.getElementById("filepathInput");
    filepathBtn.onclick = function () {
      const value = filepathInput.value.trim();
      if (value) {
        // Send filepath to server via WebSocket
        socket.send(JSON.stringify({ filepath: value }));
      }

      const filePathDisplayDiv = document.getElementById("filePathDisplay");
      filePathDisplayDiv.innerHTML = `Watching: ${value}`;

    };

  }
}

main();
