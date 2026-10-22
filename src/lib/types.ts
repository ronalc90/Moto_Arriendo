import type { Light } from "@/lib/constants";

export type ContractSummary = {
  contract_id: string;
  driver_id: string;
  motorcycle_id: string;
  daily_rate: number;
  max_late_days: number;
  today: string;
  last_due_date: string;
  today_kind: "none" | "rest" | "exempt" | "chargeable";
  chargeable_days: number;
  expected_rate: number;
  paid_rate: number;
  pending_amount: number;
  pending_count: number;
  rate_balance: number;
  installment_debt: number;
  loan_balance: number;
  required_daily_installment: number;
  total_debt: number;
  late_days: number;
  light: Light;
  due_today: number;
  suggested_payment: number;
};

export type ContractOverview = {
  id: string;
  status: "active" | "ended";
  start_date: string;
  end_date: string | null;
  rest_weekdays: number[];
  payment_deadline: string;
  driver_id: string;
  driver_name: string;
  driver_phone: string | null;
  motorcycle_id: string;
  plate: string;
  owner_id: string;
  owner_name: string | null;
  daily_rate: number;
  max_late_days: number;
  today_kind: string;
  chargeable_days: number;
  expected_rate: number;
  paid_rate: number;
  pending_amount: number;
  pending_count: number;
  rate_balance: number;
  installment_debt: number;
  loan_balance: number;
  total_debt: number;
  late_days: number;
  light: Light;
  due_today: number;
  suggested_payment: number;
};

export type Motorcycle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  engine_cc: number | null;
  color: string | null;
  owner_id: string;
  purchase_price: number | null;
  purchase_date: string | null;
  gps_provider: string | null;
  current_km: number;
  status: "active" | "in_shop" | "impounded" | "inactive";
  notes: string | null;
  created_at: string;
};

export type Driver = {
  id: string;
  profile_id: string;
  national_id: string | null;
  license_number: string | null;
  license_category: string | null;
  license_expires_on: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  referred_by: string | null;
  deposit_amount: number;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
};

export type Contract = {
  id: string;
  driver_id: string;
  motorcycle_id: string;
  daily_rate: number;
  rest_weekdays: number[];
  payment_deadline: string;
  max_late_days: number;
  start_date: string;
  end_date: string | null;
  file_path: string | null;
  status: "active" | "ended";
  notes: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  contract_id: string;
  driver_id: string;
  motorcycle_id: string;
  paid_on: string;
  total_amount: number;
  rate_amount: number;
  installment_amount: number;
  loan_id: string | null;
  method: "nequi" | "daviplata" | "transfer" | "cash";
  receipt_path: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type LoanBalance = {
  id: string;
  driver_id: string;
  concept: string;
  amount: number;
  daily_installment: number;
  installment_required: boolean;
  loan_date: string;
  status: "active" | "paid";
  notes: string | null;
  created_at: string;
  paid_amount: number;
  pending_amount: number;
  balance: number;
};

export type DocumentRow = {
  id: string;
  entity: "motorcycle" | "driver";
  motorcycle_id: string | null;
  driver_id: string | null;
  doc_type: string;
  starts_on: string | null;
  expires_on: string | null;
  file_path: string | null;
  notes: string | null;
  created_at: string;
};

export type Expiration = {
  document_id: string | null;
  entity: "motorcycle" | "driver";
  motorcycle_id: string | null;
  driver_id: string | null;
  doc_type: string;
  expires_on: string;
  days_left: number;
  plate: string | null;
  driver_name: string | null;
};

export type Inspection = {
  id: string;
  motorcycle_id: string;
  driver_id: string;
  contract_id: string | null;
  inspected_on: string;
  km: number;
  photo_front: string;
  photo_back: string;
  photo_left: string;
  photo_right: string;
  photo_dashboard: string;
  checklist: Record<string, "ok" | "check">;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

export type DamageReport = {
  id: string;
  motorcycle_id: string;
  driver_id: string;
  reported_on: string;
  description: string;
  photos: string[];
  status: "open" | "in_repair" | "closed";
  resolution_notes: string | null;
  closed_at: string | null;
  created_at: string;
};

export type CalendarDay = {
  day: string;
  kind: "none" | "rest" | "exempt" | "paid" | "partial" | "overdue" | "today" | "upcoming";
  amount_covered: number;
  exempt_reason: string | null;
};
