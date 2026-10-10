"""
Data processor — loads dataset from file or memory.
"""
import io
import os

import pandas as pd

_current_df: pd.DataFrame | None = None
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
EXCEL_PATH = os.path.join(DATA_DIR, "generated_retail_data.xlsx")


def set_dataframe(df: pd.DataFrame):
    global _current_df
    _current_df = df
    from engine.demand import reset_model
    reset_model()
    try:
        from database.database import persist_dataset, clear_analysis_results
        persist_dataset(df)
        clear_analysis_results()
    except Exception:
        pass


def get_dataframe() -> pd.DataFrame | None:
    global _current_df
    if _current_df is not None:
        return _current_df
    if os.path.exists(EXCEL_PATH):
        _current_df = pd.read_excel(EXCEL_PATH, engine="openpyxl")
        return _current_df
    return None


def read_uploaded_file(content: bytes, filename: str) -> pd.DataFrame:
    lower = filename.lower()
    if lower.endswith(".xlsx"):
        return pd.read_excel(io.BytesIO(content), engine="openpyxl")
    if lower.endswith(".csv"):
        return pd.read_csv(io.BytesIO(content))
    raise ValueError(f"Unsupported file type: {filename}")


def get_preview(df: pd.DataFrame, n: int = 100) -> list:
    preview = df.head(n).copy()
    preview = preview.where(pd.notnull(preview), None)
    rows = []
    for rec in preview.to_dict(orient="records"):
        clean = {}
        for k, v in rec.items():
            if hasattr(v, "isoformat"):
                clean[k] = v.isoformat()[:10] if hasattr(v, "year") else str(v)
            else:
                clean[k] = v
        rows.append(clean)
    return rows
