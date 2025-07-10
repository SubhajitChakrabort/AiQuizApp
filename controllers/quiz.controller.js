const db = require('../config/db');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

function generateMCQOptions(content, correctAnswer) {
    const sentences = content
        .split(/[.!?]/)
        .filter(s => s.length > 20 && s !== correctAnswer)
        .map(s => s.trim());

    const wrongOptions = sentences
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(sentence => sentence.replace(/\r\n/g, ' ').trim());

    return [
        correctAnswer.replace(/\r\n/g, ' ').trim(),
        ...wrongOptions
    ].sort(() => Math.random() - 0.5);
    
}

function generateQuestionText(sentence, keyTerm) {
    const questionTypes = [
        `What is ${keyTerm}?`,
        `Which statement is correct about ${keyTerm}?`,
        `According to the text, ${keyTerm} refers to:`,
        `What does ${keyTerm} mean?`,
        `How is ${keyTerm} defined?`,
        `What can be said about ${keyTerm}?`,
        `Which of the following describes ${keyTerm}?`,
        `In the context of the document, ${keyTerm} is:`,
        `What is the meaning of ${keyTerm}?`,
        `Which statement best explains ${keyTerm}?`
    ];

    return questionTypes[Math.floor(Math.random() * questionTypes.length)];
}

async function generateQuestionsFromContent(content) {
    const keyPoints = content
        .replace(/\r\n/g, ' ')
        .split(/[.!?]/)
        .filter(sentence => sentence.length > 30 && (
            sentence.includes('is') ||
            sentence.includes('are') ||
            sentence.includes('means') ||
            sentence.includes('defined as') ||
            sentence.includes('refers to') ||
            sentence.includes('known as')
        ))
        .map(sentence => sentence.trim());

    return keyPoints.slice(0, 10).map((point, index) => {
        const words = point.split(' ').filter(word => word.length > 4);
        const keyTerm = words[Math.floor(Math.random() * words.length)];

        const options = generateMCQOptions(content, point);
        const questionText = generateQuestionText(point, keyTerm);

        return {
            id: index + 1,
            questionNumber: index + 1,
            prize: calculatePrize(index + 1),
            lifelines: {
                fiftyFifty: true,
                audiencePoll: true,
                phoneAFriend: true,
                expertAdvice: true
            },
            question: questionText,
            optionA: options[0],
            optionB: options[1],
            optionC: options[2],
            optionD: options[3],
            correctAnswer: options[0]
        };
    });
}

function calculatePrize(questionNumber) {
    const prizes = [
        1000, 2000, 3000, 5000, 10000,
        20000, 40000, 80000, 160000, 320000
    ];
    return prizes[questionNumber - 1];
}

const quizController = {
    uploadPDF: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    message: "No PDF file uploaded",
                    status: false
                });
            }

            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir);
            }

            const timestamp = Date.now();
            const filename = `pdf_${timestamp}.pdf`;
            const filePath = path.join(uploadsDir, filename);

            fs.writeFileSync(filePath, req.file.buffer);

            const pdfData = await pdfParse(req.file.buffer);
            const content = pdfData.text;

            const topics = content
                .split(/[.!?]/)
                .filter(s => s.length > 30)
                .slice(0, 5)
                .map(s => s.trim())
                .join(', ');

            await db.query('INSERT INTO pdfs (content, file_path, topics) VALUES (?, ?, ?)',
                [content, filePath, topics]);

            res.json({
                message: "PDF uploaded successfully",
                status: true,
                filename: filename,
                topics: topics
            });
        } catch (error) {
            res.status(500).json({
                message: error.message,
                status: false
            });
        }
    },

    generateQuiz: async (req, res) => {
        try {
            const [pdfs] = await db.query('SELECT content, topics FROM pdfs ORDER BY id DESC LIMIT 1');

            if (!pdfs.length) {
                return res.status(404).json({
                    message: "No PDF content found",
                    status: false
                });
            }

            const questions = await generateQuestionsFromContent(pdfs[0].content);

            const formattedQuestions = questions.map(q => ({
                id: q.id,
                questionNumber: q.questionNumber,
                prize: q.prize,
                lifelines: q.lifelines,
                question: q.question,
                options: {
                    A: q.optionA,
                    B: q.optionB,
                    C: q.optionC,
                    D: q.optionD
                },
                correctAnswer: q.correctAnswer
            }));

            const quiz = {
                status: true,
                questions: formattedQuestions,
                topics: pdfs[0].topics,
                totalTime: 600,
                totalPrize: "₹3,20,000"
            };

            await db.query(
                'INSERT INTO quiz_sessions (user_id, questions, start_time, total_time) VALUES (?, ?, ?, ?)',
                [req.user.userId, JSON.stringify(formattedQuestions), new Date().getTime(), quiz.totalTime]
            );

            res.json(quiz);
        } catch (error) {
            console.error('Generate Quiz Error:', error);
            res.status(500).json({
                status: false,
                message: "Failed to generate quiz",
                error: error.message
            });
        }
    },

    submitQuiz: async (req, res) => {
        try {
            const { answers, timeRemaining, currentScore } = req.body; // Add currentScore to received data
            const userId = req.user.userId;

            const validAnswers = Array.isArray(answers) ? answers : [];

            const [sessions] = await db.query(
                'SELECT questions FROM quiz_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT 1',
                [userId]
            );

            if (!sessions.length) {
                return res.status(404).json({
                    message: "Quiz session not found",
                    status: false
                });
            }

            let questions = typeof sessions[0].questions === 'string'
                ? JSON.parse(sessions[0].questions)
                : sessions[0].questions;

            // Use the score from frontend
            const score = currentScore;
            const timeTaken = 600 - (timeRemaining || 0);

            await db.query(
                'INSERT INTO quiz_results (user_id, answers, time_taken, score) VALUES (?, ?, ?, ?)',
                [userId, JSON.stringify(validAnswers), timeTaken, score]
            );

            res.json({
                message: "Quiz submitted successfully",
                score,
                timeTaken,
                prizeMoney: calculatePrize(score),
                status: true
            });
        } catch (error) {
            console.error('Submit Quiz Error:', error);
            res.status(500).json({
                message: "Failed to submit quiz",
                error: error.message,
                status: false
            });
        }
    }
}


function calculateScore(userAnswers, questions) {
    let score = 0;
    userAnswers.forEach(answer => {
        const question = questions.find(q => q.id === answer.questionId);
        if (question && question.correctAnswer === answer.selectedOption) {
            score += 1;
        }
    });
    return score;
}


module.exports = quizController;
