# RETAIL INTELLIGENCE

> AI/Data Science powered Retail Decision Intelligence Platform

---

## Overview

**Retail Intelligence** is a full-stack analytical platform that discovers demand patterns, detects anomalies, uncovers product relationships, and investigates store performance — all from a single retail dataset.

---

## Features

### 1. Demand Intelligence
- Analyzes historical retail demand
- Trains a **Random Forest Regressor** model on transaction data
- Predicts demand for any product/store/date combination
- Displays MAE, RMSE, R² model metrics
- Shows daily, monthly, and category demand trends

### 2. Autonomous Data Detective
- Scans the dataset automatically for unusual patterns
- Detects: store revenue drops, product demand spikes, abnormal return rates, unusual discounts, category trend shifts, inventory alerts
- Classifies findings as **CRITICAL**, **WARNING**, or **OBSERVATION**
- Expandable evidence view for each finding

### 3. Product Relationship Explorer
- Computes product co-occurrence from transaction baskets
- Calculates support, confidence, and relationship strength
- Shows top related products per SKU
- Uses association rule mining principles

### 4. Store Performance Investigator
- Deep-dives into each store's performance
- Compares vs historical baseline and peer stores
- Analyzes revenue trends, category breakdown, AOV, return rates
- Generates contextual key findings per store

---

## Architecture

```
React (Vite + TypeScript + Tailwind)
         ↓ HTTP/JSON
FastAPI (Python)
         ↓
Python Analytics Engine (Pandas, NumPy, Scikit-learn)
         ↓
SQLite (retail_intelligence.db)
```

---

## Installation

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## Running

### Backend (Terminal 1)
```bash
cd backend
.venv\Scripts\activate   # Windows
python -m uvicorn main:app --reload --port 8000
```

### Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

Then open: **http://localhost:5173**

Windows convenience scripts (from `retail-intelligence/`):

```bash
start-backend.bat
start-frontend.bat
```

The backend auto-generates a demo dataset on first startup. The dashboard is immediately usable.

---

## Dataset

### Auto-Generated
On first startup, a synthetic dataset of **15,000 transaction records** is generated automatically with:
- 50 products across 5 categories
- 10 stores across major Indian cities
- 12 months of date range
- Realistic patterns: seasonal effects, promotions, weekend uplift
- Deliberate anomalies for the Data Detective to find

### Upload Your Own
Navigate to **Dataset → Upload** to upload `.xlsx` or `.csv` files.

Required columns: `transaction_id`, `date`, `store_id`, `product_id`, `price`, `units_sold`, `category`

---

## ML Model

The Demand Intelligence module uses a **Random Forest Regressor** from scikit-learn with:
- 80 decision trees
- Feature engineering: rolling averages, seasonality, promotions, day-of-week
- Train/test split: 80/20
- Metrics displayed live in the UI

---

## Folder Structure

```
retail-intelligence/
├── frontend/               React + Vite + TypeScript + Tailwind
│   └── src/
│       ├── pages/          Full-page components
│       ├── components/     Reusable UI components
│       ├── services/api.ts API service layer
│       └── utils/          Formatting utilities
│
├── backend/
│   ├── main.py             FastAPI app + all endpoints
│   ├── requirements.txt
│   ├── engine/
│   │   ├── generator.py    Synthetic dataset generator
│   │   ├── demand.py       ML demand model
│   │   ├── detective.py    Anomaly detection engine
│   │   ├── products.py     Product relationship analysis
│   │   └── stores.py       Store investigation engine
│   ├── database/
│   │   └── database.py     SQLite manager
│   └── data/               Generated Excel/CSV files
│
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health check |
| GET | `/api/dashboard` | Overview KPIs + summaries |
| POST | `/api/dataset/generate` | Generate synthetic dataset |
| POST | `/api/dataset/upload` | Upload Excel/CSV |
| GET | `/api/dataset/profile` | Dataset statistics |
| GET | `/api/dataset/preview` | First 100 rows |
| GET | `/api/demand/summary` | Demand trends & KPIs |
| POST | `/api/demand/predict` | Demand prediction |
| GET | `/api/detective/findings` | Anomaly findings |
| GET | `/api/products/relationships` | All product pairs |
| GET | `/api/products/{id}/relationships` | Per-product relationships |
| GET | `/api/stores/summary` | All store performance |
| GET | `/api/stores/{id}/investigation` | Store deep-dive |
