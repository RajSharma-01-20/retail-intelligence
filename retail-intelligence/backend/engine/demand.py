"""
Demand Intelligence Engine
Uses RandomForestRegressor to model and predict retail demand.
"""
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

_model: Optional[RandomForestRegressor] = None
_encoders: dict = {}
_feature_cols: list = []
_model_metrics: dict = {}
_actual_vs_predicted: list = []


def reset_model():
    global _model, _encoders, _feature_cols, _model_metrics, _actual_vs_predicted
    _model = None
    _encoders = {}
    _feature_cols = []
    _model_metrics = {}
    _actual_vs_predicted = []


def _revenue_series(df: pd.DataFrame) -> pd.Series:
    if "revenue" in df.columns:
        return df["revenue"]
    disc = df["discount_percent"] if "discount_percent" in df.columns else 0
    return df["price"] * df["units_sold"] * (1 - disc / 100)


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    global _encoders
    work = df.copy()
    work["date"] = pd.to_datetime(work["date"])
    work = work.sort_values(["product_id", "store_id", "date"])

    work["month"] = work["date"].dt.month
    work["week"] = work["date"].dt.isocalendar().week.astype(int)
    work["is_weekend"] = (work["date"].dt.dayofweek >= 5).astype(int)
    work["quarter"] = work["date"].dt.quarter
    if "day_of_week" not in work.columns:
        work["day_of_week"] = work["date"].dt.dayofweek
    if "holiday" not in work.columns:
        work["holiday"] = 0
    if "promotion" not in work.columns:
        work["promotion"] = 0
    if "discount_percent" not in work.columns:
        work["discount_percent"] = 0

    grp = work.groupby("product_id")["units_sold"]
    work["rolling_7"] = grp.transform(lambda x: x.rolling(7, min_periods=1).mean())
    work["rolling_14"] = grp.transform(lambda x: x.rolling(14, min_periods=1).mean())
    work["rolling_30"] = grp.transform(lambda x: x.rolling(30, min_periods=1).mean())

    _encoders = {}
    for col in ["product_id", "store_id", "category"]:
        if col in work.columns:
            le = LabelEncoder()
            work[col + "_enc"] = le.fit_transform(work[col].astype(str))
            _encoders[col] = le
    return work


