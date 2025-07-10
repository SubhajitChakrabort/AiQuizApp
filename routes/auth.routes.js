const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Add GET route for register page
router.get('/register', (req, res) => {
    res.sendFile('register.html', { root: './views' });
});

// Existing POST route for registration
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
