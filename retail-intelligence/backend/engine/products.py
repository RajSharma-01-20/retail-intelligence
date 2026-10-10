"""
Product Relationship Explorer
Co-occurrence analysis and association rule mining.
"""
from itertools import combinations
from typing import Dict, List

import pandas as pd


def _name_maps(df: pd.DataFrame):
    name_map = dict(zip(df["product_id"].astype(str), df.get("product_name", df["product_id"]).astype(str)))
    cat_map = dict(zip(df["product_id"].astype(str), df.get("category", pd.Series([""] * len(df))).astype(str)))
    return name_map, cat_map


def compute_relationships(df: pd.DataFrame, min_support: float = 0.008) -> List[Dict]:
    work = df.copy()
    if "transaction_id" in work.columns:
        work["basket_id"] = work["transaction_id"].astype(str)
    else:
        work["basket_id"] = work["store_id"].astype(str) + "_" + work["date"].astype(str)

    total_baskets = int(work["basket_id"].nunique())
    if total_baskets < 2:
        return []

    baskets = work.groupby("basket_id")["product_id"].apply(lambda s: set(map(str, s))).reset_index()
    baskets.columns = ["basket_id", "products"]
    baskets = baskets[baskets["products"].apply(len) > 1]
    if baskets.empty:
        return []

    item_counts: dict = {}
    pair_counts: dict = {}
    for prods in baskets["products"]:
        for p in prods:
            item_counts[p] = item_counts.get(p, 0) + 1
        for a, b in combinations(sorted(prods), 2):
            pair_counts[(a, b)] = pair_counts.get((a, b), 0) + 1

    name_map, _ = _name_maps(work)
    results = []
    for (a, b), count in pair_counts.items():
        support = count / total_baskets
        if support < min_support and count < 8:
            continue
        conf_b_given_a = count / item_counts.get(a, 1)
        conf_a_given_b = count / item_counts.get(b, 1)
        confidence = max(conf_a_given_b, conf_b_given_a)
        lift_den = (item_counts.get(a, 1) / total_baskets) * (item_counts.get(b, 1) / total_baskets)
        lift = (support / lift_den) if lift_den else 0
        strength = min(100.0, support * confidence * 800)

        results.append({
            "product_a_id": a,
            "product_b_id": b,
            "product_a": name_map.get(a, a),
            "product_b": name_map.get(b, b),
            "co_purchase_count": int(count),
            "support": round(float(support), 4),
            "confidence": round(float(confidence), 4),
            "lift": round(float(lift), 3),
            "strength": round(float(strength), 2),
        })

    results = sorted(results, key=lambda x: (x["co_purchase_count"], x["confidence"]), reverse=True)
    return results[:200]


def get_product_relationships(df: pd.DataFrame, product_id: str) -> Dict:
    all_rels = compute_relationships(df)
    pid = str(product_id)
    related = [r for r in all_rels if r["product_a_id"] == pid or r["product_b_id"] == pid]

    normalized = []
    for r in related:
        item = dict(r)
        if item["product_b_id"] == pid:
            item["product_a_id"], item["product_b_id"] = item["product_b_id"], item["product_a_id"]
            item["product_a"], item["product_b"] = item["product_b"], item["product_a"]
        normalized.append(item)

    normalized = sorted(normalized, key=lambda x: x["co_purchase_count"], reverse=True)[:15]
    name_map, cat_map = _name_maps(df)
    return {
        "product_id": pid,
        "product_name": name_map.get(pid, pid),
        "category": cat_map.get(pid, ""),
        "relationships": normalized,
    }


def get_product_list(df: pd.DataFrame) -> List[Dict]:
    work = df.copy()
    if "revenue" not in work.columns and "price" in work.columns:
        disc = work["discount_percent"] if "discount_percent" in work.columns else 0
        work["revenue"] = work["price"] * work["units_sold"] * (1 - disc / 100)
    agg_map = {"total_sold": ("units_sold", "sum")}
    if "revenue" in work.columns:
        agg_map["total_revenue"] = ("revenue", "sum")
    cols = [c for c in ["product_id", "product_name", "category"] if c in work.columns]
    prods = work.groupby(cols).agg(**agg_map).reset_index()
    prods = prods.sort_values("total_sold", ascending=False)
    return prods.to_dict(orient="records")


def get_top_pairs(df: pd.DataFrame, n: int = 10) -> List[Dict]:
    return compute_relationships(df)[:n]
