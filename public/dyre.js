const SOCKET_PORT = 12301;
const UPDATE_INTERVAL_MS = 1000;
const MAX_RECENT_PATHS = 10;
const SESSION_STORAGE_KEY = 'dyreSession';
const RECENT_PATHS_KEY = 'recentPaths';

dayjs.extend(dayjs_plugin_relativeTime);

const highlight = (element, className) => {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
};

const filenameFromPath = (filepath) => {
  if (!filepath) return '';
  const separatorIndex = Math.max(filepath.lastIndexOf('/'), filepath.lastIndexOf('\\'));
  return separatorIndex === -1 ? filepath : filepath.slice(separatorIndex + 1);
};

const safeParse = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const timeAgo = (date) => (date ? `(${dayjs(date).fromNow()})` : '');

const getRecentPaths = () => safeParse(localStorage.getItem(RECENT_PATHS_KEY), []);

const setRecentPaths = (paths) => {
  localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(paths.slice(0, MAX_RECENT_PATHS)));
};

const addRecentPath = (filepath) => {
  if (!filepath) return;
  const recent = getRecentPaths().filter((entry) => entry !== filepath);
  recent.unshift(filepath);
  setRecentPaths(recent);
};

const clearRecentPaths = () => {
  localStorage.removeItem(RECENT_PATHS_KEY);
  hideMainRecentPathsDropdown();
};

const hideMainRecentPathsDropdown = () => {
  const dropdown = document.getElementById('main-recent-dropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
};

const showMainRecentPathsDropdown = () => {
  const dropdown = document.getElementById('main-recent-dropdown');
  if (!dropdown) return;

  const recent = getRecentPaths();
  if (!recent.length) {
    dropdown.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = '';

  recent.forEach((path) => {
    const item = document.createElement('div');
    item.className = 'recent-path-item';
    item.textContent = path;
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      const existingPlot = plotManager?.findPlotByFilepath(path);
      if (existingPlot) {
        existingPlot.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlight(existingPlot.container, 'plot-duplicate');
        hideMainRecentPathsDropdown();
        return;
      }

      const mainInput = document.getElementById('main-filepath-input');
      if (mainInput) {
        mainInput.value = path;
      }
      hideMainRecentPathsDropdown();
    });
    dropdown.appendChild(item);
  });

  dropdown.classList.remove('hidden');
};

class Plot {
  constructor(plotId, socket, manager, filepath = null) {
    this.plotId = plotId;
    this.socket = socket;
    this.manager = manager;
    this.fullFilepath = '';
    this.filepath = null;
    this.lastUpdateTime = null;
    this.processingBlur = false;
    this.isCanvasFocused = false;
    this.updateInterval = null;

    this.handleFilepathFocus = this.onFilepathFocus.bind(this);
    this.handleFilepathBlur = this.onFilepathBlur.bind(this);
    this.handleFilepathKeypress = this.onFilepathKeypress.bind(this);
    this.handleFilepathClick = this.showRecentPathsDropdown.bind(this);
    this.handleDocumentClick = this.onDocumentClick.bind(this);
    this.handleCanvasClick = this.onCanvasClick.bind(this);
    this.handleCanvasWheel = this.onCanvasWheel.bind(this);

    this.buildTemplate();
    this.cacheElements();
    this.configureImage();
    this.configurePanzoom();
    this.bindEvents();
    this.startUpdateTicker();

    if (filepath) {
      this.watchFile(filepath, { recordHistory: false });
    }
  }

