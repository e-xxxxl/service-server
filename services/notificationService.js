// services/notificationService.js
//
// Single choke point for in-app notifications: persists to the Notification
// collection and, if Socket.io is up, pushes it to the user's room in real
// time. Controllers should call this instead of Notification.create()
// directly so every notification path gets real-time delivery for free.
const Notification = require('../models/Notification');
const { getIO } = require('../socket');

async function notifyUser(userId, { text, kind = 'message', relatedConversation }) {
  const notification = await Notification.create({
    user: userId,
    text,
    kind,
    relatedConversation
  });

  try {
    getIO().to(`user:${userId}`).emit('notification:new', {
      id: notification._id.toString(),
      text: notification.text,
      kind: notification.kind,
      time: notification.createdAt,
      read: false,
      relatedConversation: notification.relatedConversation
    });
  } catch (err) {
    // Socket.io isn't initialized in this process (e.g. a one-off script) -
    // the notification is still persisted, it just won't push live.
  }

  return notification;
}

module.exports = { notifyUser };
