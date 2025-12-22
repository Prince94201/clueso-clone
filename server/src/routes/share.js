const express = require('express');
const router = express.Router();
const { resolveShareToken } = require('../controllers/shareController');

// Public route: GET /api/share/:token
router.get('/:token', resolveShareToken);

module.exports = router;