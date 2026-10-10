"""
Synthetic Retail Dataset Generator
Produces a realistic, pattern-rich retail dataset for analysis.
"""
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

SEED = 42

CATEGORIES = {
    "Electronics": [
        "Laptop", "Smartphone", "Wireless Mouse", "Keyboard", "Headphones",
        "USB Hub", "Webcam", "Tablet", "Smartwatch", "Laptop Sleeve",
    ],
    "Office Supplies": [
        "Notebook", "Ballpoint Pen", "Stapler", "Desk Organizer", "Printer Paper",
        "Sticky Notes", "File Folder", "Whiteboard Marker", "Tape Dispenser", "Scissors",
    ],
    "Clothing": [
        "T-Shirt", "Jeans", "Jacket", "Running Shoes", "Casual Sneakers",
        "Formal Shirt", "Polo Shirt", "Hoodie", "Cap", "Socks (Pack of 6)",
    ],
    "Food & Beverage": [
        "Coffee Beans (500g)", "Green Tea (100 bags)", "Dark Chocolate Bar",
        "Protein Bar (Box)", "Instant Noodles (12pk)", "Oat Milk (1L)",
        "Granola (400g)", "Energy Drink (6pk)", "Mixed Nuts (250g)", "Honey (500g)",
    ],
    "Home & Garden": [
        "Desk Lamp", "Air Purifier", "Yoga Mat", "Water Bottle",
        "Coffee Mug", "Throw Pillow", "Wall Clock", "Picture Frame",
        "Plant Pot", "Storage Box",
    ],
}

BUNDLES = [
    ["Laptop", "Wireless Mouse", "Laptop Sleeve", "USB Hub", "Keyboard", "Webcam"],
    ["Smartphone", "Headphones", "Smartwatch"],
    ["T-Shirt", "Jeans", "Casual Sneakers", "Cap"],
    ["Coffee Beans (500g)", "Coffee Mug", "Dark Chocolate Bar"],
    ["Notebook", "Ballpoint Pen", "Sticky Notes", "File Folder"],
    ["Yoga Mat", "Water Bottle", "Running Shoes"],
]

CITIES = [
    ("Mumbai", "MH"), ("Delhi", "DL"), ("Bangalore", "KA"), ("Hyderabad", "TS"),
    ("Chennai", "TN"), ("Kolkata", "WB"), ("Pune", "MH"), ("Ahmedabad", "GJ"),
    ("Jaipur", "RJ"), ("Surat", "GJ"),
]

CUSTOMER_SEGMENTS = ["Premium", "Regular", "Budget", "Corporate"]
PAYMENT_METHODS = ["Credit Card", "Debit Card", "UPI", "Cash", "Net Banking"]

CATEGORY_BASE_PRICES = {
    "Electronics": (1200, 85000),
    "Office Supplies": (20, 1500),
    "Clothing": (299, 5999),
    "Food & Beverage": (50, 999),
    "Home & Garden": (150, 12000),
}

STORE_MULTIPLIERS = {
    0: 1.25, 1: 1.10, 2: 0.95, 3: 1.05, 4: 0.78,
    5: 1.15, 6: 1.00, 7: 0.68, 8: 1.20, 9: 0.90,
}

SEASONAL_FACTORS = {
    1: 0.85, 2: 0.80, 3: 0.90, 4: 0.95, 5: 1.00, 6: 1.05,
    7: 1.10, 8: 1.15, 9: 1.05, 10: 1.20, 11: 1.35, 12: 1.50,
}

HOLIDAYS = [
    "01-26", "03-08", "03-25", "04-14", "04-19",
    "05-01", "06-21", "08-15", "10-02", "10-22",
    "11-01", "11-14", "12-25", "12-31",
]


def build_product_catalog(n_products: int, rng: np.random.Generator):
    products = []
    pid = 1
    catalog_items = []
    for cat, items in CATEGORIES.items():
        for item in items:
            catalog_items.append((cat, item))

    while len(products) < n_products:
        cat, item = catalog_items[(pid - 1) % len(catalog_items)]
        lo, hi = CATEGORY_BASE_PRICES[cat]
        suffix = f" {((pid - 1) // len(catalog_items)) + 1}" if pid > len(catalog_items) else ""
        products.append({
            "product_id": f"P{pid:03d}",
            "product_name": f"{item}{suffix}".strip(),
            "base_name": item,
            "category": cat,
            "base_price": float(rng.integers(lo, hi)),
            "popularity": float(rng.uniform(0.35, 1.0)),
        })
        pid += 1
    return products