  buildTemplate() {
    const plotsContainer = document.getElementById('plots-container');
    const template = `
      <div class="container" id="plot-${this.plotId}">
        <div class="plot-header">
          <div class="filepath-input-wrapper">
            <input type="text" class="plot-filepath-input" placeholder="Enter filepath..." />
            <div class="recent-paths-dropdown hidden"></div>
          </div>
          <div class="plot-header-buttons">
            <button class="close-button"></button>
          </div>
        </div>

        <div class="plot-canvas-container">
          <div class="plot-error-message">File does not exist!</div>
          <canvas class="plot-canvas"></canvas>
        </div>

        <div class="metadata-container">
          <button class="plot-reset-button" title="Reset View"><i class="fas fa-arrows-to-dot"></i></button>
          <div class="update-container">
            <span class="plot-update-time"></span>
            <span class="plot-update-time-ago"></span>
          </div>
          <button class="plot-save-button" title="Save Figure"><i class="fas fa-floppy-disk"></i></button>
        </div>
      </div>
    `;
    plotsContainer.insertAdjacentHTML('beforeend', template);
    this.container = plotsContainer.lastElementChild;
  }

  cacheElements() {
    this.canvas = this.container.querySelector('.plot-canvas');
    this.canvasContainer = this.container.querySelector('.plot-canvas-container');
    this.filepathInput = this.container.querySelector('.plot-filepath-input');
    this.dropdown = this.container.querySelector('.recent-paths-dropdown');
    this.updateTimeElement = this.container.querySelector('.plot-update-time');
    this.updateTimeAgoElement = this.container.querySelector('.plot-update-time-ago');
    this.closeButton = this.container.querySelector('.close-button');
    this.saveButton = this.container.querySelector('.plot-save-button');
    this.resetButton = this.container.querySelector('.plot-reset-button');
  }

  configureImage() {
    this.img = new Image();
    this.img.onload = () => this.drawImage(true);
  }

  configurePanzoom() {
    this.panzoom = Panzoom(this.canvas, {
      maxScale: 10,
      minScale: 0.5,
      bounds: true,
      boundsPadding: 0.1
    });
  }

  bindEvents() {
    this.closeButton.addEventListener('click', () => this.remove());
    this.saveButton.addEventListener('click', () => this.save());
    this.resetButton.addEventListener('click', () => this.reset());

    this.filepathInput.addEventListener('focus', this.handleFilepathFocus);
    this.filepathInput.addEventListener('blur', this.handleFilepathBlur);
    this.filepathInput.addEventListener('keypress', this.handleFilepathKeypress);
    this.filepathInput.addEventListener('click', this.handleFilepathClick);

    this.canvas.addEventListener('click', this.handleCanvasClick);
    this.canvasContainer.addEventListener('wheel', this.handleCanvasWheel, { passive: false });
    document.addEventListener('click', this.handleDocumentClick);
  }

  detachEvents() {
    this.filepathInput.removeEventListener('focus', this.handleFilepathFocus);
    this.filepathInput.removeEventListener('blur', this.handleFilepathBlur);
    this.filepathInput.removeEventListener('keypress', this.handleFilepathKeypress);
    this.filepathInput.removeEventListener('click', this.handleFilepathClick);
    this.canvas.removeEventListener('click', this.handleCanvasClick);
    this.canvasContainer.removeEventListener('wheel', this.handleCanvasWheel);
    document.removeEventListener('click', this.handleDocumentClick);
  }

  startUpdateTicker() {
    this.updateInterval = window.setInterval(() => this.updateTimeDisplay(), UPDATE_INTERVAL_MS);
  }

  stopUpdateTicker() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  onFilepathFocus() {
    if (this.fullFilepath) {
      this.filepathInput.value = this.fullFilepath;
      this.filepathInput.select();
    }
    this.showRecentPathsDropdown();
  }

  onFilepathBlur() {
    if (this.processingBlur) return;
    this.processingBlur = true;

    const value = this.filepathInput.value.trim();
    if (!value) {
      this.processingBlur = false;
      return;
    }

    this.watchFile(value);
    this.processingBlur = false;
  }

