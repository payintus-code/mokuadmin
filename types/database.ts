export type BookingStatus = "pending" | "confirmed" | "in_progress" | "done" | "cancelled";
export type BookingType = "grooming" | "hotel";
export type UserRole = "admin" | "staff";
export type TransactionType = "income" | "expense";
export type PaymentMethod = "cash" | "promptpay_qr" | "transfer" | "card" | "other";
export type PaymentStatus = "pending" | "paid" | "cancelled";
export type PaymentCollectionType = "none" | "deposit" | "full";
export type TransactionCategory =
  | "service_income"
  | "hotel_income"
  | "product_income"
  | "other_income"
  | "supplies_expense"
  | "wages_expense"
  | "shampoo_expense"
  | "food_expense"
  | "other_expense";

export type Customer = {
  id: string;
  full_name: string;
  phone: string;
  facebook_name: string | null;
  note: string | null;
};

export type Pet = {
  id: string;
  customer_id: string;
  name: string;
  species: string;
  breed: string | null;
  weight_kg: number | null;
};

export type Service = {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  price: number;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  room_type: string;
  nightly_rate: number;
  max_pets: number;
};

export type DailyScheduleItem = {
  booking_id: string;
  booking_no: string;
  booking_type: BookingType;
  status: BookingStatus;
  payment_status: PaymentStatus;
  start_at: string;
  end_at: string;
  customer_name: string;
  pet_name: string;
  room_name: string | null;
  services_summary: string;
  total_amount: number;
};

export type ScheduleCalendarDay = {
  date: string;
  items: DailyScheduleItem[];
};

export type BookingDetailViewModel = {
  booking_id: string;
  booking_no: string;
  booking_type: BookingType;
  status: BookingStatus;
  payment_status: PaymentStatus;
  start_at: string;
  end_at: string;
  customer_name: string;
  customer_phone: string;
  pet_name: string;
  room_name: string | null;
  services_summary: string;
  total_amount: number;
  note: string | null;
  payment: BookingPayment | null;
};

export type BookingFormPet = {
  id: string;
  customer_id: string;
  name: string;
  species: string;
};

export type CashTransaction = {
  id: string;
  transaction_type: TransactionType;
  category: TransactionCategory;
  booking_id: string | null;
  customer_id: string | null;
  title: string;
  pet_name: string | null;
  amount: number;
  payment_method: PaymentMethod;
  transaction_date: string;
  note: string | null;
};

export type ShopSettings = {
  id: number;
  shop_name: string;
  shop_address: string | null;
  shop_phone: string | null;
  promptpay_target: string | null;
  receipt_prefix: string;
};

export type BookingPayment = {
  id: string;
  booking_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference_no: string | null;
  receipt_no: string | null;
  receipt_issued_at: string | null;
  paid_at: string | null;
  note: string | null;
};

export type ReceiptViewModel = {
  booking_id: string;
  booking_no: string;
  receipt_no: string;
  receipt_issued_at: string;
  shop_name: string;
  shop_address: string | null;
  shop_phone: string | null;
  customer_name: string;
  pet_name: string;
  booking_type: BookingType;
  services_summary: string;
  room_name: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  paid_at: string;
};
