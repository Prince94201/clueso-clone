const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createShareLink } = require('../controllers/shareController');

// POST /api/videos/:id/share
router.post('/:id/share', auth, createShareLink);

module.exports = router;