def build_store_catalog(n_stores: int):
    stores = []
    for i in range(n_stores):
        city, state = CITIES[i % len(CITIES)]
        stores.append({
            "store_id": f"S{i + 1:02d}",
            "store_name": f"{city} Store",
            "city": city,
            "state": state,
            "performance_multiplier": STORE_MULTIPLIERS.get(i, 1.0),
        })
    return stores


def is_holiday(date: pd.Timestamp) -> int:
    return 1 if date.strftime("%m-%d") in HOLIDAYS else 0


def _pick_bundle_products(catalog, rng: np.random.Generator, size: int):
    by_name = {}
    for p in catalog:
        by_name.setdefault(p["base_name"], []).append(p)

    viable = []
    for bundle in BUNDLES:
        members = []
        for name in bundle:
            if name in by_name:
                members.append(by_name[name][0])
        if len(members) >= 2:
            viable.append(members)

    if viable and rng.random() < 0.55:
        bundle = viable[int(rng.integers(0, len(viable)))]
        k = min(size, len(bundle))
        idxs = rng.choice(len(bundle), size=k, replace=False)
        return [bundle[int(i)] for i in np.atleast_1d(idxs)]

    weights = np.array([p["popularity"] for p in catalog])
    weights = weights / weights.sum()
    idxs = rng.choice(len(catalog), size=min(size, len(catalog)), replace=False, p=weights)
    return [catalog[int(i)] for i in np.atleast_1d(idxs)]


def generate_dataset(records: int = 15000, products: int = 50, stores: int = 10, months: int = 12) -> pd.DataFrame:
    records = int(max(500, min(records, 50000)))
    products = int(max(8, min(products, 120)))
    stores = int(max(2, min(stores, 20)))
    months = int(max(1, min(months, 36)))

    rng = np.random.default_rng(SEED + records + products * 7 + stores * 13 + months)
    catalog = build_product_catalog(products, rng)
    store_list = build_store_catalog(stores)

    end_date = datetime(2024, 12, 31)
    start_date = end_date - timedelta(days=months * 30)
    date_range = pd.date_range(start=start_date, end=end_date, freq="D")
    n_days = len(date_range)

    rows = []
    txn_id = 1
    remaining = records
    deterioration_date = pd.Timestamp(end_date - timedelta(days=90))

    while remaining > 0:
        basket_size = int(rng.choice([1, 1, 1, 2, 2, 2, 3, 3, 4], p=[0.18, 0.18, 0.14, 0.16, 0.12, 0.08, 0.08, 0.04, 0.02]))
        basket_size = min(basket_size, remaining, len(catalog))

        date = date_range[int(rng.integers(0, n_days))]
        dow = int(date.dayofweek)
        month = int(date.month)
        is_weekend = 1 if dow >= 5 else 0
        holiday = is_holiday(date)

        store = store_list[int(rng.integers(0, len(store_list)))]
        store_factor = store["performance_multiplier"]
        if store["store_id"] == "S07" and pd.Timestamp(date) > deterioration_date:
            store_factor *= 0.55

        promotion = 1 if rng.random() < 0.25 else 0
        if promotion:
            discount_pct = float(rng.choice([10, 15, 20, 25, 30]))
        else:
            discount_pct = float(rng.choice([0, 0, 0, 5]))

        season_factor = SEASONAL_FACTORS.get(month, 1.0)
        basket_products = _pick_bundle_products(catalog, rng, basket_size)

        if store["store_id"] == "S04":
            seg_weights = np.array([0.15, 0.45, 0.30, 0.10])
        else:
            seg_weights = np.array([0.22, 0.40, 0.23, 0.15])
        customer_segment = str(rng.choice(CUSTOMER_SEGMENTS, p=seg_weights / seg_weights.sum()))
        payment_method = str(rng.choice(PAYMENT_METHODS, p=[0.28, 0.18, 0.38, 0.08, 0.08]))

        for prod in basket_products:
            price = prod["base_price"] * float(rng.uniform(0.90, 1.10))
            base_demand = prod["popularity"] * 5
            demand_mod = (
                base_demand
                * season_factor
                * store_factor
                * (1 + 0.30 * is_weekend)
                * (1 + 0.40 * holiday)
                * (1 + 0.015 * discount_pct)
                * (1 + 0.25 * promotion)
            )
            units_sold = max(1, int(rng.poisson(max(demand_mod, 0.4))))
            inventory_level = max(units_sold, int(rng.integers(8, 220)))

            return_prob = 0.04
            if store["store_id"] in ("S07", "S04"):
                return_prob = 0.09
            if prod["category"] == "Electronics":
                return_prob += 0.015
            return_flag = 1 if rng.random() < return_prob else 0

            rows.append({
                "transaction_id": f"TXN{txn_id:06d}",
                "date": date.strftime("%Y-%m-%d"),
                "store_id": store["store_id"],
                "store_name": store["store_name"],
                "city": store["city"],
                "product_id": prod["product_id"],
                "product_name": prod["product_name"],
                "category": prod["category"],
                "price": round(price, 2),
                "discount_percent": discount_pct,
                "promotion": promotion,
                "holiday": holiday,
                "day_of_week": dow,
                "units_sold": units_sold,
                "inventory_level": inventory_level,
                "customer_segment": customer_segment,
                "payment_method": payment_method,
                "return_flag": return_flag,
            })
            remaining -= 1
            if remaining <= 0:
                break
        txn_id += 1

    df = pd.DataFrame(rows)
    df["revenue"] = df["price"] * df["units_sold"] * (1 - df["discount_percent"] / 100)
    _inject_anomalies(df, rng)
    df["revenue"] = df["price"] * df["units_sold"] * (1 - df["discount_percent"] / 100)
    return df.sort_values(["date", "transaction_id"]).reset_index(drop=True)