  onFilepathKeypress(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.filepathInput.blur();
    }
  }

  onDocumentClick(event) {
    if (!this.container.contains(event.target)) {
      this.hideRecentPathsDropdown();
      if (this.isCanvasFocused) {
        this.isCanvasFocused = false;
        this.container.classList.remove('canvas-focused');
        this.panzoom.reset();
      }
    }
  }

  onCanvasClick(event) {
    document.querySelectorAll('.container.canvas-focused').forEach((container) => {
      if (container !== this.container) {
        container.classList.remove('canvas-focused');
      }
    });

    this.isCanvasFocused = true;
    this.container.classList.add('canvas-focused');
    event.stopPropagation();
  }

  onCanvasWheel(event) {
    if (this.isCanvasFocused) {
      this.panzoom.zoomWithWheel(event);
    }
  }

  showRecentPathsDropdown() {
    const recent = getRecentPaths();
    if (!recent.length) {
      this.dropdown.classList.add('hidden');
      return;
    }

    this.dropdown.innerHTML = '';

    recent.forEach((path) => {
      const item = document.createElement('div');
      item.className = 'recent-path-item';
      item.textContent = path;
      item.addEventListener('click', (event) => {
        event.stopPropagation();

        const existingPlot = this.manager.findPlotByFilepath(path);
        if (existingPlot) {
          existingPlot.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlight(existingPlot.container, 'plot-duplicate');
        } else {
          this.watchFile(path);
        }

        this.hideRecentPathsDropdown();
      });
      this.dropdown.appendChild(item);
    });

    this.dropdown.classList.remove('hidden');
  }

  hideRecentPathsDropdown() {
    this.dropdown.classList.add('hidden');
  }

  watchFile(filepath, { recordHistory = true, saveSession = true, force = false } = {}) {
    const target = (typeof filepath === 'string' ? filepath : this.filepathInput.value).trim();
    if (!target) return;

    const previous = this.fullFilepath;
    const pathChanged = previous !== target;

    if (!pathChanged && !force) {
      this.filepathInput.value = filenameFromPath(target);
      return;
    }

    if (pathChanged && recordHistory && previous && !this.manager.isRestoring) {
      this.manager.addToHistory({
        type: 'changeFilepath',
        plotId: this.plotId,
        oldFilepath: previous,
        newFilepath: target
      });
    }

    if (pathChanged) {
      this.fullFilepath = target;
    }

    this.socket.emit('watchFilepath', {
      filepath: target,
      plotId: this.plotId
    });

    this.filepathInput.value = filenameFromPath(target);

    if (saveSession && !this.manager.isRestoring) {
      this.manager.saveSession();
    }
  }

  loadImage(filepath) {
    if (!filepath) {
      highlight(this.container, 'plot-error');
      this.canvasContainer.classList.add('has-error');
      return;
    }

    this.canvasContainer.classList.remove('has-error');
    if (this.fullFilepath) {
      addRecentPath(this.fullFilepath);
    }

    this.filepath = filepath;
    this.img.src = `${filepath}?d=${Date.now()}`;
    this.lastUpdateTime = new Date();
    highlight(this.container, 'plot-updated');
  }

  drawImage(applyFade = false) {
    if (!this.canvas) return;
    const context = this.canvas.getContext('2d');

    if (applyFade) {
      this.canvasContainer.classList.add('fade-out');
    }

    requestAnimationFrame(() => {
      this.canvas.width = this.img.naturalWidth;
      this.canvas.height = this.img.naturalHeight;
      context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      context.drawImage(this.img, 0, 0);

      if (applyFade) {
        this.canvasContainer.classList.remove('fade-out');
      }

      const aspectRatio = this.img.naturalWidth / this.img.naturalHeight;
      if (aspectRatio > 2.5) {
        this.container.classList.add('full-width');
      } else {
        this.container.classList.remove('full-width');
      }
    });
  }

  updateTimeDisplay() {
    if (!this.lastUpdateTime) return;
    if (this.updateTimeElement) {
      this.updateTimeElement.textContent = `Last update: ${this.lastUpdateTime.toLocaleTimeString()}`;
    }
    if (this.updateTimeAgoElement) {
      this.updateTimeAgoElement.textContent = timeAgo(this.lastUpdateTime);
    }
  }

  reset() {
    this.panzoom.reset();
    highlight(this.resetButton, 'button-pulse');
  }

  save() {
    const filename = filenameFromPath(this.filepath) || 'dyre.png';
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    });
    highlight(this.saveButton, 'button-pulse');
  }

  remove({ recordHistory = true } = {}) {
    if (this.fullFilepath) {
      this.socket.emit('unwatch', {
        filepath: this.fullFilepath,
        plotId: this.plotId
      });
    }

    this.detachEvents();
    this.stopUpdateTicker();
    this.container.remove();
    this.manager.removePlot(this.plotId, { recordHistory });
  }
}

