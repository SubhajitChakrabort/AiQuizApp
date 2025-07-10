const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/authMiddleware');
const quizController = require('../controllers/quiz.controller');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/upload', verifyToken, upload.single('pdf'), quizController.uploadPDF);
router.get('/generate', verifyToken, quizController.generateQuiz);  // This creates /api/quiz/generate
router.post('/submit', verifyToken, quizController.submitQuiz);

module.exports = router;
