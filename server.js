const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const START_PORT = 8000;
const MAX_PORT = 8010;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8'
};

const LIVERELOAD_SCRIPT = `
<!-- LiveReload Script -->
<script id="__livereload_script">
(function() {
  var es = new EventSource('/__livereload');
  es.onmessage = function(e) {
    if (e.data === 'reload') {
      console.log('[LiveReload] Change detected, reloading...');
      location.reload();
    }
  };
})();
</script>
</body>`;

const sseClients = new Set();
let reloadDebounceTimer = null;

function notifyClients() {
  if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer);
  reloadDebounceTimer = setTimeout(() => {
    console.log(`[${formatTime()}] File change detected, auto-reloading browser...`);
    for (const client of sseClients) {
      try {
        client.write('data: reload\n\n');
      } catch (err) {
        sseClients.delete(client);
      }
    }
  }, 150);
}

try {
  fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (filename.includes('.git') || filename.includes('node_modules') || filename.endsWith('.log')) return;
    notifyClients();
  });
} catch (err) {
  fs.watch(ROOT, () => notifyClients());
}

function formatTime() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

function handleRequest(req, res) {
  let reqUrl;
  try {
    reqUrl = new URL(req.url, 'http://localhost');
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  let pathname = decodeURIComponent(reqUrl.pathname);

  // SSE LiveReload endpoint
  if (pathname === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('retry: 1500\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  let safePath = path.normalize(path.join(ROOT, pathname));

  // Security: prevent directory traversal
  if (!safePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      safePath = path.join(safePath, 'index.html');
      fs.stat(safePath, (err2, stats2) => {
        if (!err2 && stats2.isFile()) {
          serveFile(safePath, res);
        } else {
          fallbackOr404(req, res);
        }
      });
      return;
    }

    if (!err && stats.isFile()) {
      serveFile(safePath, res);
    } else {
      fallbackOr404(req, res);
    }
  });
}

function fallbackOr404(req, res) {
  const acceptHeader = req.headers['accept'] || '';
  if (acceptHeader.includes('text/html')) {
    res.writeHead(302, { 'Location': '/index.html', 'Content-Length': '0' });
    res.end();
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }

    let body = data;
    if (ext === '.html' || ext === '.htm') {
      const htmlStr = data.toString('utf-8');
      if (htmlStr.includes('</body>')) {
        body = Buffer.from(htmlStr.replace('</body>', LIVERELOAD_SCRIPT), 'utf-8');
      } else {
        body = Buffer.from(htmlStr + LIVERELOAD_SCRIPT, 'utf-8');
      }
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(body);
  });
}

function startServer(port) {
  const server = http.createServer(handleRequest);

  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}/`;
    console.log(`[${formatTime()}] Serving folder: ${ROOT}`);
    console.log(`[${formatTime()}] Local server started at: ${url}`);
    console.log(`[${formatTime()}] LiveReload is active.`);
    console.log(`[${formatTime()}] Press Ctrl+C to stop.`);

    if (!process.argv.includes('--no-browser')) {
      const openCmd = process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`;
      exec(openCmd);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < MAX_PORT) {
      console.log(`Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Failed to start server:', err);
    }
  });
}

const customPort = parseInt(process.argv[2], 10);
startServer(!isNaN(customPort) ? customPort : START_PORT);
