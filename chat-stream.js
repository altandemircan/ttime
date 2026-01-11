const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
    console.log('[CHAT-STREAM] Endpoint called with query:', req.query);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let finished = false;

    console.log('[CHAT-STREAM] Headers set, starting stream...');

    // Basit test response
    res.write(`data: ${JSON.stringify({content: "Test response from chat-stream"})}\n\n`);
    res.write('event: end\ndata: [DONE]\n\n');
    res.end();
    
    console.log('[CHAT-STREAM] Stream ended');
});

module.exports = router;