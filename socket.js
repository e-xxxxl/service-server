// socket.js - Create this file
const { Server } = require('socket.io');
const JWTService = require('./config/jwt');
const User = require('./models/User');

let io;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = JWTService.verifyToken(token);
      const user = await User.findById(decoded.id || decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = {
        id: user._id.toString(),
        fullName: user.fullName,
        accountType: user.accountType,
        email: user.email
      };
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.user.fullName} (${socket.user.accountType})`);

    // Join user to their personal room
    const userRoom = `user:${socket.user.id}`;
    socket.join(userRoom);
    
    // Join role-based room
    const roleRoom = `role:${socket.user.accountType}`;
    socket.join(roleRoom);

    // Handle private messaging
    socket.on('join:conversation', (conversationId) => {
      const room = `conversation:${conversationId}`;
      socket.join(room);
      console.log(`${socket.user.fullName} joined conversation: ${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId) => {
      const room = `conversation:${conversationId}`;
      socket.leave(room);
    });

    // Messages are persisted exclusively through the REST endpoints
    // (customerController.sendMessage / providerController.sendMessage,
    // plus quote/payment actions) - those handlers call getIO() to emit
    // 'message:received' / 'message:notification' themselves once a message
    // is actually saved. There is deliberately no socket-side write path
    // here anymore, so there is only ever one place a message gets created.

    // Typing indicator
    // Broadcast to the conversation room (not a specific recipient room) so
    // neither side needs to know the other's raw user id client-side -
    // socket.to() already excludes the sender.
    socket.on('typing:start', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        userName: socket.user.fullName
      });
    });

    socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        userName: socket.user.fullName
      });
    });

    // Mark as read - only clears the reading side's own unread flag.
    // Clearing both regardless of who's reading would wrongly mark the
    // other participant's unread messages as seen too.
    socket.on('messages:read', async (data) => {
      const { conversationId } = data;
      const Conversation = require('./models/Conversation');

      const unreadField = socket.user.accountType === 'provider' ? 'providerUnread' : 'customerUnread';
      await Conversation.updateOne(
        { _id: conversationId },
        { $set: { [unreadField]: false } }
      );

      const conversationRoom = `conversation:${conversationId}`;
      socket.to(conversationRoom).emit('messages:read', {
        conversationId,
        readBy: socket.user.id
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.user.fullName}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

// Shared broadcast helper for the REST message-sending controllers (the
// only place messages are ever persisted). Pushes the new message to
// anyone actively viewing the conversation, and a lighter notification
// ping to the recipient's personal room so their conversation list /
// unread badge updates even if they're not looking at this thread.
function emitNewMessage({ conversationId, recipientUserId, message, senderName }) {
  try {
    getIO().to(`conversation:${conversationId}`).emit('message:received', {
      conversationId,
      message
    });
    getIO().to(`user:${recipientUserId}`).emit('message:notification', {
      conversationId,
      senderName,
      preview: (message.text || '').substring(0, 50)
    });
  } catch (err) {
    // Socket.io isn't initialized in this process (e.g. a one-off script) -
    // the message is still persisted via REST, it just won't push live.
  }
}

module.exports = { initializeSocket, getIO, emitNewMessage };