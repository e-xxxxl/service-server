// controllers/supportController.js
const SupportThread = require('../models/SupportThread');
const { getIO } = require('../socket');

function emitToUser(userId, event, payload) {
  try {
    getIO().to(`user:${userId}`).emit(event, payload);
  } catch (err) {
    // Socket.io not initialized - safe to ignore, thread is still persisted.
  }
}

class SupportController {
  // GET /api/support/thread - the current user's own thread (customer or provider)
  static async getMyThread(req, res) {
    try {
      let thread = await SupportThread.findOne({ user: req.user.id }).sort({ createdAt: -1 });
      if (!thread) {
        return res.json({ success: true, data: null });
      }
      thread.unreadByUser = false;
      await thread.save();
      res.json({ success: true, data: thread });
    } catch (error) {
      console.error('Get support thread error:', error);
      res.status(500).json({ success: false, message: 'Failed to load support conversation' });
    }
  }

  // POST /api/support/thread - send a message; creates the thread on first use
  static async sendMessage(req, res) {
    try {
      const { text, subject, type } = req.body;
      if (!text?.trim()) {
        return res.status(400).json({ success: false, message: 'Message cannot be empty' });
      }

      let thread = await SupportThread.findOne({ user: req.user.id, status: 'open' }).sort({ createdAt: -1 });
      if (!thread) {
        thread = new SupportThread({
          user: req.user.id,
          userRole: req.user.accountType,
          subject: subject || 'Support request',
          type: type || 'general',
          messages: []
        });
      }

      thread.messages.push({ sender: 'user', senderName: req.user.fullName, text: text.trim() });
      thread.lastMessageAt = new Date();
      thread.unreadByAdmin = true;
      await thread.save();

      emitToUser(req.user.id, 'support:message', { threadId: thread._id, thread });

      res.json({ success: true, data: thread });
    } catch (error) {
      console.error('Send support message error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  }

  // ---- Admin ----

  // GET /api/admin/support/threads
  static async listThreads(req, res) {
    try {
      const { status } = req.query;
      const filter = status ? { status } : {};
      const threads = await SupportThread.find(filter)
        .sort({ lastMessageAt: -1 })
        .limit(100)
        .populate('user', 'fullName email accountType');
      res.json({ success: true, data: threads });
    } catch (error) {
      console.error('List support threads error:', error);
      res.status(500).json({ success: false, message: 'Failed to load conversations' });
    }
  }

  // GET /api/admin/support/threads/:id
  static async getThread(req, res) {
    try {
      const thread = await SupportThread.findByIdAndUpdate(
        req.params.id,
        { unreadByAdmin: false },
        { new: true }
      ).populate('user', 'fullName email accountType');
      if (!thread) return res.status(404).json({ success: false, message: 'Conversation not found' });
      res.json({ success: true, data: thread });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load conversation' });
    }
  }

  // POST /api/admin/support/threads/:id/reply
  static async replyToThread(req, res) {
    try {
      const { text } = req.body;
      if (!text?.trim()) {
        return res.status(400).json({ success: false, message: 'Message cannot be empty' });
      }

      const thread = await SupportThread.findById(req.params.id);
      if (!thread) return res.status(404).json({ success: false, message: 'Conversation not found' });

      thread.messages.push({ sender: 'admin', senderName: req.user.fullName || 'Support Team', text: text.trim() });
      thread.lastMessageAt = new Date();
      thread.unreadByUser = true;
      await thread.save();

      emitToUser(thread.user, 'support:message', { threadId: thread._id, thread });

      res.json({ success: true, data: thread });
    } catch (error) {
      console.error('Reply to support thread error:', error);
      res.status(500).json({ success: false, message: 'Failed to send reply' });
    }
  }

  // PATCH /api/admin/support/threads/:id/resolve
  static async resolveThread(req, res) {
    try {
      const thread = await SupportThread.findByIdAndUpdate(req.params.id, { status: 'resolved' }, { new: true });
      if (!thread) return res.status(404).json({ success: false, message: 'Conversation not found' });
      res.json({ success: true, data: thread });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to resolve conversation' });
    }
  }
}

module.exports = SupportController;
