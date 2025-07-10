const express = require('express');
const dotenv = require('dotenv');
const quizRoutes = require('./routes/quiz.routes');
const authRoutes = require('./routes/auth.routes');
const db = require('./config/db');

dotenv.config();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('views'));

// Routes - Make sure these match your frontend calls
app.use('/api/quiz', quizRoutes);  // This should handle /api/quiz/generate
app.use('/api/auth', authRoutes);

// Serve index page
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './views' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
