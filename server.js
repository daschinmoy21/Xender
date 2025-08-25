const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected clients with their peer IDs
const clients = new Map();

app.use(express.static(path.join(__dirname, '.')));

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            // Convert message to string if it's not already
            const messageStr = message.toString();
            console.log('Received message:', messageStr);

            // Parse and validate JSON
            const data = JSON.parse(messageStr);
            console.log('Parsed data:', data);

            // Handle registration
            if (data.type === 'register') {
                clients.set(data.peerId, ws);
                console.log(`Registered peer: ${data.peerId}`);
                return;
            }

            // Handle targeted messaging
            if (data.to) {
                const targetClient = clients.get(data.to);
                if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                    console.log(`Sending message to ${data.to}:`, JSON.stringify(data));
                    targetClient.send(JSON.stringify(data));
                } else {
                    console.log(`Target peer ${data.to} not found or not connected`);
                }
            } else {
                // For broadcast messages (like discovery)
                console.log('Broadcasting message:', JSON.stringify(data));
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
        } catch (err) {
            console.error('Error processing message:', err);
            console.error('Raw message:', message);
        }
    });

    ws.on('close', () => {
        // Remove client from map
        for (const [peerId, client] of clients.entries()) {
            if (client === ws) {
                clients.delete(peerId);
                console.log(`Client ${peerId} disconnected`);
                break;
            }
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});