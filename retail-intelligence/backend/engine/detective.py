"""
Autonomous Data Detective
Automatically discovers anomalies, unusual patterns, and data quality issues.
"""
from typing import Dict
import uuid

import numpy as np
import pandas as pd


def _severity_from_abs(value: float, warn: float, critical: float) -> str:
    mag = abs(value)
    if mag >= critical:
        return "CRITICAL"
    if mag >= warn:
        return "WARNING"
    return "OBSERVATION"


def _finding(severity, title, description, evidence, entity, metric, deviation):
    return {
        "id": str(uuid.uuid4())[:8],
        "severity": severity,
        "title": title,
        "description": description,
        "evidence": evidence,
        "affected_entity": entity,
        "metric": metric,
        "deviation": round(float(deviation), 2),
    }


def run_investigation(df: pd.DataFrame) -> Dict:
    findings = []
    patterns_evaluated = 0
    work = df.copy()
    work["date"] = pd.to_datetime(work["date"], errors="coerce")

    if "revenue" not in work.columns:
        disc = work["discount_percent"] if "discount_percent" in work.columns else 0
        work["revenue"] = work["price"] * work["units_sold"] * (1 - disc / 100)

    # Data quality
    patterns_evaluated += 2
    missing = int(work.isnull().sum().sum())
    if missing > 0:
        findings.append(_finding(
            "WARNING" if missing > 50 else "OBSERVATION",
            "Missing Values Detected",
            f"{missing} missing cells were found in the loaded dataset.",
            "Missing values can distort demand and store comparisons.",
            "Dataset",
            "Missing Values",
            missing,
        ))
    duplicates = int(work.duplicated().sum())
    if duplicates > 0:
        findings.append(_finding(
            "WARNING" if duplicates > 20 else "OBSERVATION",
            "Duplicate Records",
            f"{duplicates} duplicate rows were detected.",
            "Repeated rows can inflate revenue and co-purchase counts.",
            "Dataset",
            "Duplicate Records",
            duplicates,
        ))

    # Store revenue drop vs own baseline
    store_monthly = (
        work.groupby(["store_id", "store_name", work["date"].dt.to_period("M")])["revenue"]
        .sum().reset_index()
    )
    store_monthly.columns = ["store_id", "store_name", "period", "revenue"]
    store_monthly = store_monthly.sort_values(["store_id", "period"])
    for _, grp in store_monthly.groupby("store_id"):
        patterns_evaluated += 1
        grp = grp.reset_index(drop=True)
        if len(grp) < 3:
            continue
        recent = float(grp.iloc[-1]["revenue"])
        baseline = float(grp.iloc[:-1]["revenue"].mean())
        if baseline == 0:
            continue
        pct_change = (recent - baseline) / baseline * 100
        if pct_change < -10:
            findings.append(_finding(
                _severity_from_abs(pct_change, 15, 25),
                f"{grp.iloc[0]['store_name']} Revenue Drop",
                f"Revenue decreased {abs(pct_change):.1f}% compared with its historical baseline.",
                f"Recent period revenue: ₹{recent:,.0f} vs baseline: ₹{baseline:,.0f}.",
                str(grp.iloc[0]["store_name"]),
                "Revenue",
                pct_change,
            ))

    # Sudden sales drops (units)
    store_units = (
        work.groupby(["store_id", "store_name", work["date"].dt.to_period("M")])["units_sold"]
        .sum().reset_index()
    )
    store_units.columns = ["store_id", "store_name", "period", "units"]
    for _, grp in store_units.groupby("store_id"):
        patterns_evaluated += 1
        grp = grp.sort_values("period").reset_index(drop=True)
        if len(grp) < 3:
            continue
        recent = float(grp.iloc[-1]["units"])
        baseline = float(grp.iloc[:-1]["units"].mean())
        if baseline == 0:
            continue
        pct = (recent - baseline) / baseline * 100
        if pct < -18:
            findings.append(_finding(
                _severity_from_abs(pct, 20, 35),
                f"{grp.iloc[0]['store_name']} Unit Sales Decline",
                f"Units sold fell {abs(pct):.1f}% versus the store's prior monthly average.",
                f"Recent: {recent:,.0f} units vs baseline {baseline:,.0f} units.",
                str(grp.iloc[0]["store_name"]),
                "Units Sold",
                pct,
            ))

    # Return rates
    if "return_flag" in work.columns:
        store_return = work.groupby(["store_id", "store_name"])["return_flag"].agg(["sum", "count"]).reset_index()
        store_return["return_rate"] = store_return["sum"] / store_return["count"]
        global_rate = float(store_return["return_rate"].mean())
        global_std = float(store_return["return_rate"].std() or 0)
        for _, row in store_return.iterrows():
            patterns_evaluated += 1
            z = (float(row["return_rate"]) - global_rate) / (global_std + 1e-6)
            if abs(z) > 1.8:
                findings.append(_finding(
                    _severity_from_abs(z, 2.0, 3.2),
                    f"Elevated Return Rate — {row['store_name']}",
                    f"Return rate is {row['return_rate']*100:.1f}% vs overall average {global_rate*100:.1f}%.",
                    f"{int(row['sum'])} returns out of {int(row['count'])} line items.",
                    str(row["store_name"]),
                    "Return Rate",
                    (float(row["return_rate"]) - global_rate) / (global_rate + 1e-6) * 100,
                ))

        if "category" in work.columns:
            cat_ret = work.groupby("category")["return_flag"].mean().reset_index()
            overall = float(work["return_flag"].mean())
            for _, row in cat_ret.iterrows():
                patterns_evaluated += 1
                if overall == 0:
                    continue
                pct = (float(row["return_flag"]) - overall) / overall * 100
                if pct > 40:
                    findings.append(_finding(
                        _severity_from_abs(pct, 50, 80),
                        f"Unusual Return Pattern — {row['category']}",
                        f"{row['category']} returns are {pct:.1f}% above the dataset average.",
                        f"Category return rate {row['return_flag']*100:.1f}% vs overall {overall*100:.1f}%.",
                        str(row["category"]),
                        "Return Rate",
                        pct,
                    ))

    # Product demand spikes
    prod_daily = (
        work.groupby(["product_id", "product_name", work["date"].dt.date])["units_sold"]
        .sum().reset_index()
    )
    prod_daily.columns = ["product_id", "product_name", "date", "units_sold"]
    top_ids = work.groupby("product_id")["units_sold"].sum().nlargest(20).index
    for pid, grp in prod_daily[prod_daily["product_id"].isin(top_ids)].groupby("product_id"):
        patterns_evaluated += 1
        if len(grp) < 7:
            continue
        mean_val = float(grp["units_sold"].mean())
        std_val = float(grp["units_sold"].std() or 0)
        max_day = grp.loc[grp["units_sold"].idxmax()]
        z = (float(max_day["units_sold"]) - mean_val) / (std_val + 1e-6)
        if z > 3.5:
            findings.append(_finding(
                _severity_from_abs(z, 3.5, 5.0),
                f"Demand Spike — {max_day['product_name']}",
                f"Unusually high sales on {max_day['date']}. {z:.1f} standard deviations above average.",
                f"Peak: {int(max_day['units_sold'])} units vs average {mean_val:.1f} units/day.",
                str(max_day["product_name"]),
                "Units Sold",
                (float(max_day["units_sold"]) - mean_val) / (mean_val + 1e-6) * 100,
            ))

    # Discount behavior
    if "discount_percent" in work.columns:
        store_disc = work.groupby(["store_id", "store_name"])["discount_percent"].mean().reset_index()
        mean_d = float(store_disc["discount_percent"].mean())
        std_d = float(store_disc["discount_percent"].std() or 0)
        for _, row in store_disc.iterrows():
            patterns_evaluated += 1
            z = (float(row["discount_percent"]) - mean_d) / (std_d + 1e-6)
            if abs(z) > 2.0:
                findings.append(_finding(
                    _severity_from_abs(z, 2.0, 3.0),
                    f"Abnormal Discount Rate — {row['store_name']}",
                    f"Average discount is {row['discount_percent']:.1f}% vs network average {mean_d:.1f}%.",
                    f"Z-score {z:.2f} indicates promotional activity outside typical range.",
                    str(row["store_name"]),
                    "Discount %",
                    z * 10,
                ))

    # Category trend shifts
    cat_monthly = work.groupby(["category", work["date"].dt.to_period("M")])["revenue"].sum().reset_index()
    cat_monthly.columns = ["category", "period", "revenue"]
    for cat, grp in cat_monthly.groupby("category"):
        patterns_evaluated += 1
        grp = grp.sort_values("period").reset_index(drop=True)
        if len(grp) < 3:
            continue
        recent = float(grp.iloc[-1]["revenue"])
        baseline = float(grp.iloc[:-1]["revenue"].mean())
        if baseline == 0:
            continue
        pct = (recent - baseline) / baseline * 100
        if abs(pct) > 20:
            findings.append(_finding(
                _severity_from_abs(pct, 25, 40),
                f"Category Trend Shift — {cat}",
                f"{cat} revenue {'increased' if pct > 0 else 'declined'} {abs(pct):.1f}% vs its historical average.",
                f"Most recent: ₹{recent:,.0f} vs baseline ₹{baseline:,.0f}.",
                str(cat),
                "Category Revenue",
                pct,
            ))

    # Inventory
    if "inventory_level" in work.columns:
        patterns_evaluated += 1
        low_inv = work[work["inventory_level"] < 15]
        if len(low_inv) > 50:
            products = low_inv["product_name"].value_counts().head(3).index.tolist()
            findings.append(_finding(
                "WARNING",
                "Persistent Low Inventory Detected",
                f"{len(low_inv)} records show critically low inventory levels.",
                f"Most affected products: {', '.join(map(str, products))}.",
                "Inventory System",
                "Inventory Level",
                len(low_inv) / max(len(work), 1) * 100,
            ))

    # Suspiciously repeated values
    for col in ["discount_percent", "units_sold", "price"]:
        if col not in work.columns:
            continue
        patterns_evaluated += 1
        vc = work[col].value_counts(normalize=True)
        if len(vc) and float(vc.iloc[0]) > 0.72:
            findings.append(_finding(
                "OBSERVATION" if float(vc.iloc[0]) < 0.9 else "WARNING",
                f"Repeated Values in {col}",
                f"{vc.iloc[0]*100:.1f}% of rows share the same {col} value ({vc.index[0]}).",
                "High repetition can indicate defaulted fields or constrained promotions.",
                col,
                "Value Concentration",
                float(vc.iloc[0]) * 100,
            ))

    severity_order = {"CRITICAL": 0, "WARNING": 1, "OBSERVATION": 2}
    findings = sorted(findings, key=lambda x: (severity_order.get(x["severity"], 3), -abs(x["deviation"])))

    return {
        "total_records_analyzed": int(len(work)),
        "patterns_evaluated": int(patterns_evaluated),
        "findings_count": len(findings),
        "findings": findings,
    }