def _inject_anomalies(df: pd.DataFrame, rng: np.random.Generator):
    spike_product = df["product_id"].iloc[0]
    spike_dates = {d.strftime("%Y-%m-%d") for d in pd.date_range("2024-10-01", "2024-10-07")}
    mask = (df["product_id"] == spike_product) & (df["date"].isin(spike_dates))
    df.loc[mask, "units_sold"] = (df.loc[mask, "units_sold"] * 5).clip(lower=1)

    disc_mask = (df["store_id"] == "S04") & (df["date"] >= "2024-09-01") & (df["date"] <= "2024-09-30")
    df.loc[disc_mask, "discount_percent"] = 45.0

    electronics_mask = (df["category"] == "Electronics") & (df["date"] >= "2024-11-01") & (df["date"] <= "2024-11-30")
    flags = df.loc[electronics_mask, "return_flag"].to_numpy()
    extra = rng.random(len(flags)) < 0.35
    df.loc[electronics_mask, "return_flag"] = np.where(extra, 1, flags)

    drop_mask = (df["store_id"] == "S07") & (df["date"] >= "2024-10-01")
    df.loc[drop_mask, "units_sold"] = (df.loc[drop_mask, "units_sold"] * 0.45).clip(lower=1).astype(int)


def save_to_excel(df: pd.DataFrame, path: str):
    df.to_excel(path, index=False, engine="openpyxl")


def save_to_csv(df: pd.DataFrame, path: str):
    df.to_csv(path, index=False)


def profile_dataframe(df: pd.DataFrame) -> dict:
    total_records = int(len(df))
    total_columns = int(len(df.columns))
    missing_values = int(df.isnull().sum().sum())
    duplicate_records = int(df.duplicated().sum())

    date_range_start = str(df["date"].min()) if "date" in df.columns else ""
    date_range_end = str(df["date"].max()) if "date" in df.columns else ""
    unique_products = int(df["product_id"].nunique()) if "product_id" in df.columns else 0
    unique_stores = int(df["store_id"].nunique()) if "store_id" in df.columns else 0

    if "revenue" in df.columns:
        total_sales = float(df["revenue"].sum())
    elif "price" in df.columns and "units_sold" in df.columns:
        disc = df["discount_percent"] if "discount_percent" in df.columns else 0
        total_sales = float((df["price"] * df["units_sold"] * (1 - disc / 100)).sum())
    else:
        total_sales = 0.0

    avg_txn = total_sales / total_records if total_records else 0
    return {
        "total_records": total_records,
        "total_columns": total_columns,
        "missing_values": missing_values,
        "duplicate_records": duplicate_records,
        "date_range_start": str(date_range_start)[:10],
        "date_range_end": str(date_range_end)[:10],
        "unique_products": unique_products,
        "unique_stores": unique_stores,
        "total_sales": round(total_sales, 2),
        "avg_transaction_value": round(avg_txn, 2),
    }


REQUIRED_COLUMNS = {
    "transaction_id", "date", "store_id", "product_id",
    "price", "units_sold", "category",
}


def validate_uploaded_df(df: pd.DataFrame) -> list:
    errors = []
    missing_cols = REQUIRED_COLUMNS - set(df.columns)
    if missing_cols:
        errors.append(f"Missing required columns: {', '.join(sorted(missing_cols))}")
    if df.empty:
        errors.append("The file contains no data rows.")
    if "units_sold" in df.columns and df["units_sold"].isnull().any():
        errors.append("Column 'units_sold' contains missing values.")
    if "price" in df.columns and pd.to_numeric(df["price"], errors="coerce").lt(0).any():
        errors.append("Column 'price' contains negative values.")
    return errors