class PlotManager {
  constructor(socket) {
    this.socket = socket;
    this.plots = new Map();
    this.nextPlotId = 1;
    this.isRestoring = false;
    this.undoStack = [];
    this.redoStack = [];
    this.validationCallbacks = {};

    this.initializeSortable();
    this.registerSocketEvents();
  }

  initializeSortable() {
    const plotsContainer = document.getElementById('plots-container');
    this.sortable = Sortable.create(plotsContainer, {
      animation: 150,
      handle: '.container:not(.main-header)',
      filter: '.main-header, input, button',
      draggable: '.container:not(.main-header)',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      swapThreshold: 0.65,
      preventOnFilter: false,
      onStart: () => {
        plotsContainer.style.gridAutoFlow = 'row';
      },
      onEnd: () => {
        plotsContainer.style.gridAutoFlow = 'dense';
        if (!this.isRestoring) {
          this.saveSession();
        }
      }
    });
  }

  createPlot(filepath = null, { plotId = null, trackHistory = true } = {}) {
    const id = plotId ?? this.nextPlotId++;
    if (plotId !== null) {
      this.nextPlotId = Math.max(this.nextPlotId, id + 1);
    }

    const plot = new Plot(id, this.socket, this);
    this.plots.set(id, plot);

    if (filepath) {
      plot.watchFile(filepath, { recordHistory: false, saveSession: false });
    }

    if (trackHistory && !this.isRestoring) {
      this.addToHistory({ type: 'create', plotId: id, filepath });
    }

    if (!this.isRestoring) {
      this.saveSession();
    }

    return plot;
  }

  removePlot(plotId, { recordHistory = true } = {}) {
    const plot = this.plots.get(plotId);
    if (!plot) return;

    if (recordHistory && !this.isRestoring) {
      this.addToHistory({
        type: 'remove',
        plotId,
        filepath: plot.fullFilepath
      });
    }

    this.plots.delete(plotId);

    if (!this.isRestoring) {
      this.saveSession();
      this.updateUndoRedoButtons();
    }
  }

  clearAllPlots() {
    if (!this.plots.size) return;

    const snapshot = Array.from(this.plots.entries()).map(([plotId, plot]) => ({
      plotId,
      filepath: plot.fullFilepath
    }));

    this.addToHistory({ type: 'clearAll', plots: snapshot });

    const plotsToRemove = Array.from(this.plots.values());
    this.isRestoring = true;
    plotsToRemove.forEach((plot) => plot.remove({ recordHistory: false }));
    this.isRestoring = false;

    this.saveSession();
    this.updateUndoRedoButtons();
  }

  addToHistory(action) {
    this.undoStack.push(action);
    this.redoStack = [];
    this.updateUndoRedoButtons();
  }

  undo() {
    if (!this.undoStack.length) return;

    const action = this.undoStack.pop();
    this.redoStack.push(action);

    this.isRestoring = true;

    switch (action.type) {
      case 'create': {
        const plot = this.plots.get(action.plotId);
        if (plot) {
          plot.remove({ recordHistory: false });
        }
        break;
      }
      case 'remove': {
        this.createPlot(action.filepath, { plotId: action.plotId, trackHistory: false });
        break;
      }
      case 'clearAll': {
        action.plots.forEach(({ plotId, filepath }) => {
          if (filepath) {
            this.createPlot(filepath, { plotId, trackHistory: false });
          }
        });
        break;
      }
      case 'changeFilepath': {
        const plot = this.plots.get(action.plotId);
        if (plot) {
          plot.watchFile(action.oldFilepath, { recordHistory: false, saveSession: false });
        }
        break;
      }
      default:
        break;
    }

    this.isRestoring = false;
    this.saveSession();
    this.updateUndoRedoButtons();
  }

