from pydantic import BaseModel
from typing import Optional, List, Any


class GenerateDatasetRequest(BaseModel):
    records: int = 15000
    products: int = 50
    stores: int = 10
    months: int = 12


class DatasetProfile(BaseModel):
    total_records: int
    total_columns: int
    missing_values: int
    duplicate_records: int
    date_range_start: str
    date_range_end: str
    unique_products: int
    unique_stores: int
    total_sales: float
    avg_transaction_value: float


class DemandPredictRequest(BaseModel):
    product_id: str
    store_id: str
    price: float
    discount_percent: float
    promotion: int
    date: str


class FindingItem(BaseModel):
    id: str
    severity: str
    title: str
    description: str
    evidence: str
    affected_entity: str
    metric: str
    deviation: float


class ProductRelationship(BaseModel):
    product_a: str
    product_b: str
    co_purchase_count: int
    support: float
    confidence: float
    strength: float


class StoreMetric(BaseModel):
    store_id: str
    store_name: str
    revenue: float
    units_sold: int
    avg_order_value: float
    return_rate: float
    performance_score: float
    revenue_change_pct: float
    status: str
