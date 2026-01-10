const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const CONVERTER_PORT = 3001;

const BUILD_VERSION = Date.now().toString();
console.log(`Build Version: ${BUILD_VERSION}`);

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE?.toLowerCase() === 'true';
const ACCESS_CODE = process.env.ACCESS_CODE || '';

console.log(`Maintenance Mode: ${MAINTENANCE_MODE}`);
console.log(`Access Code Required: ${!!ACCESS_CODE}`);

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check endpoint - FAST response for Replit deployment
    if (req.url === '/health' || req.url === '/_health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }

    // Force cache clear and redirect to cube demo
    if (req.url === '/cube' || req.url === '/demo') {
        res.writeHead(200, { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Clear-Site-Data': '"cache", "cookies", "storage"'
        });
        res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<script>
if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister()));}
if('caches' in window){caches.keys().then(k=>k.forEach(c=>caches.delete(c)));}
localStorage.clear();
sessionStorage.clear();
setTimeout(()=>location.href='/cube-demo.html?t=${Date.now()}',500);
</script>
</head><body style="background:linear-gradient(135deg,#FF6B9D,#C06FBB);display:flex;align-items:center;justify-content:center;height:100vh;color:white;font-family:sans-serif;">
<div style="text-align:center;"><h2>מנקה קאש...</h2><p>מעביר לדמו הקוביה</p></div>
</body></html>`);
        return;
    }

    if (req.url === '/api/version') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(JSON.stringify({ version: BUILD_VERSION, timestamp: new Date().toISOString() }));
        return;
    }
    
    if (req.url.startsWith('/proxy-video')) {
        const urlParam = new URL('http://localhost' + req.url).searchParams.get('url');
        if (!urlParam) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
        }
        
        console.log('Proxying video:', urlParam.substring(0, 100));
        
        const videoUrl = new URL(urlParam);
        const protocol = videoUrl.protocol === 'https:' ? https : http;
        
        const proxyReq = protocol.request(videoUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, {
                'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
                'Content-Length': proxyRes.headers['content-length'],
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            });
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (err) => {
            console.error('Video proxy error:', err.message);
            res.writeHead(502);
            res.end(JSON.stringify({ error: 'Failed to fetch video' }));
        });
        
        proxyReq.end();
        return;
    }
    
    if (req.url === '/api/maintenance-status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            maintenance: false,
            requiresCode: false
        }));
        return;
    }

    if (req.url === '/api/verify-access' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { code } = JSON.parse(body);
                
                if (!ACCESS_CODE) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ valid: true }));
                    return;
                }
                
                const isValid = code === ACCESS_CODE;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ valid: isValid }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    if (req.url.startsWith('/api/')) {
        const proxyReq = http.request({
            hostname: 'localhost',
            port: CONVERTER_PORT,
            path: req.url,
            method: req.method,
            headers: {
                ...req.headers,
                host: `localhost:${CONVERTER_PORT}`
            }
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err.message);
            res.writeHead(502);
            res.end(JSON.stringify({ error: 'Converter service unavailable' }));
        });
        
        req.pipe(proxyReq);
        return;
    }
    
    let filePath = req.url.split('?')[0];
    
    if (filePath === '/' || filePath.startsWith('/s/') || !filePath.includes('.')) {
        filePath = 'index.html';
    } else {
        filePath = filePath.replace(/^\/+/, '');
    }
    
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    const isHTML = ext === '.html' || filePath === 'index.html';
    
    const cacheHeaders = {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Build-Version': BUILD_VERSION
    };
    
    fs.readFile(fullPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(__dirname, 'index.html'), (err2, content2) => {
                    if (err2) {
                        res.writeHead(500);
                        res.end('Server Error');
                    } else {
                        let htmlContent = content2.toString();
                        htmlContent = htmlContent.replace('</body>', `
    <script>
    window.BUILD_VERSION = "${BUILD_VERSION}";
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
    </script>
</body>`);
                        res.writeHead(200, cacheHeaders);
                        res.end(htmlContent);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            if (isHTML) {
                let htmlContent = content.toString();
                htmlContent = htmlContent.replace('</body>', `
    <script>
    window.BUILD_VERSION = "${BUILD_VERSION}";
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
    </script>
</body>`);
                res.writeHead(200, cacheHeaders);
                res.end(htmlContent);
            } else {
                res.writeHead(200, cacheHeaders);
                res.end(content);
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Web Player running at http://0.0.0.0:${PORT}`);
    console.log(`Build Version: ${BUILD_VERSION}`);
    console.log(`Proxying /api/* to converter at port ${CONVERTER_PORT}`);
    console.log('Ready for WhatsApp links!');
});
