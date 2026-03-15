const express = require('express');
const path = require('path');
const app = express();

// 1. Serve the frontend HTML file on the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. The SSE Streaming Route
app.get('/api/stream', (req, res) => {
    // 🚨 CRITICAL SSE HEADERS 🚨
    // These tell the browser: "Keep this connection open, I will stream text to you."
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let counter = 1;

    // Send a message every 1 second
    const intervalId = setInterval(() => {
        const payload = { 
            status: "PROCESSING", 
            message: `Extracting data... Step ${counter}/5` 
        };

        // 🚨 CRITICAL SSE FORMATTING 🚨
        // SSE messages MUST start with "data: " and end with two newlines "\n\n"
        res.write(`data: ${JSON.stringify(payload)}\n\n`);

        counter++;

        // Stop after 5 seconds
        if (counter > 5) {
            clearInterval(intervalId);
            // Send a final completion message
            res.write(`data: ${JSON.stringify({ status: "COMPLETED", message: "Done!" })}\n\n`);
            res.end(); // Close the connection from the server side
        }
    }, 1000);

    // If the user closes their browser tab early, stop the loop to save server CPU!
    req.on('close', () => {
        console.log("Client closed the connection early.");
        clearInterval(intervalId);
    });
});

app.listen(3000, () => {
    console.log('🚀 SSE Test Server running on http://localhost:3000');
});