const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize SQLite database
const db = new sqlite3.Database('./finance.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});

// Database initialization
function initializeDatabase() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      receipt_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
      color TEXT DEFAULT '#3B82F6'
    )`
  ];

  tables.forEach(sql => {
    db.run(sql, (err) => {
      if (err) console.error('Error creating table:', err.message);
    });
  });

  // Insert default categories
  const defaultCategories = [
    ['Food & Dining', 'expense', '#EF4444'],
    ['Transportation', 'expense', '#F97316'],
    ['Shopping', 'expense', '#8B5CF6'],
    ['Entertainment', 'expense', '#EC4899'],
    ['Bills & Utilities', 'expense', '#6B7280'],
    ['Healthcare', 'expense', '#10B981'],
    ['Salary', 'income', '#22C55E'],
    ['Freelance', 'income', '#3B82F6'],
    ['Investment', 'income', '#F59E0B']
  ];

  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, type, color) VALUES (?, ?, ?)');
  defaultCategories.forEach(([name, type, color]) => {
    insertCategory.run(name, type, color);
  });
  insertCategory.finalize();
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }
        
        const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET);
        res.status(201).json({ token, user: { id: this.lastID, username, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  });
});

// Transaction routes
app.post('/api/transactions', authenticateToken, (req, res) => {
  const { type, amount, category, description, date } = req.body;
  const userId = req.user.id;

  if (!type || !amount || !category || !date) {
    return res.status(400).json({ error: 'Type, amount, category, and date are required' });
  }

  db.run(
    'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, type, amount, category, description, date],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create transaction' });
      }
      res.status(201).json({ 
        id: this.lastID, 
        type, 
        amount, 
        category, 
        description, 
        date,
        user_id: userId 
      });
    }
  );
});

app.get('/api/transactions', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate, type, category, page = 1, limit = 50 } = req.query;
  
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [userId];

  if (startDate) {
    sql += ' AND date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ' AND date <= ?';
    params.push(endDate);
  }
  
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY date DESC, created_at DESC';
  
  // Add pagination
  const offset = (page - 1) * limit;
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?';
    const countParams = [userId];
    
    if (startDate) {
      countSql += ' AND date >= ?';
      countParams.push(startDate);
    }
    if (endDate) {
      countSql += ' AND date <= ?';
      countParams.push(endDate);
    }
    if (type) {
      countSql += ' AND type = ?';
      countParams.push(type);
    }
    if (category) {
      countSql += ' AND category = ?';
      countParams.push(category);
    }

    db.get(countSql, countParams, (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch transaction count' });
      }
      
      const total = countResult.total;
      const totalPages = Math.ceil(total / limit);
      
      res.json({
        transactions: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    });
  });
});

// Analytics routes
app.get('/api/analytics/overview', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.query;
  
  let dateFilter = '';
  const params = [userId];
  
  if (startDate && endDate) {
    dateFilter = ' AND date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const queries = {
    totalIncome: `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income'${dateFilter}`,
    totalExpenses: `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense'${dateFilter}`,
    expensesByCategory: `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense'${dateFilter} GROUP BY category ORDER BY total DESC`,
    monthlyTrends: `SELECT 
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions 
      WHERE user_id = ?${dateFilter}
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month`
  };

  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, sql]) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: `Failed to fetch ${key}` });
      }
      
      if (key === 'totalIncome' || key === 'totalExpenses') {
        results[key] = rows[0].total;
      } else {
        results[key] = rows;
      }
      
      completed++;
      if (completed === totalQueries) {
        results.netIncome = results.totalIncome - results.totalExpenses;
        res.json(results);
      }
    });
  });
});

// Receipt upload and processing
app.post('/api/receipts/upload', authenticateToken, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Here you would integrate OCR processing
    // For now, we'll return the file path and let the frontend handle manual entry
    const receiptData = {
      filename: req.file.filename,
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    };

    // TODO: Integrate OCR library like Tesseract.js or Google Vision API
    // const extractedText = await processReceiptWithOCR(req.file.path);
    
    res.json({
      receipt: receiptData,
      message: 'Receipt uploaded successfully. Please review and confirm the extracted data.'
      // extractedData: extractedText // Would contain parsed amount, merchant, date, etc.
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process receipt' });
  }
});

// Categories routes
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY type, name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
    res.json(rows);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Finance API server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
app.get('/api/analytics/overview', async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const transactions = await db.all(
      `SELECT * FROM transactions WHERE date BETWEEN ? AND ?`,
      [startDate || '1970-01-01', endDate || '9999-12-31']
    );

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const categoryMap = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      if (!categoryMap[t.category]) categoryMap[t.category] = 0;
      categoryMap[t.category] += t.amount;
    });

    const expensesByCategory = Object.keys(categoryMap).map(cat => ({
      category: cat,
      total: categoryMap[cat]
    }));

    const monthMap = {};
    transactions.forEach(t => {
      const month = t.date.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { month, income: 0, expenses: 0 };
      monthMap[month][t.type] += t.amount;
    });

    const monthlyTrends = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
      expensesByCategory,
      monthlyTrends
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
