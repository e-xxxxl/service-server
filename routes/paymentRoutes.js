// routes/paymentRoutes.js
//
// The webhook route is intentionally NOT here - it needs the raw request
// body for signature verification, so it's mounted directly in index.js
// ahead of the global express.json() middleware. This router only holds
// the customer-facing, JSON, protected endpoints.
const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/initialize', PaymentController.initialize);
router.post('/subscription/initialize', PaymentController.initializeSubscription);
router.get('/verify/:reference', PaymentController.verify);

module.exports = router;
