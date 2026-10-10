export type Page =
  | 'overview'
  | 'demand'
  | 'detective'
  | 'products'
  | 'stores'
  | 'dataset';

export interface DatasetProfile {
  total_records: number;
  total_columns: number;
  missing_values: number;
  duplicate_records: number;
  date_range_start: string;
  date_range_end: string;
  unique_products: number;
  unique_stores: number;
  total_sales: number;
  avg_transaction_value: number;
  name?: string;
  source?: string;
}
