import json
import os
import sqlite3
from typing import Optional

import numpy as np
import pandas as pd

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "retail_intelligence.db")


class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        return super().default(obj)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS dataset_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            source TEXT,
            total_records INTEGER,
            total_columns INTEGER,
            date_range_start TEXT,
            date_range_end TEXT,
            unique_products INTEGER,
            unique_stores INTEGER,
            total_sales REAL,
            missing_values INTEGER,
            duplicate_records INTEGER,
            avg_transaction_value REAL,
            created_at TEXT DEFAULT (datetime('now')),
            extra_json TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS analysis_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_type TEXT,
            result_json TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            product_id TEXT PRIMARY KEY,
            product_name TEXT,
            category TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS stores (
            store_id TEXT PRIMARY KEY,
            store_name TEXT,
            city TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id TEXT,
            date TEXT,
            store_id TEXT,
            store_name TEXT,
            city TEXT,
            product_id TEXT,
            product_name TEXT,
            category TEXT,
            price REAL,
            discount_percent REAL,
            promotion INTEGER,
            holiday INTEGER,
            day_of_week INTEGER,
            units_sold INTEGER,
            inventory_level INTEGER,
            customer_segment TEXT,
            payment_method TEXT,
            return_flag INTEGER,
            revenue REAL
        )
    """)

    conn.commit()
    conn.close()


def save_dataset_metadata(meta: dict):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM dataset_metadata")
    cur.execute("""
        INSERT INTO dataset_metadata
            (name, source, total_records, total_columns, date_range_start, date_range_end,
             unique_products, unique_stores, total_sales, missing_values, duplicate_records,
             avg_transaction_value, extra_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        meta.get("name", ""),
        meta.get("source", ""),
        meta.get("total_records", 0),
        meta.get("total_columns", 0),
        meta.get("date_range_start", ""),
        meta.get("date_range_end", ""),
        meta.get("unique_products", 0),
        meta.get("unique_stores", 0),
        meta.get("total_sales", 0.0),
        meta.get("missing_values", 0),
        meta.get("duplicate_records", 0),
        meta.get("avg_transaction_value", 0.0),
        json.dumps(meta.get("extra", {}), cls=NpEncoder),
    ))
    conn.commit()
    conn.close()


def get_dataset_metadata() -> Optional[dict]:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM dataset_metadata ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    if row:
        d = dict(row)
        d["extra"] = json.loads(d.get("extra_json") or "{}")
        return d
    return None


def persist_dataset(df: pd.DataFrame):
    """Store the current dataset in SQLite without SQLAlchemy."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM products")
    cur.execute("DELETE FROM stores")
    cur.execute("DELETE FROM transactions")

    if "product_id" in df.columns:
        prod_cols = [c for c in ["product_id", "product_name", "category"] if c in df.columns]
        products = df[prod_cols].drop_duplicates("product_id")
        for rec in products.itertuples(index=False):
            cur.execute(
                "INSERT OR REPLACE INTO products (product_id, product_name, category) VALUES (?,?,?)",
                (
                    str(rec[0]),
                    str(rec[1]) if len(rec) > 1 else "",
                    str(rec[2]) if len(rec) > 2 else "",
                ),
            )

    if "store_id" in df.columns:
        store_cols = [c for c in ["store_id", "store_name", "city"] if c in df.columns]
        stores = df[store_cols].drop_duplicates("store_id")
        for rec in stores.itertuples(index=False):
            cur.execute(
                "INSERT OR REPLACE INTO stores (store_id, store_name, city) VALUES (?,?,?)",
                (
                    str(rec[0]),
                    str(rec[1]) if len(rec) > 1 else "",
                    str(rec[2]) if len(rec) > 2 else "",
                ),
            )

    cols = [
        "transaction_id", "date", "store_id", "store_name", "city",
        "product_id", "product_name", "category", "price", "discount_percent",
        "promotion", "holiday", "day_of_week", "units_sold", "inventory_level",
        "customer_segment", "payment_method", "return_flag", "revenue",
    ]
    placeholders = ",".join(["?"] * len(cols))
    insert_sql = f"INSERT INTO transactions ({','.join(cols)}) VALUES ({placeholders})"

    work = df.copy()
    for c in cols:
        if c not in work.columns:
            work[c] = None

    records = []
    for row in work[cols].itertuples(index=False):
        cleaned = []
        for v in row:
            try:
                missing = v is None or (not isinstance(v, (list, dict, bytes)) and pd.isna(v))
            except (ValueError, TypeError):
                missing = False
            if missing:
                cleaned.append(None)
            elif isinstance(v, (np.integer,)):
                cleaned.append(int(v))
            elif isinstance(v, (np.floating,)):
                cleaned.append(float(v))
            else:
                cleaned.append(v)
        records.append(tuple(cleaned))

    cur.executemany(insert_sql, records)
    conn.commit()
    conn.close()


def save_analysis_result(analysis_type: str, result: dict):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM analysis_results WHERE analysis_type=?", (analysis_type,))
    cur.execute(
        "INSERT INTO analysis_results (analysis_type, result_json) VALUES (?,?)",
        (analysis_type, json.dumps(result, cls=NpEncoder)),
    )
    conn.commit()
    conn.close()


def get_analysis_result(analysis_type: str) -> Optional[dict]:
    conn = get_connection()
    cur = conn.cursor()
    row = cur.execute(
        "SELECT result_json FROM analysis_results WHERE analysis_type=? ORDER BY id DESC LIMIT 1",
        (analysis_type,),
    ).fetchone()
    conn.close()
    if row:
        return json.loads(row["result_json"])
    return None


def clear_analysis_results():
    conn = get_connection()
    conn.execute("DELETE FROM analysis_results")
    conn.commit()
    conn.close()
