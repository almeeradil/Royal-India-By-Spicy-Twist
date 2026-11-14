import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const branches = pgTable('branches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  status: text('status').notNull().default('Active'),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const staffUsers = pgTable('staff_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  branchId: text('branch_id').notNull(),
  email: text('email').notNull().default(''),
  avatar: text('avatar').notNull().default(''),
  phone: text('phone').notNull().default(''),
  status: text('status').notNull().default('Active'),
  hourlyRate: doublePrecision('hourly_rate').notNull().default(500),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const menuItems = pgTable('menu_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  price: doublePrecision('price').notNull(),
  stock: integer('stock').notNull().default(50),
  image: text('image').notNull().default(''),
  availability: jsonb('availability').$type<string[]>().notNull().default([]),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  branchId: text('branch_id')
    .references(() => branches.id)
    .notNull(),
  tableNumber: text('table_number').notNull().default('T-01'),
  customerName: text('customer_name').notNull().default(''),
  customerPhone: text('customer_phone').notNull().default(''),
  orderType: text('order_type').notNull().default('Dine-in'),
  status: text('status').notNull().default('New Orders'),
  items: jsonb('items')
    .$type<Array<{ id: string; name: string; price: number; quantity: number; notes?: string }>>()
    .notNull()
    .default([]),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discountAmount: doublePrecision('discount_amount').notNull().default(0),
  taxAmount: doublePrecision('tax_amount').notNull().default(0),
  totalAmount: doublePrecision('total_amount').notNull().default(0),
  paymentMethod: text('payment_method').notNull().default('Cash'),
  customNotes: text('custom_notes').notNull().default(''),
  createdBy: text('created_by').notNull().default('Admin'),
  createdAtStr: text('created_at_str').notNull(),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const inventoryItems = pgTable('inventory_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  quantity: doublePrecision('quantity').notNull().default(0),
  reorderLevel: doublePrecision('reorder_level').notNull().default(5),
  unit: text('unit').notNull().default('units'),
  branchId: text('branch_id')
    .references(() => branches.id)
    .notNull(),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  points: integer('points').notNull().default(0),
  totalSpent: doublePrecision('total_spent').notNull().default(0),
  visits: integer('visits').notNull().default(0),
  favorite: text('favorite').notNull().default(''),
  rating: integer('rating').notNull().default(5),
  feedback: text('feedback').notNull().default(''),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const giftCards = pgTable('gift_cards', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  balance: doublePrecision('balance').notNull().default(0),
  initialValue: doublePrecision('initial_value').notNull().default(0),
  customer: text('customer').notNull().default('Guest'),
  status: text('status').notNull().default('Active'),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const promos = pgTable('promos', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  discountType: text('discount_type').notNull().default('percentage'),
  value: doublePrecision('value').notNull().default(10),
  usageCount: integer('usage_count').notNull().default(0),
  status: text('status').notNull().default('Active'),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const reservations = pgTable('reservations', {
  id: text('id').primaryKey(),
  guestName: text('guest_name').notNull(),
  phone: text('phone').notNull(),
  guests: integer('guests').notNull().default(2),
  date: text('date').notNull(),
  time: text('time').notNull(),
  branchId: text('branch_id')
    .references(() => branches.id)
    .notNull(),
  tableName: text('table_name').notNull().default('T-01'),
  status: text('status').notNull().default('Confirmed'),
  notes: text('notes').notNull().default(''),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const shifts = pgTable('shifts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  role: text('role').notNull(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  branchId: text('branch_id').notNull(),
  status: text('status').notNull().default('Scheduled'),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const attendanceRecords = pgTable('attendance_records', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  clockIn: text('clock_in').notNull(),
  clockOut: text('clock_out').notNull(),
  totalHours: doublePrecision('total_hours').notNull().default(0),
  date: text('date').notNull(),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const recipes = pgTable('recipes', {
  id: text('id').primaryKey(),
  menuName: text('menu_name').notNull(),
  cogs: doublePrecision('cogs').notNull().default(0),
  sellingPrice: doublePrecision('selling_price').notNull().default(0),
  ingredients: jsonb('ingredients')
    .$type<Array<{ name: string; qty: string; cost: number }>>()
    .notNull()
    .default([]),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const voidLogs = pgTable('void_logs', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  item: text('item').notNull(),
  amount: doublePrecision('amount').notNull().default(0),
  reason: text('reason').notNull(),
  voidedBy: text('voided_by').notNull(),
  date: text('date').notNull(),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const wasteLogs = pgTable('waste_logs', {
  id: text('id').primaryKey(),
  ingredient: text('ingredient').notNull(),
  qty: text('qty').notNull(),
  cost: doublePrecision('cost').notNull().default(0),
  reason: text('reason').notNull(),
  branchId: text('branch_id')
    .references(() => branches.id)
    .notNull(),
  date: text('date').notNull(),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const cashRegisters = pgTable('cash_registers', {
  id: text('id').primaryKey(),
  isOpen: boolean('is_open').notNull().default(true),
  openingBalance: doublePrecision('opening_balance').notNull().default(10000),
  currentCash: doublePrecision('current_cash').notNull().default(10000),
  cashDrops: jsonb('cash_drops')
    .$type<Array<{ id: number; amount: number; time: string; note?: string }>>()
    .notNull()
    .default([]),
  ownerUid: text('owner_uid').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const branchesRelations = relations(branches, ({ many }) => ({
  orders: many(orders),
  inventory: many(inventoryItems),
  reservations: many(reservations),
  wasteLogs: many(wasteLogs),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  branch: one(branches, {
    fields: [orders.branchId],
    references: [branches.id],
  }),
}));
