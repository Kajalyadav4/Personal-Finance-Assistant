import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { PlusCircle, Upload, DollarSign, TrendingUp, TrendingDown, Calendar, Filter, User, LogOut, Receipt, CreditCard } from 'lucide-react';
import './App.css';
// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Utility functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
}; 

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN');
};

// Authentication Context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      // Verify token is still valid
      fetch(`${API_BASE_URL}/transactions?limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(response => {
        if (!response.ok) {
          logout();
        }
      }).catch(() => logout());
    }
  }, [token]);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

// API Service
class ApiService {
  constructor(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Something went wrong');
    }

    return response.json();
  }

  // Auth methods
  async register(username, email, password) {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(username, password) {
    return this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  // Transaction methods
  async getTransactions(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/transactions?${params}`);
  }

  async createTransaction(transaction) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });
  }

  // Analytics methods
  async getAnalytics(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/analytics/overview?${params}`);
  }

  // Categories methods
  async getCategories() {
    return this.request('/categories');
  }

  // Receipt methods
  async uploadReceipt(file) {
    const formData = new FormData();
    formData.append('receipt', file);
    
    return this.request('/receipts/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set boundary
    });
  }
}

// Enhanced Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong!</h2>
          <p>Please refresh the page and try again.</p>
          <button onClick={() => window.location.reload()} className="btn">
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced Loading Component
const LoadingSpinner = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <p>Loading...</p>
  </div>
);

// Login Component with better validation
const LoginForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { login } = useAuth();

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!isLogin && !formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isLogin && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isLogin && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const api = new ApiService();
      const result = isLogin 
        ? await api.login(formData.username, formData.password)
        : await api.register(formData.username, formData.email, formData.password);
      
      login(result.token, result.user);
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <DollarSign className="icon" />
          <h1>Personal Finance Assistant</h1>
          <p>{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div>
            <label className="input-label">Username</label>
            <input
              type="text"
              required
              className={`input-field ${errors.username ? 'error' : ''}`}
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
            {errors.username && <span className="error-text">{errors.username}</span>}
          </div>

          {!isLogin && (
            <div>
              <label className="input-label">Email</label>
              <input
                type="email"
                required
                className={`input-field ${errors.email ? 'error' : ''}`}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>
          )}

          <div>
            <label className="input-label">Password</label>
            <input
              type="password"
              required
              className={`input-field ${errors.password ? 'error' : ''}`}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          {errors.general && <div className="error-box">{errors.general}</div>}

          <button type="submit" disabled={loading} className="btn">
            {loading ? <LoadingSpinner /> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="toggle-btn">
            {isLogin ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced Transaction Form
const TransactionForm = ({ onSuccess, categories }) => {
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { token } = useAuth();

  const validateForm = () => {
    const newErrors = {};

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const api = new ApiService(token);
      await api.createTransaction(formData);
      setFormData({
        type: 'expense',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      setErrors({});
      onSuccess();
      
      // Show success message
      alert('Transaction added successfully!');
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(cat => cat.type === formData.type);

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <h3>
        <PlusCircle className="icon" />
        Add Transaction
      </h3>

      <div className="form-grid">
        <div>
          <label className="input-label">Type</label>
          <select
            className="input-field"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value, category: '' })}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div>
          <label className="input-label">Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            required
            className={`input-field ${errors.amount ? 'error' : ''}`}
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />
          {errors.amount && <span className="error-text">{errors.amount}</span>}
        </div>

        <div>
          <label className="input-label">Category</label>
          <select
            required
            className={`input-field ${errors.category ? 'error' : ''}`}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="">Select category</option>
            {filteredCategories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          {errors.category && <span className="error-text">{errors.category}</span>}
        </div>

        <div>
          <label className="input-label">Date</label>
          <input
            type="date"
            required
            className={`input-field ${errors.date ? 'error' : ''}`}
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
          {errors.date && <span className="error-text">{errors.date}</span>}
        </div>
      </div>

      <div className="description-input">
        <label className="input-label">Description</label>
        <input
          type="text"
          className="input-field"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
        />
      </div>

      {errors.general && <div className="error-box">{errors.general}</div>}

      <button type="submit" disabled={loading} className="btn">
        {loading ? 'Adding...' : 'Add Transaction'}
      </button>
    </form>
  );
};

// Enhanced Dashboard Component
const Dashboard = ({ analytics, onRefresh }) => {
  if (!analytics) {
    return (
      <div className="skeleton-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-line short"></div>
            <div className="skeleton-line long"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { 
      title: 'Total Income',
      value: analytics.totalIncome || 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Total Expenses',
      value: analytics.totalExpenses || 0,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Net Income',
      value: analytics.netIncome || 0,
      icon: DollarSign,
      color: (analytics.netIncome || 0) >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: (analytics.netIncome || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'
    }
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-cards">
        {cards.map((card, index) => (
          <div key={index} className={`card ${card.bgColor}`}>
            <div className="card-header">
              <div>
                <p className="card-title">{card.title}</p>
                <p className={`card-value ${card.color}`}>
                  {formatCurrency(card.value)}
                </p>
              </div>
              <card.icon className={`card-icon ${card.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="dashboard-charts">
        {/* Expenses by Category */}
        <div className="chart-card">
          <h3 className="chart-title">Expenses by Category</h3>
          {analytics.expensesByCategory && analytics.expensesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.expensesByCategory}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ category, percent }) =>
                    `${category} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {analytics.expensesByCategory.map((entry, index) => (
                    <Cell key={index} fill={`hsl(${index * 45}, 70%, 60%)`} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No expense data available</div>
          )}
        </div>

        {/* Monthly Trends */}
        <div className="chart-card">
          <h3 className="chart-title">Monthly Trends</h3>
          {analytics.monthlyTrends && analytics.monthlyTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `₹${value}`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No trend data available</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced Transaction List Component
const TransactionList = ({ transactions, loading }) => {
  if (loading) {
    return (
      <div className="skeleton-container">
        <div className="skeleton-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-item">
              <div className="skeleton-avatar"></div>
              <div className="skeleton-info">
                <div className="skeleton-line short"></div>
                <div className="skeleton-line long"></div>
              </div>
              <div className="skeleton-amount"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No transactions found</p>
        <p className="text-gray-500 text-sm mt-2">Add your first transaction to get started</p>
      </div>
    );
  }

  return (
    <div className="transactions-card">
      <div className="transactions-header">
        <h3>Recent Transactions ({transactions.length})</h3>
      </div>
      <div className="transactions-list">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="transaction-row">
            <div className="transaction-left">
              <div
                className={`transaction-icon ${
                  transaction.type === "income"
                    ? "income-bg"
                    : "expense-bg"
                }`}
              >
                {transaction.type === "income" ? (
                  <TrendingUp className="icon income-color" />
                ) : (
                  <TrendingDown className="icon expense-color" />
                )}
              </div>
              <div>
                <p className="transaction-title">
                  {transaction.description || transaction.category}
                </p>
                <p className="transaction-subtitle">
                  {transaction.category} • {formatDate(transaction.date)}
                </p>
              </div>
            </div>
            <div className="transaction-right">
              <p
                className={`transaction-amount ${
                  transaction.type === "income"
                    ? "income-color"
                    : "expense-color"
                }`}
              >
                {transaction.type === "income" ? "+" : "-"}
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Enhanced Filters Component
const FilterBar = ({ filters, onFiltersChange, categories }) => {
  const [showFilters, setShowFilters] = useState(false);

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(value => value);

  return (
    <div className="filters-card">
      <div className="filters-header">
        <h3 className="filters-title">
          <Filter className="filter-icon" />
          Filters
          {hasActiveFilters && <span className="active-filters-badge">Active</span>}
        </h3>
        <div className="filters-actions">
          {hasActiveFilters && (
            <button onClick={clearFilters} className="clear-filters-btn">
              Clear
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="filters-toggle"
          >
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filters-grid">
          <div>
            <label className="filters-label">Start Date</label>
            <input
              type="date"
              className="filters-input"
              value={filters.startDate || ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, startDate: e.target.value })
              }
            />
          </div>

          <div>
            <label className="filters-label">End Date</label>
            <input
              type="date"
              className="filters-input"
              value={filters.endDate || ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, endDate: e.target.value })
              }
            />
          </div>

          <div>
            <label className="filters-label">Type</label>
            <select
              className="filters-input"
              value={filters.type || ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, type: e.target.value })
              }
            >
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          <div>
            <label className="filters-label">Category</label>
            <select
              className="filters-input"
              value={filters.category || ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, category: e.target.value })
              }
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Receipt Upload Component
const ReceiptUpload = ({ onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const { token } = useAuth();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (validTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please select a JPEG, PNG, or PDF file');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const api = new ApiService(token);
      const response = await api.uploadReceipt(file);
      setResult(response);
      onSuccess && onSuccess();
    } catch (error) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="receipt-upload">
      <div className="upload-card">
        <h3>
          <Upload className="icon" />
          Upload Receipt
        </h3>
        
        <div className="upload-area">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="file-input"
          />
          
          {file && (
            <div className="file-selected">
              <p>Selected: {file.name}</p>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn"
              >
                {uploading ? 'Uploading...' : 'Upload Receipt'}
              </button>
            </div>
          )}
        </div>

        {error && <div className="error-box">{error}</div>}
        
        {result && (
          <div className="success-box">
            <p>Receipt uploaded successfully!</p>
            <p>{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
const FinanceApp = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [error, setError] = useState('');
  const { user, logout, token } = useAuth();

  const api = new ApiService(token);

  // Load initial data
  useEffect(() => {
    loadCategories();
    loadData();
  }, []);

  // Reload data when filters change
  useEffect(() => {
    if (currentView === 'transactions') {
      loadTransactions();
    } else if (currentView === 'dashboard') {
      loadAnalytics();
    }
  }, [filters, currentView]);

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      setError('Failed to load categories');
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTransactions(filters);
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAnalytics(filters.startDate, filters.endDate);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadData = () => {
    if (currentView === 'dashboard') {
      loadAnalytics();
    } else if (currentView === 'transactions') {
      loadTransactions();
    }
  };

  const handleRefresh = () => {
    loadAnalytics();
    loadTransactions();
    loadCategories();
  };

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: DollarSign },
    { id: 'transactions', name: 'Transactions', icon: CreditCard },
    { id: 'add', name: 'Add Transaction', icon: PlusCircle },
    { id: 'upload', name: 'Upload Receipt', icon: Upload },
  ];

  return (
    <ErrorBoundary>
      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="header-inner">
            <div className="header-left">
              <DollarSign className="logo-icon" />
              <h1 className="app-title">Personal Finance Assistant</h1>
            </div>
            <div className="header-right">
              <span className="welcome-text">Welcome, {user?.username}</span>
              <button onClick={logout} className="logout-btn">
                <LogOut className="logout-icon" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="app-nav">
          <div className="nav-inner">
            <div className="nav-items">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                >
                  <item.icon className="nav-icon" />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="main-content">
          {error && (
            <div className="error-banner">
              <p>{error}</p>
              <button onClick={() => setError('')}>×</button>
            </div>
          )}

          {currentView === 'dashboard' && (
            <div>
              <div className="section-header">
                <h2 className="section-title">Dashboard</h2>
                <button onClick={handleRefresh} className="primary-btn" disabled={loading}>
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <FilterBar
                filters={filters}
                onFiltersChange={setFilters}
                categories={categories}
              />
              <Dashboard analytics={analytics} onRefresh={handleRefresh} />
            </div>
          )}

          {currentView === 'transactions' && (
            <div>
              <div className="section-header">
                <h2 className="section-title">Transactions</h2>
              </div>
              <FilterBar
                filters={filters}
                onFiltersChange={setFilters}
                categories={categories}
              />
              <TransactionList transactions={transactions} loading={loading} />
            </div>
          )}

          {currentView === 'add' && (
            <div>
              <div className="section-header">
                <h2 className="section-title">Add Transaction</h2>
              </div>
              <TransactionForm categories={categories} onSuccess={handleRefresh} />
            </div>
          )}

          {currentView === 'upload' && (
            <div>
              <div className="section-header">
                <h2 className="section-title">Upload Receipt</h2>
              </div>
              <ReceiptUpload onSuccess={handleRefresh} />
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
};

// Root App Component
const App = () => {
  return (
    <AuthProvider>
      <div className="App">
        <AuthConsumer />
      </div>
    </AuthProvider>
  );
};

const AuthConsumer = () => {
  const { isAuthenticated } = useAuth();
  
  return isAuthenticated ? <FinanceApp /> : <LoginForm />;
};

export default App;