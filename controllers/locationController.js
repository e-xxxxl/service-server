// controllers/locationController.js
const { NIGERIA_LOCATIONS, NIGERIA_STATES, isValidState } = require('../data/nigeriaLocations');

class LocationController {
  // GET /api/locations/states
  static getStates(req, res) {
    res.json({ success: true, data: NIGERIA_STATES });
  }

  // GET /api/locations/states/:state/lgas
  static getLgas(req, res) {
    const { state } = req.params;

    if (!isValidState(state)) {
      return res.status(404).json({ success: false, message: 'Unknown state' });
    }

    res.json({ success: true, data: NIGERIA_LOCATIONS[state] });
  }

  // GET /api/locations/all
  // Full state->LGA map in one call, for clients that want to cache everything up front.
  static getAll(req, res) {
    res.json({ success: true, data: NIGERIA_LOCATIONS });
  }
}

module.exports = LocationController;
