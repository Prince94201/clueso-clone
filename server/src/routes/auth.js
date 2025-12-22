const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { register, login, getMe, validateRegister, validateLogin } = require('../controllers/authController');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', auth, getMe);

module.exports = router;