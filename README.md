# Personal Finance Assistant

A full-stack personal finance management application with receipt processing, data visualization, and multi-user support.

---

## Features

### Core
- Income & Expense Management (add, edit, categorize)
- Interactive Charts & Analytics
- OCR Receipt Processing (images/PDFs)
- Date Range Filtering
- Custom Categories

### Advanced
- Multi-user Authentication (JWT-based)
- Pagination for large datasets
- Bank Statement PDF Parsing
- Real-time Dashboard Insights
- Receipt File Storage & Organization

---

## Architecture

┌─────────────────┐    HTTP/REST    ┌──────────────────┐  
│   React Frontend│◄────────────────►│ Express Backend  │  
│   (Port 3000)   │                 │  (Port 5000)     │  
└─────────────────┘                 └──────────────────┘  
                                             │  
                                             ▼  
                                    ┌──────────────────┐  
                                    │   SQLite DB      │  
                                    │  (finance.db)    │  
                                    └──────────────────┘  
                                             │  
                                             ▼  
                                    ┌──────────────────┐  
                                    │   File Storage   │  
                                    │  (uploads/)      │  
                                    └──────────────────┘  

---

## Prerequisites
- Node.js v16+
- npm v8+
- Git

---

## Installation

### 1. Clone Repository
git clone <repository-url>  
cd personal-finance-assistant  

### 2. Backend Setup
mkdir backend && cd backend  
npm init -y  
npm install express cors sqlite3 multer bcrypt jsonwebtoken tesseract.js pdf-parse  
npm install --save-dev nodemon  
mkdir services  

- Add `server.js` in `backend/`  
- Add OCR logic in `backend/services/ocrService.js`  

### 3. Frontend Setup
cd ..  
npx create-react-app frontend  
cd frontend  
npm install recharts lucide-react  

- Replace `src/App.js` with provided frontend code  
- Add `"proxy": "http://localhost:5000"` in `frontend/package.json`  

---

## Project Structure

personal-finance-assistant/  
├── backend/  
│   ├── services/ocrService.js  
│   ├── uploads/  
│   ├── server.js  
│   ├── package.json  
│   └── finance.db  
├── frontend/  
│   ├── src/App.js  
│   ├── public/  
│   ├── package.json  
└── README.md  

---

## Running

### Development
cd backend  
npm run dev   # http://localhost:5000  

cd frontend  
npm start     # http://localhost:3000  

### Production
cd frontend  
npm run build  

cd ../backend  
npm start  

---

## API Endpoints

### Auth
- POST /api/register – Register user  
- POST /api/login – Login  

### Transactions
- GET /api/transactions – List (filters, pagination)  
- POST /api/transactions – Create  
- GET /api/analytics/overview – Analytics overview  

### Categories
- GET /api/categories – Get categories  

### Receipts
- POST /api/receipts/upload – Upload & process receipt  
- GET /api/receipts – List with receipts  

### System
- GET /api/health – Health check  

---

## Configuration

Create `backend/.env`:

PORT=5000  
NODE_ENV=development  
JWT_SECRET=super-secret-key  
DB_PATH=./finance.db  
UPLOAD_DIR=./uploads  
MAX_FILE_SIZE=10485760  
TESSERACT_LANG=eng  

---

## Usage

1. Register/Login → get JWT token  
2. Add Transactions → manually or via receipt upload  
3. View Dashboard → charts, insights, filters  
4. Receipt Processing → supports PNG, JPG, PDF  

---

## Future Enhancements
- Mobile App (React Native)  
- Bank API Integration  
- Budget Planning & Tracking  
- Investment Portfolio  
- CSV/Excel Export & Import  
- Recurring Transactions  
- Multi-currency Support  

---

## Contributing
1. Fork repo  
2. Create feature branch (`git checkout -b feature/my-feature`)  
3. Commit & push  
4. Open Pull Request  

---


