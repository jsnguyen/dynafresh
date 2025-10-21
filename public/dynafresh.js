function timeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec <= 1) {
    return `(${diffSec} sec ago)`;
  }
  if (diffSec < 60) {
    return `(${diffSec} secs ago)`;
  }

  const diffMin = Math.round(diffSec / 60);

  if (diffMin <= 1) {
    return `(${diffMin} min ago)`;
  }

  if (diffMin < 60) {
    return `(${diffMin} mins ago)`;
  }

  const diffHr = Math.round(diffMin / 60);

  if (diffHr <= 1) {
    return `(${diffHr} hr ago)`;
  }

  if (diffHr < 24) {
    return `(${diffHr} hrs ago)`;
  }

}

function getRecentPaths() {
    const stored = localStorage.getItem('recentPaths');
    return stored ? JSON.parse(stored) : [];
}

function addRecentPath(filepath, maxpaths=10) {
    let recent = getRecentPaths();
    // Remove if already exists
    recent = recent.filter(p => p !== filepath);
    // Add to front
    recent.unshift(filepath);
    // Keep only last 10
    recent = recent.slice(0, maxpaths);
    localStorage.setItem('recentPaths', JSON.stringify(recent));
    updateRecentPathsDropdown();
}

function updateRecentPathsDropdown() {
    const datalist = document.getElementById('recentPaths');
    const recent = getRecentPaths();
    datalist.innerHTML = recent.map(path => 
        `<option value="${path}">${path}</option>`
    ).join('');
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


function drawImage(img, fade=false) {
  var canvas = document.getElementById("canvas");
  var context = canvas.getContext("2d");

  if (fade) canvas.parentElement.classList.add('fade-out');
  
  setTimeout(() => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0);
    
    if (fade) canvas.parentElement.classList.remove('fade-out');
  }, 150);

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

function showRecentPathsModal() {
  const recent = getRecentPaths();
  if (recent.length === 0) {
    alert("No recent paths");
    return;
  }

  const overlay = document.getElementById('recent-paths-modal-overlay');
  const list = document.getElementById('recentPathsList');
  
  // Clear and populate the list
  list.innerHTML = '';
  
  recent.forEach(path => {
    const item = document.createElement('div');
    item.className = 'recent-path-item';
    item.textContent = path;
    
    item.onclick = () => {
      const filepathInput = document.getElementById("filepathInput");
      filepathInput.value = path;
      filepathButton.click();
      hideRecentPathsModal();
    };
    
    list.appendChild(item);
  });
  
  // Show the modal with fade-in animation
  overlay.classList.remove('hidden');
}

function hideRecentPathsModal() {
  const overlay = document.getElementById('recent-paths-modal-overlay');
  overlay.classList.add('hidden');
}

function main() {
  window.onload = () => {
    const socket = new WebSocket("ws://localhost:" + String(port+1));

    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    var img = new Image();
    img.onload = function () {
      drawImage(img, fade=true);
    };

    // on resize, redraw current image
    window.addEventListener('resize', function () {
      drawImage(img, fade=false);
    });

    updateRecentPathsDropdown();

    socket.addEventListener("open", function () {
      const recentPaths = getRecentPaths();
      var filepathInput = document.getElementById("filepathInput");
      
      if (recentPaths.length > 0) {
        const lastPath = recentPaths[0];
        filepathInput.value = lastPath;

        filepathButton.click();
      }
    });

    socket.addEventListener("message", function (event) {
      console.log("Message from server ", event.data);
      // If server sends a file path, load it as image
      if (event.data.startsWith("filepath:")) {
        const filepath = event.data.replace("filepath:", "");
        img.src = filepath;
        img.src = img.src.split("?")[0] + "?d=" + Date.now();

        updateTimeDisplay();

      }

      var filepathInput = document.getElementById("filepathInput");
      filepathInput.style.border = "2px solid rgba(65, 172, 65, 1)";

    });

    // Add event for filepath input
    var filepathButton = document.getElementById("filepathButton");
    var filepathInput = document.getElementById("filepathInput");
    filepathButton.onclick = function () {
      const value = filepathInput.value.trim();
      if (value) {
        // Send filepath to server via WebSocket
        addRecentPath(value);
        socket.send(JSON.stringify({ filepath: value }));
      }

    };

    var showRecentButton = document.getElementById("recentButton");
    showRecentButton.onclick = showRecentPathsModal;

    var closeRecentModal = document.getElementById("closeRecentModal");
    closeRecentModal.onclick = hideRecentPathsModal;

    var overlay = document.getElementById('recent-paths-modal-overlay');
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        hideRecentPathsModal();
      }
    };

  }
}

main();
