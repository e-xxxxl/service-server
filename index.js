// index.js - Updated with scheduler
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const { isOriginAllowed } = require('./config/corsOrigins');
const { initializeSocket } = require('./socket');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const providerRoutes = require('./routes/providerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const locationRoutes = require('./routes/locationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supportRoutes = require('./routes/supportRoutes');
const PaymentController = require('./controllers/paymentController');

// ✅ Import scheduler
const { scheduleReminderEmails } = require('./services/schedulerService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Render sits in front of this app as a single reverse-proxy hop, setting
// X-Forwarded-For on every request. Without telling Express to trust that
// one hop, req.ip falls back to Render's internal proxy address for every
// request - meaning express-rate-limit (see middleware/rateLimiter.js,
// which keys on req.ip) would bucket every visitor behind the proxy under
// the same "IP", so one user's login attempts could lock out others
// sharing nothing but the same edge proxy. `1` = trust exactly one hop,
// not arbitrary client-supplied values further down the chain.
app.set('trust proxy', 1);

// Initialize Socket.io
const io = initializeSocket(server);

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Paystack webhook needs the raw request body for signature verification,
// so it's mounted here, ahead of the global JSON body parser below.
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), PaymentController.webhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/support', supportRoutes);

// Error handlers
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const startServer = async () => {
  await connectDB();
  
  // ✅ Start the reminder email scheduler
  scheduleReminderEmails();
  
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 Socket.io ready for connections`);
    console.log(`📧 Reminder emails and admin notifications active`);
  });
};

startServer();