def train_model(df: pd.DataFrame):
    global _model, _feature_cols, _model_metrics, _actual_vs_predicted

    df_feat = _build_features(df)
    feature_cols = [
        "product_id_enc", "store_id_enc", "category_enc",
        "price", "discount_percent", "promotion", "holiday",
        "day_of_week", "month", "week", "quarter",
        "is_weekend", "rolling_7", "rolling_14", "rolling_30",
    ]
    feature_cols = [c for c in feature_cols if c in df_feat.columns]
    _feature_cols = feature_cols

    X = df_feat[feature_cols].fillna(0)
    y = df_feat["units_sold"].astype(float)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    rf = RandomForestRegressor(n_estimators=80, max_depth=12, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)

    y_pred = rf.predict(X_test)
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))

    sample_n = min(80, len(y_test))
    step = max(1, len(y_test) // sample_n)
    y_test_v = y_test.to_numpy()
    avp = []
    for i in range(0, len(y_test_v), step):
        avp.append({
            "index": len(avp) + 1,
            "actual": round(float(y_test_v[i]), 2),
            "predicted": round(float(y_pred[i]), 2),
        })
        if len(avp) >= sample_n:
            break

    _model = rf
    _actual_vs_predicted = avp
    _model_metrics = {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "r2": round(r2, 4),
        "model": "Random Forest Regressor",
        "n_estimators": 80,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
    }
    return {**_model_metrics, "actual_vs_predicted": _actual_vs_predicted}


def get_model_info() -> dict:
    return {
        **(_model_metrics or {"model": "Random Forest Regressor", "trained": False}),
        "trained": _model is not None,
        "actual_vs_predicted": _actual_vs_predicted,
    }


def predict_demand(
    df: pd.DataFrame,
    product_id: str,
    store_id: str,
    price: float,
    discount_percent: float,
    promotion: int,
    date_str: Optional[str] = None,
    date: Optional[str] = None,
) -> dict:
    if _model is None:
        train_model(df)

    target_date_str = date_str or date or "2024-12-01"
    target_date = pd.to_datetime(target_date_str)
    dow = int(target_date.dayofweek)
    month = int(target_date.month)
    week = int(target_date.isocalendar()[1])
    quarter = (month - 1) // 3 + 1
    is_weekend = 1 if dow >= 5 else 0

    from engine.generator import HOLIDAYS
    holiday = 1 if target_date.strftime("%m-%d") in HOLIDAYS else 0

    prod_rows = df[df["product_id"] == product_id]
    if prod_rows.empty:
        raise ValueError(f"Unknown product: {product_id}")
    prod_cat = str(prod_rows["category"].iloc[0]) if "category" in prod_rows.columns else "Electronics"

    prod_units = prod_rows["units_sold"]
    roll_7 = float(prod_units.tail(7).mean()) if len(prod_units) else 3.0
    roll_14 = float(prod_units.tail(14).mean()) if len(prod_units) else 3.0
    roll_30 = float(prod_units.tail(30).mean()) if len(prod_units) else 3.0

    row = {
        "product_id_enc": _encode_val("product_id", product_id),
        "store_id_enc": _encode_val("store_id", store_id),
        "category_enc": _encode_val("category", prod_cat),
        "price": float(price),
        "discount_percent": float(discount_percent),
        "promotion": int(promotion),
        "holiday": holiday,
        "day_of_week": dow,
        "month": month,
        "week": week,
        "quarter": quarter,
        "is_weekend": is_weekend,
        "rolling_7": roll_7,
        "rolling_14": roll_14,
        "rolling_30": roll_30,
    }

    X = pd.DataFrame([{c: row.get(c, 0) for c in _feature_cols}], columns=_feature_cols).fillna(0)
    pred = float(_model.predict(X)[0])
    pred = max(0.0, pred)

    tree_preds = np.array([est.predict(X.to_numpy()) for est in _model.estimators_])
    std = float(np.std(tree_preds))
    lo = max(0.0, pred - 1.5 * std)
    hi = pred + 1.5 * std

    return {
        "predicted_demand": round(pred, 1),
        "range_low": round(lo, 1),
        "range_high": round(hi, 1),
        "model": "Random Forest Regressor",
        "metrics": _model_metrics,
        "actual_vs_predicted": _actual_vs_predicted,
    }


def _encode_val(col: str, val: str) -> int:
    le = _encoders.get(col)
    if le is None:
        return 0
    try:
        return int(le.transform([str(val)])[0])
    except ValueError:
        return 0


def get_demand_summary(df: pd.DataFrame) -> dict:
    work = df.copy()
    work["date"] = pd.to_datetime(work["date"])
    work["revenue"] = _revenue_series(work)

    daily = work.groupby("date")["units_sold"].sum().reset_index().sort_values("date")
    daily["date"] = daily["date"].dt.strftime("%Y-%m-%d")

    prod_demand = (
        work.groupby(["product_id", "product_name"])["units_sold"]
        .sum().reset_index().sort_values("units_sold", ascending=False).head(10)
    )
    cat_demand = work.groupby("category")["units_sold"].sum().reset_index()

    work["month_str"] = work["date"].dt.strftime("%Y-%m")
    monthly = work.groupby("month_str")["units_sold"].sum().reset_index()

    work["season"] = work["date"].dt.month.map(
        lambda m: "Q1" if m <= 3 else "Q2" if m <= 6 else "Q3" if m <= 9 else "Q4"
    )
    seasonal = work.groupby("season")["units_sold"].sum().reset_index()

    avg_daily = float(daily["units_sold"].mean()) if len(daily) else 0.0

    work["ym"] = work["date"].dt.to_period("M")
    periods = sorted(work["ym"].unique())
    if len(periods) >= 2:
        last = float(work[work["ym"] == periods[-1]]["units_sold"].sum())
        prev = float(work[work["ym"] == periods[-2]]["units_sold"].sum())
        growth_pct = ((last - prev) / prev * 100) if prev else 0
    else:
        growth_pct = 0

    top_product = str(prod_demand.iloc[0]["product_name"]) if len(prod_demand) else "N/A"
    peak_month = str(monthly.sort_values("units_sold", ascending=False).iloc[0]["month_str"]) if len(monthly) else "N/A"

    return {
        "avg_daily_demand": round(avg_daily, 1),
        "demand_growth_pct": round(growth_pct, 2),
        "top_product": top_product,
        "peak_demand_period": peak_month,
        "date_range_end": str(work["date"].max())[:10],
        "daily_trend": daily.to_dict(orient="records"),
        "product_demand": prod_demand.rename(columns={"units_sold": "demand"}).to_dict(orient="records"),
        "category_demand": cat_demand.rename(columns={"units_sold": "demand"}).to_dict(orient="records"),
        "monthly_trend": monthly.rename(columns={"units_sold": "demand", "month_str": "month"}).to_dict(orient="records"),
        "seasonal_trend": seasonal.rename(columns={"units_sold": "demand"}).to_dict(orient="records"),
        "model": get_model_info(),
    }
