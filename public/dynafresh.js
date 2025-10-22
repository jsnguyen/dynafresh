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

function saveFigure() {
    const canvas = document.getElementById("canvas");
    const filepathInput = document.getElementById("filepathInput");
    
    // Get current filename or use default
    const currentPath = filepathInput.value;
    const filename = currentPath ? `${currentPath.split('/').pop()}` : `dynafresh.png`;
    
    // Create download link
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    });
}

setInterval(updateTimeAgoDisplay, 1000); // update every second

function showRecentPathsModal() {
  const recent = getRecentPaths();

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

function clearRecentPaths() {
    localStorage.removeItem('recentPaths');
    updateRecentPathsDropdown();
    hideRecentPathsModal();
}

function hideRecentPathsModal() {
  const overlay = document.getElementById('recent-paths-modal-overlay');
  overlay.classList.add('hidden');
}

function main() {
  window.onload = () => {
    const socket = new WebSocket("ws://localhost:" + String(port+1));

    const canvas = document.getElementById("canvas");

    const panzoomInstance = Panzoom(canvas, {
      maxScale: 10,
      minScale: 0.5,
      bounds: true,
      boundsPadding: 0.1
    });
    canvas.parentElement.addEventListener('wheel', panzoomInstance.zoomWithWheel);

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
    const recentPaths = getRecentPaths();

    socket.addEventListener("open", function () {
      var filepathInput = document.getElementById("filepathInput");
      
      if (recentPaths.length > 0) {
        const lastPath = recentPaths[0];
        filepathInput.value = lastPath;
        filepathButton.click();
      }
    });

    function parseFilepathData(data) {
      const filepath = data.split(":")[1];
      img.src = filepath;
      img.src = img.src.split("?")[0] + "?d=" + Date.now();
      return filepath;
    }

    socket.addEventListener("message", function (event) {

      var filepathInput = document.getElementById("filepathInput");
      filepathInput.style.border = "2px solid rgba(65, 172, 65, 1)";

      console.log("Message from server ", event.data);

      // initial filepath effectively overrides any recent paths
      if (event.data.startsWith("initialFilepath:")) {
        filepath = parseFilepathData(event.data);
        updateTimeDisplay();
        filepathInput.value = filepath;
        filepathButton.click();
      } else if (event.data.startsWith("filepath:")) {
        filepath = parseFilepathData(event.data);
        updateTimeDisplay();
      }

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

    var clearRecentPathsButton = document.getElementById("clearRecentPathsButton");
    clearRecentPathsButton.onclick = clearRecentPaths;

    var overlay = document.getElementById('recent-paths-modal-overlay');
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        hideRecentPathsModal();
      }
    };

    var saveFigureButton = document.getElementById("saveFigureButton");
    saveFigureButton.onclick = saveFigure;

    var resetViewButton = document.getElementById("resetViewButton");
    resetViewButton.onclick = function() {
      panzoomInstance.reset();
    };

  }
}

main();
