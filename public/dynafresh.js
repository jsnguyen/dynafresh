class Plot {
  constructor(plotId, socket, filepath = null) {
    this.plotId = plotId;
    this.socket = socket;
    this.filepath = filepath;
    this.lastUpdateTime = null;

    // Create DOM elements first
    this.createPlotHTML();

    // Now get references to DOM elements
    this.container = document.getElementById(`plot-${this.plotId}`);
    this.canvas = this.container.querySelector('.plot-canvas');
    this.filepathInput = this.container.querySelector('.plot-filepath-input');
    this.updateTimeElement = this.container.querySelector('.plot-update-time');
    this.updateTimeAgoElement = this.container.querySelector('.plot-update-time-ago');
    
    this.img = new Image();

    // Setup event handlers
    this.setupEventHandlers();

    // Setup image load handler
    this.img.onload = () => {
      this.drawImage(true);
    };

    // Setup panzoom
    this.panzoomInstance = Panzoom(this.canvas, {
      maxScale: 10,
      minScale: 0.5,
      bounds: true,
      boundsPadding: 0.1
    });

    // Only enable wheel zoom when canvas is focused (clicked)
    let isCanvasFocused = false;
    
    this.canvas.addEventListener('click', (e) => {
      isCanvasFocused = true;
      this.container.classList.add('canvas-focused');
      e.stopPropagation();
    });
    
    // Deactivate when clicking outside the canvas
    document.addEventListener('click', (e) => {
      if (!this.canvas.contains(e.target)) {
        isCanvasFocused = false;
        this.container.classList.remove('canvas-focused');
        // Reset the view when clicking away
        this.panzoomInstance.reset();
      }
    });
    
    this.canvas.parentElement.addEventListener('wheel', (e) => {
      if (isCanvasFocused) {
        this.panzoomInstance.zoomWithWheel(e);
      }
    });

    this.startUpdateTimeInterval();
  }

  createPlotHTML() {
    const plotsContainer = document.getElementById('plots-container');
    const plotHTML = `
      <div class="container" id="plot-${this.plotId}">
        <div class="plot-header">
          <input type="text" class="plot-filepath-input" placeholder="Enter filepath..." list="recentPaths" />
          <button class="recent-button" title="Show recent paths">↓</button>
          <button class="close-button"></button>
        </div>

        <div class="plot-canvas-container">
          <canvas class="plot-canvas"></canvas>
        </div>

        <div class="metadata-container">
          <button class="plot-reset-button">Reset View</button>
          <button class="plot-save-button">Save Figure</button>
          <div class="update-container">
            <div class="plot-update-time"></div>
            <div class="plot-update-time-ago"></div>
          </div>
        </div>
      </div>
    `;
    plotsContainer.insertAdjacentHTML('beforeend', plotHTML);
  }

  setupEventHandlers() {
    const closeButton = this.container.querySelector('.close-button');
    const recentButton = this.container.querySelector('.recent-button');
    const saveButton = this.container.querySelector('.plot-save-button');
    const resetButton = this.container.querySelector('.plot-reset-button');
    
    closeButton.onclick = () => this.remove();
    recentButton.onclick = () => this.showRecentPathsModal();
    saveButton.onclick = () => this.save();
    resetButton.onclick = () => this.reset();
    
    // Auto-watch when input changes
    this.filepathInput.addEventListener('change', () => this.watchFile());
    
    // Allow Enter key to watch file
    this.filepathInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.watchFile();
      }
    });
  }

  showRecentPathsModal() {
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
        this.filepathInput.value = path;
        this.watchFile();
        hideRecentPathsModal();
      };
      
      list.appendChild(item);
    });
    
    // Show the modal with fade-in animation
    overlay.classList.remove('hidden');
  }

  watchFile() {
    const value = this.filepathInput.value.trim();
    if (value) {
      addRecentPath(value);
      this.socket.send(JSON.stringify({ 
        filepath: value,
        plotId: this.plotId 
      }));
      // Save session after setting up the watch
      if (plotManager && !plotManager.isRestoring) {
        plotManager.saveSession();
      }
    }
  }

  drawImage(fade = false) {
    const context = this.canvas.getContext("2d");
    
    if (fade) this.canvas.parentElement.classList.add('fade-out');
    
    setTimeout(() => {
      this.canvas.width = this.img.naturalWidth;
      this.canvas.height = this.img.naturalHeight;
      
      context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      context.drawImage(this.img, 0, 0);
      
      if (fade) this.canvas.parentElement.classList.remove('fade-out');
    }, 150);
  }

  loadImage(filepath) {
    this.filepath = filepath;
    this.img.src = filepath + "?d=" + Date.now();
    this.lastUpdateTime = new Date();
    
    // Add green glow effect
    this.container.classList.remove('plot-updated');
    // Force reflow to restart animation
    void this.container.offsetWidth;
    this.container.classList.add('plot-updated');
  }

  updateTimeDisplay() {
    if (!this.updateTimeElement || !this.updateTimeAgoElement) return;
    
    if (this.lastUpdateTime) {
      this.updateTimeElement.innerHTML = `Last update: ${this.lastUpdateTime.toLocaleTimeString()}`;
      this.updateTimeAgoElement.innerHTML = timeAgo(this.lastUpdateTime);
    }
  }

  startUpdateTimeInterval() {
    setInterval(() => this.updateTimeDisplay(), 1000);
  }

  reset() {
    this.panzoomInstance.reset();
    // Add pulse effect
    const resetButton = this.container.querySelector('.plot-reset-button');
    resetButton.classList.remove('button-pulse');
    void resetButton.offsetWidth;
    resetButton.classList.add('button-pulse');
  }

  save() {
    const filename = this.filepath ? this.filepath.split('/').pop() : 'dynafresh.png';
    this.canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    });
    // Add pulse effect
    const saveButton = this.container.querySelector('.plot-save-button');
    saveButton.classList.remove('button-pulse');
    void saveButton.offsetWidth;
    saveButton.classList.add('button-pulse');
  }

  getLastUpdateTime() {
    return this.lastUpdateTime;
  }

  remove() {
    // Notify server to stop watching this file
    if (this.filepath) {
      this.socket.send(JSON.stringify({ 
        action: 'unwatch',
        filepath: this.filepath,
        plotId: this.plotId 
      }));
    }
    
    // Remove from DOM
    this.container.remove();
    
    // Notify PlotManager
    plotManager.removePlot(this.plotId);
  }
}

