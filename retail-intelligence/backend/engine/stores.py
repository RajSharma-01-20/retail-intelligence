"""
Store Performance Investigator
Deep-dives into each store's performance relative to baseline and peers.
"""
from typing import Dict, List

import numpy as np
import pandas as pd


def _ensure_revenue(df: pd.DataFrame) -> pd.DataFrame:
    work = df.copy()
    work["date"] = pd.to_datetime(work["date"])
    if "revenue" not in work.columns:
        disc = work["discount_percent"] if "discount_percent" in work.columns else 0
        work["revenue"] = work["price"] * work["units_sold"] * (1 - disc / 100)
    return work


def get_store_summary(df: pd.DataFrame) -> List[Dict]:
    work = _ensure_revenue(df)
    max_date = work["date"].max()
    split_date = max_date - pd.DateOffset(days=60)
    recent = work[work["date"] > split_date]
    earlier = work[work["date"] <= split_date]

    global_revenue = work.groupby("store_id")["revenue"].sum().mean()
    global_return_rate = float(work["return_flag"].mean()) if "return_flag" in work.columns else 0

    summaries = []
    for (sid, sname), grp in work.groupby(["store_id", "store_name"]):
        total_rev = float(grp["revenue"].sum())
        total_units = int(grp["units_sold"].sum())
        avg_order = float(grp["revenue"].mean())
        return_rate = float(grp["return_flag"].mean()) if "return_flag" in grp.columns else 0

        rec_rev = float(recent[recent["store_id"] == sid]["revenue"].sum())
        ear_rev = float(earlier[earlier["store_id"] == sid]["revenue"].sum())
        rev_change_pct = ((rec_rev - ear_rev) / ear_rev * 100) if ear_rev else 0

        rel_rev = (total_rev / global_revenue) if global_revenue else 1
        rel_ret = 1 - min(return_rate / (global_return_rate + 0.001), 2)
        score = min(100, max(0, (rel_rev * 0.6 + rel_ret * 0.4) * 50))

        if rev_change_pct < -15 or score < 35:
            status = "NEEDS ATTENTION"
        elif rev_change_pct < -5 or score < 50:
            status = "BELOW AVERAGE"
        elif score > 70:
            status = "STRONG"
        else:
            status = "AVERAGE"

        summaries.append({
            "store_id": sid,
            "store_name": sname,
            "city": str(grp["city"].iloc[0]) if "city" in grp.columns else "",
            "revenue": round(total_rev, 2),
            "units_sold": total_units,
            "avg_order_value": round(avg_order, 2),
            "return_rate": round(return_rate * 100, 2),
            "performance_score": round(score, 1),
            "revenue_change_pct": round(rev_change_pct, 2),
            "status": status,
        })

    return sorted(summaries, key=lambda x: x["revenue"], reverse=True)


