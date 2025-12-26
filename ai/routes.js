const express = require('express');
const router = express.Router();
const auth = require('../server/src/middleware/auth');
const aiController = require('./controller');

router.post('/videos/:id/transcribe', auth, aiController.transcribe);
router.post('/videos/:id/improve-script', auth, aiController.improveScript);
router.post('/videos/:id/generate-voice', auth, aiController.generateVoice);
router.post('/videos/:id/generate-docs', auth, aiController.generateDocs);

module.exports = router;