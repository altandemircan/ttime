const express = require('express');
const http = require('http');
const router = express.Router();

router.post('/plan-summary', (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        const { city } = JSON.parse(body);
        const prompt = `Antalya 1 day trip`; // veya dinamik prompt

        const ollamaReq = http.request({
            hostname: 'localhost',
            port: 11434,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, ollamaRes => {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            ollamaRes.pipe(res);
        });

        ollamaReq.write(JSON.stringify({
            model: "llama3.2:3b",
            prompt,
            stream: true
        }));
        ollamaReq.end();
    });
});

module.exports = router;