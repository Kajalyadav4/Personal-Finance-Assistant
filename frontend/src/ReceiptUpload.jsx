const pdfParse = require('pdf-parse');
const fs = require('fs');

class TransactionHistoryProcessor {
  constructor() {
    // Common patterns for different bank statement formats
    this.patterns = {
      // Date patterns (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
      date: [
        /(\d{1,2}\/\d{1,2}\/\d{4})/g,
        /(\d{1,2}-\d{1,2}-\d{4})/g,
        /(\d{4}-\d{1,2}-\d{1,2})/g
      ],
      
      // Amount patterns ($123.45, -$123.45, 123.45-)
      amount: [
        /\$(\d+,?\d*\.?\d*)/g,
        /(\d+,?\d*\.?\d*)\s*CR/g,
        /(\d+,?\d*\.?\d*)\s*DR/g,
        /-\$?(\d+,?\d*\.?\d*)/g,
        /(\d+,?\d*\.?\d*)-/g
      ],
      
      // Transaction description patterns
      description: /^([A-Za-z0-9\s\*\#\-\.]+)/,
      
      // Balance patterns
      balance: /(?:balance|bal)[:\s]*\$?(\d+,?\d*\.?\d*)/i
    };

    // Category mapping based on common transaction descriptions
    this.categoryMappings = {
      'ATM': 'Cash',
      'DEPOSIT': 'Income',
      'PAYROLL': 'Salary',
      'GROCERY': 'Food & Dining',
      'RESTAURANT': 'Food & Dining',
      'GAS': 'Transportation',
      'FUEL': 'Transportation',
      'PHARMACY': 'Healthcare',
      'MEDICAL': 'Healthcare',
      'RENT': 'Bills & Utilities',
      'ELECTRIC': 'Bills & Utilities',
      'UTILITY': 'Bills & Utilities',
      'AMAZON': 'Shopping',
      'TARGET': 'Shopping',
      'WALMART': 'Shopping',
      'NETFLIX': 'Entertainment',
      'SPOTIFY': 'Entertainment'
    };
  }

  async processPDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      const transactions = this.parseTransactionText(pdfData.text);
      
      return {
        success: true,
        transactions,
        rawText: pdfData.text,
        summary: {
          totalTransactions: transactions.length,
          totalDebits: transactions.filter(t => t.type === 'expense').length,
          totalCredits: transactions.filter(t => t.type === 'income').length,
          dateRange: this.getDateRange(transactions)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        transactions: []
      };
    }
  }

  parseTransactionText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const transactions = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const transaction = this.parseTransactionLine(line);
      
      if (transaction) {
        transactions.push(transaction);
      }
    }

