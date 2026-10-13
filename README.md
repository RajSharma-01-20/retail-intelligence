# Retail Intelligence

**Retail Intelligence** is a full-stack data science project that turns retail transaction data into practical insights. It helps users explore demand, spot unusual changes, discover products that are often purchased together, and investigate store performance from one dashboard.

The project is designed as a decision-support and learning tool: its analyses help teams decide what to investigate, while final business decisions remain with the people using the data.

## What it can do

- **Demand Intelligence:** explore demand trends and use a Random Forest model to estimate units sold for a selected product, store, and date context.
- **Data Detective:** surface unusual patterns such as a store revenue decline, a product demand spike, abnormal returns, or unusual discounts, with evidence for each finding.
- **Product Relationship Explorer:** analyze transaction baskets to find products that frequently appear together using support, confidence, and relationship strength.
- **Store Performance Investigator:** compare a store with its historical baseline and peer stores, then inspect trends, category mix, average order value, and returns.
- **Dataset Explorer:** generate a sample dataset or upload a CSV/XLSX file to profile and analyze.

## Why it is useful

Retail teams can use the dashboard to identify where demand may be changing, which products merit closer inventory or promotion review, what product combinations may inform merchandising, and which stores deserve further investigation. Students can use it to demonstrate a complete data science workflow, from data ingestion and analysis through model output and an interactive interface.

## How it works

The React and TypeScript frontend sends requests to a Python FastAPI backend. The backend uses Pandas and NumPy for data processing, scikit-learn for demand estimation, and SQLite for local storage.

```text
React + TypeScript dashboard
            ↓ HTTP / JSON
          FastAPI
            ↓
Pandas · NumPy · scikit-learn
            ↓
          SQLite
```

The demand module uses a Random Forest Regressor and displays model metrics in the app. The Data Detective applies rule-based checks to flag patterns for review. Product relationships are calculated from transaction co-occurrence.

## Run locally

You need Python and Node.js installed.

### 1. Install backend dependencies

```bash
cd retail-intelligence/backend
python -m venv .venv
```

Activate the environment, then install the packages:

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```bash
# macOS / Linux
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Install frontend dependencies

In a second terminal:

```bash
cd retail-intelligence/frontend
npm install
```

### 3. Start the app

Run the backend from `retail-intelligence/backend`:

```bash
python -m uvicorn main:app --reload --port 8000
```

Run the frontend from `retail-intelligence/frontend`:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The backend creates a synthetic dataset on first startup, so the dashboard can be explored without supplying data.

## Try the demo dataset

You can upload [`retail-intelligence/demo-retail-upload.csv`](./retail-intelligence/demo-retail-upload.csv) from **Dataset → Upload**. It is a sample dataset for demonstrating the app. The project also generates a larger synthetic dataset on first startup.

For uploaded CSV or Excel files, the required columns are:

`transaction_id`, `date`, `store_id`, `product_id`, `price`, `units_sold`, `category`

## API

The FastAPI service exposes endpoints for health checks, dashboard summaries, dataset generation and upload, demand analysis and prediction, anomaly findings, product relationships, and store investigations. With the backend running, interactive API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

## Project files

- [`retail-intelligence/`](./retail-intelligence/) — application source, setup instructions, and detailed technical documentation.
- [`presentations/retail-intelligence-practical-v2.pptx`](./presentations/retail-intelligence-practical-v2.pptx) — presentation deck for a project walkthrough.
- [`retail-intelligence/demo-retail-upload.csv`](./retail-intelligence/demo-retail-upload.csv) — sample file to upload during a demonstration.

## Technology

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts
- **Backend:** Python, FastAPI
- **Data science:** Pandas, NumPy, scikit-learn
- **Storage:** SQLite
