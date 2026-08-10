// routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const LocationController = require('../controllers/locationController');

// Public, static, in-memory data — no auth or DB hit required.
router.get('/states', LocationController.getStates);
router.get('/states/:state/lgas', LocationController.getLgas);
router.get('/all', LocationController.getAll);

module.exports = router;