    // Post-process to clean up and validate transactions
    return this.cleanupTransactions(transactions);
  }

  parseTransactionLine(line) {
    // Skip header lines and non-transaction lines
    if (this.isHeaderLine(line) || this.isBalanceLine(line)) {
      return null;
    }

    const transaction = {
      date: null,
      description: null,
      amount: null,
      type: null,
      category: null,
      raw_line: line
    };

    // Extract date
    for (const datePattern of this.patterns.date) {
      const dateMatch = line.match(datePattern);
      if (dateMatch) {
        transaction.date = this.normalizeDate(dateMatch[1]);
        break;
      }
    }

    // Extract amount
    let isDebit = false;
    let isCredit = false;
    
    for (const amountPattern of this.patterns.amount) {
      const amountMatches = [...line.matchAll(amountPattern)];
      if (amountMatches.length > 0) {
        // Take the last amount match (usually the transaction amount)
        const lastMatch = amountMatches[amountMatches.length - 1];
        let amountStr = lastMatch[1];
        
        // Clean up amount string
        amountStr = amountStr.replace(/,/g, '');
        transaction.amount = parseFloat(amountStr);
        
        // Determine if it's debit or credit based on context
        if (line.includes('DR') || line.includes('-') || amountPattern.toString().includes('-')) {
          isDebit = true;
        } else if (line.includes('CR') || line.includes('DEPOSIT')) {
          isCredit = true;
        }
        break;
      }
    }

    // Extract description (everything before the amount)
    if (transaction.amount) {
      const amountIndex = line.lastIndexOf(transaction.amount.toString());
      if (amountIndex > 0) {
        transaction.description = line.substring(0, amountIndex).trim();
        // Remove date from description if present
        if (transaction.date) {
          transaction.description = transaction.description.replace(transaction.date, '').trim();
        }
        // Clean up description
        transaction.description = this.cleanupDescription(transaction.description);
      }
    }

    // Determine transaction type
    if (transaction.amount && transaction.description) {
      if (isCredit || this.isIncomeDescription(transaction.description)) {
        transaction.type = 'income';
      } else {
        transaction.type = 'expense';
      }

      // Suggest category
      transaction.category = this.suggestCategory(transaction.description);

      return transaction;
    }

    return null;
  }

  isHeaderLine(line) {
    const headerKeywords = [
      'DATE', 'DESCRIPTION', 'AMOUNT', 'BALANCE', 'TRANSACTION',
      'ACCOUNT', 'STATEMENT', 'PERIOD', 'PAGE', 'SUMMARY'
    ];
    
    const upperLine = line.toUpperCase();
    return headerKeywords.some(keyword => upperLine.includes(keyword)) &&
           !this.patterns.amount.some(pattern => pattern.test(line));
  }

  isBalanceLine(line) {
    return /(?:balance|bal|total)[:\s]*\$?\d+/i.test(line) &&
           !/(?:available|pending)/i.test(line);
  }

  isIncomeDescription(description) {
    const incomeKeywords = [
      'DEPOSIT', 'PAYROLL', 'SALARY', 'WAGE', 'INCOME', 'REFUND',
      'DIVIDEND', 'INTEREST', 'BONUS', 'COMMISSION'
    ];
    
    const upperDesc = description.toUpperCase();
    return incomeKeywords.some(keyword => upperDesc.includes(keyword));
  }

  cleanupDescription(description) {
    // Remove common prefixes and suffixes
    let cleaned = description
      .replace(/^\d+\s*/, '') // Remove leading numbers
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\*+/g, '') // Remove asterisks
      .replace(/#\d+/g, '') // Remove reference numbers
      .trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    }

    return cleaned;
  }

  suggestCategory(description) {
    const upperDesc = description.toUpperCase();
    
    for (const [keyword, category] of Object.entries(this.categoryMappings)) {
      if (upperDesc.includes(keyword)) {
        return category;
      }
    }

    // Default category based on amount patterns
    if (upperDesc.includes('TRANSFER') || upperDesc.includes('PAYMENT')) {
      return 'Transfer';
    }

    return 'Other';
  }

  normalizeDate(dateString) {
    try {
      // Handle different date formats
      let date;
      
      if (dateString.includes('/')) {
        // MM/DD/YYYY or DD/MM/YYYY format
        const parts = dateString.split('/');
        if (parts.length === 3) {
          // Assume MM/DD/YYYY format (adjust based on your region)
          date = new Date(parts[2], parts[0] - 1, parts[1]);
        }
      } else if (dateString.includes('-')) {
        // YYYY-MM-DD or DD-MM-YYYY format
        const parts = dateString.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD format
            date = new Date(parts[0], parts[1] - 1, parts[2]);
          } else {
            // DD-MM-YYYY format
            date = new Date(parts[2], parts[1] - 1, parts[0]);
          }
        }
      }

      if (date && !isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
      }
    } catch (error) {
      console.error('Error normalizing date:', error);
    }
    
    return null;
  }

  cleanupTransactions(transactions) {
    return transactions
      .filter(t => t.date && t.amount && t.description) // Remove invalid transactions
      .filter(t => t.amount > 0) // Remove zero amounts
      .map(t => ({
        ...t,
        description: t.description || 'Unknown Transaction',
        category: t.category || 'Other'
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date
  }

  getDateRange(transactions) {
    if (transactions.length === 0) return null;
    
    const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a - b);
    return {
      start: dates[0].toISOString().split('T')[0],
      end: dates[dates.length - 1].toISOString().split('T')[0]
    };
  }

  // Validate and prepare transactions for database insertion
  prepareForDatabase(transactions, userId) {
    return transactions.map(t => ({
      user_id: userId,
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      date: t.date,
      receipt_path: null // PDF processing doesn't have individual receipts
    }));
  }
}

module.exports = new TransactionHistoryProcessor();