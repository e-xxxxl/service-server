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

    // Send message
    socket.on('send:message', async (data) => {
      try {
        const { conversationId, recipientId, text } = data;
        
        // Filter message
        const MessageFilter = require('./middleware/messageFilter');
        const filterResult = MessageFilter.filterMessage(text);
        
        if (!filterResult.isClean) {
          socket.emit('message:error', {
            message: 'Contact information detected',
            warning: filterResult.warning,
            violations: filterResult.violations
          });
          return;
        }

        // Save message to database
        const Conversation = require('./models/Conversation');
        let conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
          conversation = await Conversation.create({
            customer: socket.user.accountType === 'customer' ? socket.user.id : recipientId,
            professional: socket.user.accountType === 'provider' ? socket.user.id : recipientId,
            messages: []
          });
        }

        const messageData = {
          sender: socket.user.id,
          senderModel: socket.user.accountType === 'provider' ? 'ServiceProvider' : 'User',
          text: text.trim(),
          createdAt: new Date()
        };

        conversation.messages.push(messageData);
        conversation.lastMessageAt = new Date();
        
        if (socket.user.accountType === 'customer') {
          conversation.providerUnread = true;
          conversation.customerUnread = false;
        } else {
          conversation.customerUnread = true;
          conversation.providerUnread = false;
        }
        
        await conversation.save();

        const message = {
          ...messageData,
          id: conversation.messages[conversation.messages.length - 1]._id,
          senderName: socket.user.fullName
        };

        // Emit to conversation room
        const conversationRoom = `conversation:${conversation._id}`;
        io.to(conversationRoom).emit('message:received', {
          conversationId: conversation._id,
          message
        });

        // Notify recipient
        const recipientRoom = `user:${recipientId}`;
        io.to(recipientRoom).emit('message:notification', {
          conversationId: conversation._id,
          senderName: socket.user.fullName,
          preview: text.substring(0, 50),
          unreadCount: 1
        });

        socket.emit('message:sent', {
          conversationId: conversation._id,
          message
        });

      } catch (error) {
        console.error('Message error:', error);
        socket.emit('message:error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', (data) => {
      const { conversationId, recipientId } = data;
      const recipientRoom = `user:${recipientId}`;
      socket.to(recipientRoom).emit('typing:start', {
        conversationId,
        userName: socket.user.fullName
      });
    });

    socket.on('typing:stop', (data) => {
      const { conversationId, recipientId } = data;
      const recipientRoom = `user:${recipientId}`;
      socket.to(recipientRoom).emit('typing:stop', {
        conversationId,
        userName: socket.user.fullName
      });
    });

    // Mark as read
    socket.on('messages:read', async (data) => {
      const { conversationId } = data;
      const Conversation = require('./models/Conversation');
      
      await Conversation.updateOne(
        { _id: conversationId },
        { 
          $set: { 
            customerUnread: false,
            providerUnread: false
          }
        }
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

module.exports = { initializeSocket, getIO };