  redo() {
    if (!this.redoStack.length) return;

    const action = this.redoStack.pop();
    this.undoStack.push(action);

    this.isRestoring = true;

    switch (action.type) {
      case 'create': {
        this.createPlot(action.filepath, { plotId: action.plotId, trackHistory: false });
        break;
      }
      case 'remove': {
        const plot = this.plots.get(action.plotId);
        if (plot) {
          plot.remove({ recordHistory: false });
        }
        break;
      }
      case 'clearAll': {
        const plotsToRemove = action.plots
          .map(({ plotId }) => this.plots.get(plotId))
          .filter(Boolean);
        plotsToRemove.forEach((plot) => plot.remove({ recordHistory: false }));
        break;
      }
      case 'changeFilepath': {
        const plot = this.plots.get(action.plotId);
        if (plot) {
          plot.watchFile(action.newFilepath, { recordHistory: false, saveSession: false });
        }
        break;
      }
      default:
        break;
    }

    this.isRestoring = false;
    this.saveSession();
    this.updateUndoRedoButtons();
  }

  updateUndoRedoButtons() {
    const undoButton = document.getElementById('undo-button');
    const redoButton = document.getElementById('redo-button');

    if (undoButton) {
      undoButton.disabled = this.undoStack.length === 0;
    }
    if (redoButton) {
      redoButton.disabled = this.redoStack.length === 0;
    }
  }

  findPlotByFilepath(filepath) {
    if (!filepath) return null;
    for (const plot of this.plots.values()) {
      if (plot.fullFilepath === filepath) {
        return plot;
      }
    }
    return null;
  }

  watchFilepath(filepath) {
    const target = filepath?.trim();
    if (!target) return;

    const existingPlot = this.findPlotByFilepath(target);
    if (existingPlot) {
      existingPlot.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlight(existingPlot.container, 'plot-duplicate');
      return existingPlot;
    }

    const plot = this.createPlot(null);
    plot.watchFile(target, { recordHistory: false });

    setTimeout(() => {
      plot.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    return plot;
  }

  saveSession() {
    const plotsContainer = document.getElementById('plots-container');
    if (!plotsContainer) return;

    const plotElements = plotsContainer.querySelectorAll('.container:not(.main-header)');
    const plots = Array.from(plotElements)
      .map((element) => {
        const plotId = Number.parseInt(element.id.replace('plot-', ''), 10);
        const plot = this.plots.get(plotId);
        if (plot && plot.fullFilepath) {
          return { plotId, filepath: plot.fullFilepath };
        }
        return null;
      })
      .filter(Boolean);

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ plots }));
  }

  restoreSession() {
    if (this.plots.size) {
      return false;
    }

    const session = safeParse(localStorage.getItem(SESSION_STORAGE_KEY), null);
    if (!session || !Array.isArray(session.plots) || !session.plots.length) {
      return false;
    }

    this.isRestoring = true;
    session.plots.forEach(({ plotId, filepath }) => {
      if (filepath) {
        this.createPlot(filepath, { plotId, trackHistory: false });
      }
    });
    this.isRestoring = false;

    this.saveSession();
    return true;
  }

  resubscribePlots() {
    for (const plot of this.plots.values()) {
      if (plot.fullFilepath) {
        plot.watchFile(plot.fullFilepath, {
          recordHistory: false,
          saveSession: false,
          force: true
        });
      }
    }
  }

  registerSocketEvents() {
    this.socket.on('openPlots', (filepaths) => {
      filepaths.forEach((filepath) => this.watchFilepath(filepath));
      this.saveSession();
    });

    this.socket.on('filepath', ({ filepath, plotId }) => {
      const plot = this.plots.get(plotId);
      if (plot) {
        plot.loadImage(filepath);
      }
    });

    this.socket.on('initialFilepath', ({ filepath, plotId }) => {
      const plot = this.plots.get(plotId);
      if (plot) {
        plot.loadImage(filepath);
      }
    });

    this.socket.on('filepathValidation', ({ filepath, exists, requestId }) => {
      const callback = this.validationCallbacks[requestId];
      if (callback) {
        callback(exists, filepath);
        delete this.validationCallbacks[requestId];
      }
    });
  }

  validateFilepath(filepath, callback) {
    if (!filepath) return;
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.validationCallbacks[requestId] = callback;
    this.socket.emit('validateFilepath', { filepath, requestId });
  }
}

