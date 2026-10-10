"""
Retail Intelligence — FastAPI Backend
"""
import io
import logging
import os
from datetime import datetime, timezone

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from database.database import (
    get_analysis_result,
    get_dataset_metadata,
    init_db,
    save_analysis_result,
    save_dataset_metadata,
)
from engine import processor
from engine.demand import get_demand_summary, get_model_info, predict_demand, train_model
from engine.detective import run_investigation
from engine.generator import (
    generate_dataset,
    profile_dataframe,
    save_to_csv,
    save_to_excel,
    validate_uploaded_df,
)
from engine.products import compute_relationships, get_product_list, get_product_relationships
from engine.stores import get_store_summary, investigate_store
from models.schemas import DemandPredictRequest, GenerateDatasetRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Retail Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
EXCEL_PATH = os.path.join(DATA_DIR, "generated_retail_data.xlsx")
CSV_PATH = os.path.join(DATA_DIR, "generated_retail_data.csv")
os.makedirs(DATA_DIR, exist_ok=True)


def _ensure_revenue(df: pd.DataFrame) -> pd.DataFrame:
    if "revenue" not in df.columns and "price" in df.columns and "units_sold" in df.columns:
        disc = df["discount_percent"] if "discount_percent" in df.columns else 0
        df = df.copy()
        df["revenue"] = df["price"] * df["units_sold"] * (1 - disc / 100)
    return df


def _require_df() -> pd.DataFrame:
    df = processor.get_dataframe()
    if df is None:
        raise HTTPException(status_code=404, detail="No dataset loaded. Generate or upload data first.")
    return _ensure_revenue(df)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    messages = []
    for err in exc.errors():
        loc = ".".join(str(x) for x in err.get("loc", []) if x != "body")
        messages.append(f"{loc}: {err.get('msg')}" if loc else str(err.get("msg")))
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages) or "Invalid request."})


@app.on_event("startup")
async def startup():
    init_db()
    if not os.path.exists(EXCEL_PATH):
        logger.info("No dataset found. Generating demo dataset...")
        try:
            df = generate_dataset(records=15000, products=50, stores=10, months=12)
            save_to_excel(df, EXCEL_PATH)
            save_to_csv(df, CSV_PATH)
            processor.set_dataframe(df)
            meta = profile_dataframe(df)
            meta["name"] = "Demo Retail Dataset"
            meta["source"] = "auto-generated"
            save_dataset_metadata(meta)
            logger.info("Demo dataset generated: %s records", len(df))
        except Exception:
            logger.exception("Failed to generate demo dataset")
    else:
        df = processor.get_dataframe()
        if df is not None:
            processor.set_dataframe(df)
            logger.info("Loaded existing dataset: %s records", len(df))


@app.get("/api/health")
def health():
    df = processor.get_dataframe()
    return {
        "status": "ok",
        "dataset_loaded": df is not None,
        "records": int(len(df)) if df is not None else 0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/dataset/generate")
def generate(req: GenerateDatasetRequest):
    try:
        df = generate_dataset(
            records=req.records,
            products=req.products,
            stores=req.stores,
            months=req.months,
        )
        save_to_excel(df, EXCEL_PATH)
        save_to_csv(df, CSV_PATH)
        processor.set_dataframe(df)
        meta = profile_dataframe(df)
        meta["name"] = f"Generated Dataset ({req.records} records)"
        meta["source"] = "generated"
        save_dataset_metadata(meta)
        return {"success": True, "profile": meta}
    except Exception:
        logger.exception("Generation error")
        raise HTTPException(status_code=500, detail="Dataset generation failed. Try fewer records.")


@app.post("/api/dataset/upload")
async def upload(file: UploadFile = File(...)):
    filename = file.filename or ""
    if not filename.lower().endswith((".xlsx", ".csv")):
        raise HTTPException(status_code=400, detail="Only .xlsx and .csv files are supported.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB).")
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        df = processor.read_uploaded_file(content, filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    errors = validate_uploaded_df(df)
    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

    df = _ensure_revenue(df)
    try:
        save_to_excel(df, EXCEL_PATH)
        save_to_csv(df, CSV_PATH)
    except Exception:
        logger.exception("Could not persist uploaded file to disk")

    processor.set_dataframe(df)
    meta = profile_dataframe(df)
    meta["name"] = filename
    meta["source"] = "upload"
    save_dataset_metadata(meta)
    return {"success": True, "profile": meta}


@app.get("/api/dataset/profile")
def dataset_profile():
    df = _require_df()
    meta = get_dataset_metadata()
    if meta:
        return meta
    return profile_dataframe(df)


@app.get("/api/dataset/preview")
def dataset_preview(n: int = Query(100, le=500)):
    df = _require_df()
    return {"columns": list(df.columns), "rows": processor.get_preview(df, n), "total": int(len(df))}


@app.get("/api/dataset/download/xlsx")
def download_xlsx():
    if not os.path.exists(EXCEL_PATH):
        raise HTTPException(status_code=404, detail="No Excel file found. Generate a dataset first.")
    with open(EXCEL_PATH, "rb") as f:
        content = f.read()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=retail_data.xlsx"},
    )


@app.get("/api/dataset/download/csv")
def download_csv():
    df = _require_df()
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=retail_data.csv"},
    )


