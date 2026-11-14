export type BranchStatus = 'Active' | 'Inactive';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: BranchStatus;
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type StaffRole =
  | 'Super Admin'
  | 'Branch Manager'
  | 'Cashier'
  | 'Waiter'
  | 'Chef'
  | 'Kitchen';

export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole;
  branch_id: string;
  email: string;
  avatar: string;
  phone: string;
  status: 'Active' | 'Inactive';
  hourly_rate: number;
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuthorizedStaff {
  email: string;
  name: string;
  role: 'Branch Manager' | 'Cashier' | 'Waiter' | 'Chef' | 'Kitchen';
  addedByUid: string;
  createdAt?: unknown;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string;
  availability: string[];
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderLineItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

export type OrderType = 'Dine-in' | 'Takeaway' | 'Delivery';
export type OrderStatus =
  | 'New Orders'
  | 'In Preparation'
  | 'Ready for Pickup'
  | 'Completed'
  | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Card' | 'Gift Card';

export interface Order {
  id: string;
  order_number: string;
  branch_id: string;
  table_number: string;
  customer_name: string;
  customer_phone: string;
  order_type: OrderType;
  status: OrderStatus;
  items: OrderLineItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  custom_notes: string;
  created_by: string;
  created_at: string;
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  reorder_level: number;
  unit: string;
  branch_id: string;
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  totalSpent: number;
  visits: number;
  favorite: string;
  rating: number;
  feedback: string;
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GiftCard {
  id: string;
  code: string;
  balance: number;
  initialValue: number;
  customer: string;
  status: 'Active' | 'Redeemed' | 'Inactive';
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'flat';
  value: number;
  usageCount: number;
  status: 'Active' | 'Inactive';
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Reservation {
  id: string;
  guestName: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  branchId: string;
  table: string;
  status: 'Confirmed' | 'Waitlist' | 'Seated' | 'Cancelled';
  notes: string;
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  role: string;
  date: string;
  startTime: string;
  endTime: string;
  branchId: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  clockIn: string;
  clockOut: string;
  totalHours: number;
  date: string;
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RecipeIngredient {
  name: string;
  qty: string;
  cost: number;
}

export interface Recipe {
  id: string;
  menuName: string;
  cogs: number;
  sellingPrice: number;
  ingredients: RecipeIngredient[];
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VoidLog {
  id: string;
  orderNumber: string;
  item: string;
  amount: number;
  reason: string;
  voidedBy: string;
  date: string;
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
}

export interface WasteLog {
  id: string;
  ingredient: string;
  qty: string;
  cost: number;
  reason: string;
  branchId: string;
  date: string;
  ownerUid?: string;
  allowedEmails?: string[];
  createdAt?: unknown;
}

export interface CashDrop {
  id: number;
  amount: number;
  time: string;
  note?: string;
}

export interface CashRegister {
  id: string;
  isOpen: boolean;
  openingBalance: number;
  currentCash: number;
  cashDrops: CashDrop[];
  ownerUid?: string;
  allowedEmails?: string[];
  updatedAt?: unknown;
}

export type ActiveTab =
  | 'dashboard'
  | 'pos'
  | 'kds'
  | 'orders'
  | 'register'
  | 'reports'
  | 'labor_report'
  | 'recipes'
  | 'loyalty'
  | 'customers'
  | 'reservations'
  | 'staff'
  | 'scheduling'
  | 'payroll'
  | 'menu'
  | 'inventory'
  | 'branches';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface AppNotification {
  id: number;
  title: string;
  msg: string;
  time: string;
  unread: boolean;
}