def investigate_store(df: pd.DataFrame, store_id: str) -> Dict:
    work = _ensure_revenue(df)
    store_df = work[work["store_id"] == store_id].copy()
    if store_df.empty:
        return {"error": "Store not found"}

    store_name = str(store_df["store_name"].iloc[0])
    city = str(store_df["city"].iloc[0]) if "city" in store_df.columns else ""

    total_rev = float(store_df["revenue"].sum())
    total_units = int(store_df["units_sold"].sum())
    avg_order = float(store_df["revenue"].mean())
    return_rate = float(store_df["return_flag"].mean()) if "return_flag" in store_df.columns else 0

    peer_avg_rev = float(work.groupby("store_id")["revenue"].sum().mean())
    peer_avg_units = float(work.groupby("store_id")["units_sold"].sum().mean())
    peer_return = float(work.groupby("store_id")["return_flag"].mean().mean()) if "return_flag" in work.columns else 0

    rev_vs_peer = (total_rev - peer_avg_rev) / peer_avg_rev * 100 if peer_avg_rev else 0
    units_vs_peer = (total_units - peer_avg_units) / peer_avg_units * 100 if peer_avg_units else 0
    return_vs_peer = (return_rate - peer_return) / (peer_return + 1e-6) * 100

    max_date = work["date"].max()
    split = max_date - pd.DateOffset(days=60)
    rec_rev = float(store_df[store_df["date"] > split]["revenue"].sum())
    pri_rev = float(store_df[store_df["date"] <= split]["revenue"].sum())
    rev_trend_pct = (rec_rev - pri_rev) / pri_rev * 100 if pri_rev else 0

    cat_perf = store_df.groupby("category").agg(revenue=("revenue", "sum"), units=("units_sold", "sum")).reset_index()
    peer_cat = work.groupby(["store_id", "category"])["revenue"].sum().reset_index()
    peer_cat_avg = peer_cat.groupby("category")["revenue"].mean().reset_index()
    peer_cat_avg.columns = ["category", "peer_avg_revenue"]
    cat_perf = cat_perf.merge(peer_cat_avg, on="category", how="left")
    cat_perf["vs_peer_pct"] = (cat_perf["revenue"] - cat_perf["peer_avg_revenue"]) / cat_perf["peer_avg_revenue"] * 100
    cat_perf["vs_peer_pct"] = cat_perf["vs_peer_pct"].round(2)
    cat_perf["revenue"] = cat_perf["revenue"].round(2)

    store_df["month_str"] = store_df["date"].dt.strftime("%Y-%m")
    monthly = store_df.groupby("month_str")["revenue"].sum().reset_index()
    monthly["revenue"] = monthly["revenue"].round(2)
    monthly = monthly.sort_values("month_str")

    store_df["is_weekend"] = (store_df["date"].dt.dayofweek >= 5).astype(int)
    weekend_vals = store_df.loc[store_df["is_weekend"] == 1, "revenue"]
    weekday_vals = store_df.loc[store_df["is_weekend"] == 0, "revenue"]
    weekend_aov = float(weekend_vals.mean()) if len(weekend_vals) else 0
    weekday_aov = float(weekday_vals.mean()) if len(weekday_vals) else 0

    promo_rate = float(store_df["promotion"].mean()) if "promotion" in store_df.columns else 0
    peer_promo_rate = float(work.groupby("store_id")["promotion"].mean().mean()) if "promotion" in work.columns else 0

    findings = []
    if rev_trend_pct < -10:
        findings.append(
            f"Revenue declined {abs(rev_trend_pct):.1f}% in the recent 60-day period vs prior baseline."
        )
    if len(cat_perf):
        worst_cat = cat_perf.sort_values("vs_peer_pct").iloc[0]
        if worst_cat["vs_peer_pct"] < -15:
            findings.append(
                f"{worst_cat['category']} sales are {abs(worst_cat['vs_peer_pct']):.1f}% below peer average."
            )
    if promo_rate < peer_promo_rate - 0.05:
        findings.append(
            f"Promotional activity ({promo_rate*100:.1f}%) is below network average ({peer_promo_rate*100:.1f}%)."
        )
    if return_rate > peer_return * 1.5 and peer_return > 0:
        findings.append(
            f"Return rate ({return_rate*100:.1f}%) is significantly above peer average ({peer_return*100:.1f}%)."
        )
    if weekday_aov and weekend_aov < weekday_aov * 0.9:
        findings.append(
            f"Weekend average order value (₹{weekend_aov:.0f}) is lower than weekday (₹{weekday_aov:.0f})."
        )

    rec_units = float(store_df[store_df["date"] > split]["units_sold"].sum())
    pri_units = float(store_df[store_df["date"] <= split]["units_sold"].sum())
    units_trend = (rec_units - pri_units) / pri_units * 100 if pri_units else 0
    if units_trend < -8:
        findings.append(f"Units sold declined {abs(units_trend):.1f}% versus the prior period.")

    score_inputs = [
        min(100, max(0, 50 + rev_vs_peer * 0.3)),
        min(100, max(0, 50 + units_vs_peer * 0.3)),
        min(100, max(0, 100 - return_rate * 1000)),
    ]
    perf_score = float(np.mean(score_inputs))

    if rev_vs_peer < -15 or perf_score < 35:
        status = "NEEDS ATTENTION"
    elif rev_vs_peer < -5 or perf_score < 55:
        status = "BELOW AVERAGE"
    elif perf_score > 70:
        status = "STRONG"
    else:
        status = "AVERAGE"

    return {
        "store_id": store_id,
        "store_name": store_name,
        "city": city,
        "status": status,
        "performance_score": round(perf_score, 1),
        "metrics": {
            "total_revenue": round(total_rev, 2),
            "total_units": total_units,
            "avg_order_value": round(avg_order, 2),
            "return_rate": round(return_rate * 100, 2),
            "revenue_vs_peer_pct": round(rev_vs_peer, 2),
            "units_vs_peer_pct": round(units_vs_peer, 2),
            "return_vs_peer_pct": round(return_vs_peer, 2),
            "revenue_trend_60d_pct": round(rev_trend_pct, 2),
            "weekend_aov": round(weekend_aov, 2),
            "weekday_aov": round(weekday_aov, 2),
            "promo_rate": round(promo_rate * 100, 2),
            "peer_promo_rate": round(peer_promo_rate * 100, 2),
        },
        "category_performance": cat_perf[["category", "revenue", "units", "vs_peer_pct"]].to_dict(orient="records"),
        "monthly_trend": monthly.to_dict(orient="records"),
        "key_findings": findings if findings else ["Store performance is within normal parameters compared with peers and its own baseline."],
    }