class PlotManager {
  constructor(socket) {
    this.socket = socket;
    this.plots = new Map();
    this.nextPlotId = 1;
    this.isRestoring = false; // Flag to prevent saving during restoration
  }

  createPlot(filepath = null) {
    const plotId = this.nextPlotId++;
    const plot = new Plot(plotId, this.socket);
    this.plots.set(plotId, plot);

    if (filepath) {
      plot.loadImage(filepath);
    }

    // Only save session if we're not in the middle of restoring
    if (!this.isRestoring) {
      this.saveSession();
    }
    return plot;
  }

  getPlot(plotId) {
    return this.plots.get(plotId);
  }

  removePlot(plotId) {
    this.plots.delete(plotId);
    this.saveSession();
  }

  // Find a plot watching a specific filepath
  findPlotByFilepath(filepath) {
    for (const [plotId, plot] of this.plots.entries()) {
      if (plot.filepath === filepath) {
        return plot;
      }
    }
    return null;
  }

  // Watch a filepath - create new plot if not already watching, otherwise scroll to existing
  watchFilepath(filepath) {
    if (!filepath || !filepath.trim()) return;
    
    filepath = filepath.trim();
    
    // Check if already watching this file
    const existingPlot = this.findPlotByFilepath(filepath);
    if (existingPlot) {
      // Scroll to the existing plot
      existingPlot.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash the plot to indicate it's already being watched
      existingPlot.container.style.transition = 'box-shadow 0.3s';
      existingPlot.container.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
      setTimeout(() => {
        existingPlot.container.style.boxShadow = '';
      }, 600);
      return existingPlot;
    }
    
    // Create new plot and watch the file
    const plot = this.createPlot();
    plot.filepathInput.value = filepath;
    plot.watchFile();
    
    // Scroll to the new plot
    setTimeout(() => {
      plot.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    return plot;
  }

  // Save current session to localStorage
  saveSession() {
    const session = {
      plots: Array.from(this.plots.values())
        .map(plot => ({
          filepath: plot.filepathInput ? plot.filepathInput.value : ''
        }))
        .filter(p => p.filepath) // Only save plots with filepaths
    };
    console.log('Saving session:', session);
    localStorage.setItem('dynafreshSession', JSON.stringify(session));
  }

  // Restore session from localStorage
  restoreSession() {
    const stored = localStorage.getItem('dynafreshSession');
    console.log('Restoring session from storage:', stored);
    if (!stored) return false;
    
    try {
      const session = JSON.parse(stored);
      
      // Restore each plot
      if (session.plots && session.plots.length > 0) {
        console.log('Restoring', session.plots.length, 'plots');
        
        // Set flag to prevent auto-saving during restoration
        this.isRestoring = true;
        
        session.plots.forEach(plotData => {
          if (plotData.filepath) {
            console.log('Creating plot for:', plotData.filepath);
            const plot = this.createPlot();
            plot.filepathInput.value = plotData.filepath;
            plot.watchFile();
          }
        });
        
        // Restoration complete, re-enable auto-saving
        this.isRestoring = false;
        
        return true;
      }
    } catch (e) {
      console.error('Error restoring session:', e);
      this.isRestoring = false;
    }
    
    return false;
  }

  handleMessage(data) {
    // Parse message from server
    let plotId, filepath;

    if (data.startsWith("initialFilepath:") || data.startsWith("filepath:")) {
      const parts = data.split(":");
      filepath = parts[1];
      plotId = parseInt(parts[2]) || this.getFirstPlotId();
    }

    const plot = this.getPlot(plotId);
    if (plot) {
      plot.loadImage(filepath);
    }
  }

  getFirstPlotId() {
    return this.plots.keys().next().value;
  }
}

function timeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec <= 1) return `(${diffSec} sec ago)`;
  if (diffSec < 60) return `(${diffSec} secs ago)`;

