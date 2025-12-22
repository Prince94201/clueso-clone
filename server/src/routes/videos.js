const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const videoController = require('../controllers/videoController');

// Protected routes
router.post('/', auth, upload, videoController.upload);
router.get('/', auth, videoController.list);
router.get('/:id', auth, videoController.get);
router.put('/:id', auth, videoController.update);
router.delete('/:id', auth, videoController.remove);

module.exports = router;