@app.get("/api/dashboard")
def dashboard():
    df = _require_df()
    total_revenue = float(df["revenue"].sum()) if "revenue" in df.columns else 0.0
    investigation = get_analysis_result("detective")
    if not investigation or not investigation.get("findings"):
        investigation = run_investigation(df)
        save_analysis_result("detective", investigation)

    rels = get_analysis_result("product_relationships")
    if rels and rels.get("relationships"):
        top_pairs = rels["relationships"][:5]
    else:
        computed = compute_relationships(df)
        save_analysis_result("product_relationships", {"relationships": computed})
        top_pairs = computed[:5]

    store_summary = get_store_summary(df)
    attention_stores = [s for s in store_summary if s["status"] in ("NEEDS ATTENTION", "BELOW AVERAGE")][:3]

    daily = df.copy()
    daily["date"] = pd.to_datetime(daily["date"])
    trend = daily.groupby("date")["revenue"].sum().reset_index().sort_values("date")
    trend["date"] = trend["date"].dt.strftime("%Y-%m-%d")
    revenue_trend = trend.tail(30).to_dict(orient="records")

    return {
        "kpis": {
            "total_revenue": round(total_revenue, 2),
            "total_transactions": int(len(df)),
            "unique_products": int(df["product_id"].nunique()),
            "unique_stores": int(df["store_id"].nunique()),
            "active_findings": investigation.get("findings_count", 0),
        },
        "revenue_trend": revenue_trend,
        "top_findings": investigation.get("findings", [])[:3],
        "top_product_pairs": top_pairs,
        "store_alerts": attention_stores,
    }


@app.get("/api/demand/summary")
def demand_summary():
    df = _require_df()
    cached = get_analysis_result("demand_summary")
    if cached and cached.get("avg_daily_demand") is not None:
        cached["model"] = get_model_info()
        return cached
    summary = get_demand_summary(df)
    save_analysis_result("demand_summary", summary)
    return summary


@app.get("/api/demand/trends")
def demand_trends():
    return demand_summary()


@app.post("/api/demand/predict")
def demand_predict(req: DemandPredictRequest):
    df = _require_df()
    try:
        return predict_demand(
            df=df,
            product_id=req.product_id,
            store_id=req.store_id,
            price=req.price,
            discount_percent=req.discount_percent,
            promotion=req.promotion,
            date_str=req.date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Prediction error")
        raise HTTPException(status_code=500, detail="Demand prediction failed.")


@app.get("/api/demand/train")
def demand_train():
    df = _require_df()
    metrics = train_model(df)
    return {"success": True, "metrics": metrics}


@app.get("/api/detective/findings")
def detective_findings(force: bool = False):
    df = _require_df()
    cached = get_analysis_result("detective")
    if cached and not force and cached.get("findings_count", 0) >= 0 and cached.get("findings") is not None:
        return cached
    result = run_investigation(df)
    save_analysis_result("detective", result)
    return result


@app.get("/api/products/list")
def products_list():
    return get_product_list(_require_df())


@app.get("/api/products/relationships")
def all_relationships(limit: int = Query(50, le=200)):
    df = _require_df()
    cached = get_analysis_result("product_relationships")
    if cached and cached.get("relationships"):
        return {"relationships": cached["relationships"][:limit]}
    rels = compute_relationships(df)
    save_analysis_result("product_relationships", {"relationships": rels})
    return {"relationships": rels[:limit]}


@app.get("/api/products/{product_id}/relationships")
def product_relationships(product_id: str):
    return get_product_relationships(_require_df(), product_id)


@app.get("/api/stores/summary")
def stores_summary():
    return get_store_summary(_require_df())


@app.get("/api/stores/{store_id}/investigation")
def store_investigation(store_id: str):
    result = investigate_store(_require_df(), store_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
