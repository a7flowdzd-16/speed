const NodeMediaServer = require('node-media-server');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// 1. Prepare Express & Socket.io for Real-Time Chat & Stats
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 2. Prepare Node Media Server for Low-Latency RTMP -> HLS Streaming
const nmsConfig = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: './media',
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg', // Requires ffmpeg installed on the VPS
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        hlsKeep: false, 
      }
    ]
  }
};

const nms = new NodeMediaServer(nmsConfig);
nms.run();

// 3. Socket.io Logic
const viewers = {}; // Format: { "roomId": count }

io.on('connection', (socket) => {
  console.log('🔗 Viewer/Broadcaster Connected:', socket.id);

  // Join a live auction room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    viewers[roomId] = (viewers[roomId] || 0) + 1;
    io.to(roomId).emit('viewers_update', viewers[roomId]);
    console.log(`User joined room ${roomId}. Total viewers: ${viewers[roomId]}`);
  });

  // Handle incoming Chat Messages
  socket.on('send_message', (data) => {
    // Expected data: { roomId: '...', user: '...', text: '...' }
    io.to(data.roomId).emit('chat_message', data);
  });

  // Leave room logic
  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    if(viewers[roomId]) {
      viewers[roomId]--;
      io.to(roomId).emit('viewers_update', viewers[roomId]);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client Disconnected:', socket.id);
  });
});

// Start Real-Time Server
server.listen(3000, () => {
  console.log('🚀 WebSockets & Real-Time Chat running on Port 3000');
  console.log('📽️ RTMP Video Publisher expecting streams on Port 1935');
  console.log('▶️ HLS Video Viewers expecting streams on Port 8000');
});
