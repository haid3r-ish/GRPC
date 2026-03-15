require("module-alias/register");

const OcrBatch = require('../models/OcrBatch');

// 1. In-memory Map to hold the open frontend connections
const activeSseConnections = new Map();

// 2. The Frontend SSE Route (GET /api/ocr/stream/:requestId)
const streamOcrResults = (req, res) => {
    const { requestId } = req.params;

    // Set the mandatory SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Save this connection to our Map so S2 can find it later
    activeSseConnections.set(requestId, res);

    // Tell the frontend we are connected
    res.write(`data: ${JSON.stringify({ message: "SSE Connected. Waiting for S2..." })}\n\n`);

    // If the user closes the browser tab, remove them from the Map to prevent memory leaks
    req.on('close', () => {
        activeSseConnections.delete(requestId);
    });
};

// 3. The Internal Webhook for S2 (POST /internal/sse-notify)
// ONLY the S2 worker on the same machine is allowed to call this route!
const handleS2Notification = (req, res) => {
    const { requestId, status, data } = req.body;
    const clientConnection = activeSseConnections.get(requestId);

    if (clientConnection) {
        // Stream the newly finished image straight to the React frontend!
        clientConnection.write(`data: ${JSON.stringify({ status, data })}\n\n`);
    }

    res.status(200).send("Notification forwarded");
};

module.exports = { streamOcrResults, handleS2Notification };