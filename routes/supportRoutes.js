// routes/supportRoutes.js
const express = require('express');
const router = express.Router();
const SupportController = require('../controllers/supportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/thread', SupportController.getMyThread);
router.post('/thread', SupportController.sendMessage);

module.exports = router;