let plotManager = null;

const main = () => {
  window.addEventListener('load', () => {
    const socket = io(`http://localhost:${SOCKET_PORT}`);
    plotManager = new PlotManager(socket);

    const mainHeader = document.querySelector('.container.main-header');
    const connectionStatusEl = document.getElementById('connection-status');
    const mainFilepathInput = document.getElementById('main-filepath-input');
    const mainWatchButton = document.getElementById('main-watch-button');
    const clearAllButton = document.getElementById('clear-all-button');
    const undoButton = document.getElementById('undo-button');
    const redoButton = document.getElementById('redo-button');

    const setConnectionStatus = (state, message) => {
      if (!mainHeader || !connectionStatusEl) return;

      connectionStatusEl.textContent = message;
      connectionStatusEl.classList.remove('hidden', 'status-connected', 'status-disconnected', 'status-connecting');
      mainHeader.classList.remove('connection-lost');

      if (state === 'connected') {
        connectionStatusEl.classList.add('status-connected');
      } else if (state === 'disconnected') {
        connectionStatusEl.classList.add('status-disconnected');
        mainHeader.classList.add('connection-lost');
      } else {
        connectionStatusEl.classList.add('status-connecting');
      }
    };

    const handleDisconnected = (message) => {
      setConnectionStatus('disconnected', message);
    };

    // Show initial state while connecting
    setConnectionStatus('connecting', 'Connecting...');

    mainWatchButton.addEventListener('click', () => {
      const filepath = mainFilepathInput.value.trim();
      if (!filepath) return;

      plotManager.validateFilepath(filepath, (exists) => {
        if (exists) {
          plotManager.watchFilepath(filepath);
          mainFilepathInput.value = '';
        } else if (mainHeader) {
          highlight(mainHeader, 'plot-error');
        }
      });
    });

    mainFilepathInput.addEventListener('click', showMainRecentPathsDropdown);
    mainFilepathInput.addEventListener('focus', showMainRecentPathsDropdown);
    mainFilepathInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        mainWatchButton.click();
      }
    });

    document.addEventListener('click', (event) => {
      if (!mainHeader?.contains(event.target)) {
        hideMainRecentPathsDropdown();
      }
    });

    clearAllButton.addEventListener('click', () => {
      plotManager.clearAllPlots();
    });

    undoButton.addEventListener('click', () => {
      plotManager.undo();
    });

    redoButton.addEventListener('click', () => {
      plotManager.redo();
    });

    document.addEventListener('keydown', (event) => {
      const targetTag = event.target.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;

      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        plotManager.undo();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        plotManager.redo();
      }
    });

    plotManager.updateUndoRedoButtons();

    socket.on('connect', () => {
      setConnectionStatus('connected', 'Connected');
      const restored = plotManager.restoreSession();
      if (!restored) {
        plotManager.resubscribePlots();
      }
      plotManager.updateUndoRedoButtons();
    });

    socket.on('disconnect', () => {
      handleDisconnected('Not connected');
    });

    socket.on('connect_error', () => {
      handleDisconnected('Connection lost. Retrying...');
    });

    if (socket.io?.on) {
      socket.io.on('reconnect_attempt', () => {
        setConnectionStatus('connecting', 'Reconnecting...');
      });

      socket.io.on('reconnect_failed', () => {
        handleDisconnected('Unable to reconnect');
      });
    }
  });
};

main();
