// routes/contactRoutes.js - public contact form, no auth required
const express = require('express');
const router = express.Router();
const ContactController = require('../controllers/contactController');
const { contactLimiter } = require('../middleware/rateLimiter');

router.post('/', contactLimiter, ContactController.submit);

module.exports = router;
