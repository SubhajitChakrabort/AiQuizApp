const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const authController = {
  register: async (req, res) => {
    try {
      const { username, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await db.query('INSERT INTO users (username, password) VALUES (?, ?)', 
        [username, hashedPassword]
      );

      res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  login: async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
      
      if (users.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, users[0].password);
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { userId: users[0].id, username },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({ token });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = authController;
