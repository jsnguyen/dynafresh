const fs = require('fs');
const path = require('path');
const express = require('express');
const chokidar = require('chokidar');
const { Server } = require('socket.io');
const { program } = require('commander');

const tlog = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

program
  .option('-f, --file <filename>', 'input filename')
  .option('-p, --port <number>', 'port number for the server', '12301');

program.parse(process.argv);

const initialFilepath = program.opts().file ? path.resolve(program.opts().file) : null;
const port = Number.parseInt(program.opts().port, 10);

const app = express();
const publicDir = path.join(__dirname, 'public');
const imagesDir = path.join(publicDir, 'images');
fs.mkdirSync(imagesDir, { recursive: true });

app.use(express.static(publicDir));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(port, () => tlog(`Server started on port ${port}`));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

tlog('Socket.io server ready');

const createCopyPaths = (srcPath) => {
  const filename = path.basename(srcPath);
  return {
    copyPath: path.join(imagesDir, filename),
    destPath: path.join('images', filename)
  };
};

io.on('connection', (socket) => {
  tlog('Client connected');

  const watcher = chokidar.watch([], {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: true
  });

  const plotSources = new Map(); // plotId -> srcPath
  const fileMetadata = new Map(); // srcPath -> { copyPath, destPath, plots: Set }

  const ensureMetadata = (srcPath) => {
    if (!fileMetadata.has(srcPath)) {
      const { copyPath, destPath } = createCopyPaths(srcPath);
      fileMetadata.set(srcPath, {
        copyPath,
        destPath,
        plots: new Set()
      });
    }
    return fileMetadata.get(srcPath);
  };

  const broadcastFile = (srcPath, plotIds) => {
    const meta = fileMetadata.get(srcPath);
    if (!meta) return;

    if (!fs.existsSync(srcPath)) {
      plotIds.forEach((plotId) => {
        socket.emit('filepath', { filepath: '', plotId });
      });
      return;
    }

    fs.copyFileSync(srcPath, meta.copyPath);
    plotIds.forEach((plotId) => {
      socket.emit('filepath', {
        filepath: meta.destPath,
        plotId
      });
    });
  };

  const watchPlot = ({ filepath, plotId }) => {
    if (!filepath) return;
    const numericPlotId = Number.parseInt(plotId, 10);
    if (Number.isNaN(numericPlotId)) return;

    const resolvedPath = path.resolve(filepath);
    const meta = ensureMetadata(resolvedPath);
    meta.plots.add(numericPlotId);

    const previousSource = plotSources.get(numericPlotId);
    if (previousSource && previousSource !== resolvedPath) {
      const previousMeta = fileMetadata.get(previousSource);
      previousMeta?.plots.delete(numericPlotId);
      if (!previousMeta?.plots.size) {
        watcher.unwatch(previousSource);
        fileMetadata.delete(previousSource);
      }
    }

    plotSources.set(numericPlotId, resolvedPath);
    watcher.add(resolvedPath);
    broadcastFile(resolvedPath, [numericPlotId]);
  };

  const unwatchPlot = ({ plotId }) => {
    const numericPlotId = Number.parseInt(plotId, 10);
    if (Number.isNaN(numericPlotId)) return;

    const srcPath = plotSources.get(numericPlotId);
    if (!srcPath) return;

    plotSources.delete(numericPlotId);
    const meta = fileMetadata.get(srcPath);
    if (!meta) return;

    meta.plots.delete(numericPlotId);
    if (!meta.plots.size) {
      watcher.unwatch(srcPath);
      fileMetadata.delete(srcPath);
    }
  };

  watcher.on('change', (changedPath) => {
    const meta = fileMetadata.get(changedPath);
    if (!meta) return;
    broadcastFile(changedPath, Array.from(meta.plots));
  });

  socket.on('openPlots', (filepaths = []) => {
    const resolvedPaths = filepaths.map((fp) => path.resolve(fp));
    tlog(`Opening ${resolvedPaths.length} plots via CLI`);
    io.emit('openPlots', resolvedPaths);
  });

  socket.on('watchFilepath', watchPlot);
  socket.on('unwatch', unwatchPlot);

  socket.on('validateFilepath', ({ filepath, requestId }) => {
    const resolvedPath = filepath ? path.resolve(filepath) : null;
    const exists = resolvedPath ? fs.existsSync(resolvedPath) : false;
    socket.emit('filepathValidation', { filepath, exists, requestId });
  });

  socket.on('disconnect', () => {
    tlog('Client disconnected');
    watcher.close().catch(() => {});
    plotSources.clear();
    fileMetadata.clear();
  });

  if (initialFilepath) {
    const initialPlotId = 1;
    watchPlot({ filepath: initialFilepath, plotId: initialPlotId });
    const meta = fileMetadata.get(path.resolve(initialFilepath));
    if (meta) {
      socket.emit('initialFilepath', {
        filepath: meta.destPath,
        plotId: initialPlotId
      });
    }
  }
});