  const diffMin = Math.round(diffSec / 60);
  if (diffMin <= 1) return `(${diffMin} min ago)`;
  if (diffMin < 60) return `(${diffMin} mins ago)`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr <= 1) return `(${diffHr} hr ago)`;
  if (diffHr < 24) return `(${diffHr} hrs ago)`;
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


function clearRecentPaths() {
    localStorage.removeItem('recentPaths');
    updateRecentPathsDropdown();
    hideRecentPathsModal();
}

function hideRecentPathsModal() {
  const overlay = document.getElementById('recent-paths-modal-overlay');
  overlay.classList.add('hidden');
}

function showMainRecentPathsModal() {
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
      const mainInput = document.getElementById('mainFilepathInput');
      mainInput.value = path;
      plotManager.watchFilepath(path);
      addRecentPath(path);
      hideRecentPathsModal();
    };
    
    list.appendChild(item);
  });
  
  // Show the modal with fade-in animation
  overlay.classList.remove('hidden');
}

// parameters
const port = 12301;
let plotManager;

function main() {
  window.onload = () => {
    const socket = new WebSocket("ws://localhost:" + String(port+1));

    plotManager = new PlotManager(socket);

    updateRecentPathsDropdown();
    const recentPaths = getRecentPaths();

    // Main filepath input handlers
    const mainFilepathInput = document.getElementById('mainFilepathInput');
    const mainWatchButton = document.getElementById('mainWatchButton');
    const mainRecentButton = document.getElementById('mainRecentButton');

    mainWatchButton.onclick = () => {
      const filepath = mainFilepathInput.value.trim();
      if (filepath) {
        addRecentPath(filepath);
        plotManager.watchFilepath(filepath);
      }
    };

    mainRecentButton.onclick = () => {
      showMainRecentPathsModal();
    };

    // Allow Enter key to watch file
    mainFilepathInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        mainWatchButton.click();
      }
    });

    socket.addEventListener("open", function () {
      // Try to restore previous session first
      const sessionRestored = plotManager.restoreSession();
      
      // If no session was restored and there's a recent path, pre-fill the main input
      if (!sessionRestored && recentPaths.length > 0) {
        mainFilepathInput.value = recentPaths[0];
      }
    });

    socket.addEventListener("message", function (event) {
      console.log("Message from server", event.data);
      plotManager.handleMessage(event.data);
    });

    const addPlotButton = document.getElementById("addPlotButton");
    if (addPlotButton) {
      addPlotButton.onclick = () => plotManager.createPlot();
    }

    // Recent paths modal handlers
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

  }
}

main();
