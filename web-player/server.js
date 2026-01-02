const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const CONVERTER_PORT = 3001;

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
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Video proxy endpoint to avoid CORS issues
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
    
    if (filePath === '/' || !filePath.includes('.')) {
        filePath = '/index.html';
    }
    
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(fullPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(__dirname, 'index.html'), (err2, content2) => {
                    if (err2) {
                        res.writeHead(500);
                        res.end('Server Error');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content2);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Web Player running at http://0.0.0.0:${PORT}`);
    console.log(`Proxying /api/* to converter at port ${CONVERTER_PORT}`);
    console.log('Ready for WhatsApp links!');
});
