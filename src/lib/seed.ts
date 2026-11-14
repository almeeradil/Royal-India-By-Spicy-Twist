import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AttendanceRecord,
  Branch,
  CashRegister,
  Customer,
  GiftCard,
  InventoryItem,
  MenuItem,
  Order,
  PromoCode,
  Recipe,
  Reservation,
  Shift,
  StaffUser,
  VoidLog,
  WasteLog,
} from '../types';
import { clampNum, clampStr, normalizeAllowedEmails, sanitizeId, LIMITS } from './validation';

export const LOGO_ASSET_URL = '/src/assets/images/royal_india_logo_1794645138138.jpg';
export const DEFAULT_DISH_IMAGE_URL = '/src/assets/images/default_dish_photo_1794645138201.jpg';
export const DEFAULT_AVATAR_URL = '/src/assets/images/avatar_staff_1794645138737.jpg';

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'b1',
    name: 'Royal India By Spicy Twist - Gulberg Main',
    address: 'Main Boulevard, Gulberg III, Lahore',
    phone: '+92 42 111-987-654',
    status: 'Active',
  },
  {
    id: 'b2',
    name: 'Royal India By Spicy Twist - DHA Phase 5',
    address: 'Phase 5 Commercial Area, DHA, Lahore',
    phone: '+92 42 111-987-655',
    status: 'Active',
  },
  {
    id: 'b3',
    name: 'Royal India By Spicy Twist - Johar Town',
    address: 'Emporium Mall Road, Johar Town, Lahore',
    phone: '+92 42 111-987-656',
    status: 'Active',
  },
];

export const INITIAL_USERS: StaffUser[] = [
  {
    id: 'u1',
    name: 'Zuraiz Owner',
    role: 'Super Admin',
    branch_id: 'all',
    email: 'owner@zuraizspecial.com',
    avatar: DEFAULT_AVATAR_URL,
    phone: '+92 300 1234567',
    status: 'Active',
    hourly_rate: 1200,
  },
  {
    id: 'u2',
    name: 'Manager Gulberg',
    role: 'Branch Manager',
    branch_id: 'b1',
    email: 'gulberg@zuraizspecial.com',
    avatar: DEFAULT_AVATAR_URL,
    phone: '+92 301 2345678',
    status: 'Active',
    hourly_rate: 800,
  },
  {
    id: 'u3',
    name: 'Cashier Main',
    role: 'Cashier',
    branch_id: 'b1',
    email: 'cashier@zuraizspecial.com',
    avatar: DEFAULT_AVATAR_URL,
    phone: '+92 302 3456789',
    status: 'Active',
    hourly_rate: 500,
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'Ali Khan',
    phone: '+92 300 9876543',
    email: 'ali.khan@example.com',
    points: 450,
    totalSpent: 18500,
    visits: 12,
    favorite: 'Special Zuraiz Burger',
    rating: 5,
    feedback: 'Best burger in Gulberg!',
  },
  {
    id: 'c2',
    name: 'Sara Ahmed',
    phone: '+92 321 8765432',
    email: 'sara.a@example.com',
    points: 820,
    totalSpent: 34200,
    visits: 22,
    favorite: 'Mutton Karahi',
    rating: 5,
    feedback: 'Always fresh and hot food.',
  },
];

export const INITIAL_GIFT_CARDS: GiftCard[] = [
  {
    id: 'gc1',
    code: 'ZURAIZ-GIFT-1000',
    balance: 1000,
    initialValue: 1000,
    customer: 'Ali Khan',
    status: 'Active',
  },
  {
    id: 'gc2',
    code: 'ZURAIZ-GIFT-5000',
    balance: 3500,
    initialValue: 5000,
    customer: 'Sara Ahmed',
    status: 'Active',
  },
];

export const INITIAL_PROMOS: PromoCode[] = [
  {
    id: 'pr1',
    code: 'PROMO10',
    discountType: 'percentage',
    value: 10,
    usageCount: 45,
    status: 'Active',
  },
  {
    id: 'pr2',
    code: 'ZURAIZ500',
    discountType: 'flat',
    value: 500,
    usageCount: 18,
    status: 'Active',
  },
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: 'r1',
    guestName: 'Usman Chaudhry',
    phone: '+92 333 1122334',
    guests: 4,
    date: '2026-11-09',
    time: '20:00',
    branchId: 'b1',
    table: 'T-04',
    status: 'Confirmed',
    notes: 'Anniversary Dinner',
  },
  {
    id: 'r2',
    guestName: 'Hamza Malik',
    phone: '+92 345 5566778',
    guests: 2,
    date: '2026-11-09',
    time: '21:30',
    branchId: 'b1',
    table: 'Waitlist #1',
    status: 'Waitlist',
    notes: 'Prefers window seat',
  },
];

export const INITIAL_SHIFTS: Shift[] = [
  {
    id: 's1',
    userId: 'u2',
    userName: 'Manager Gulberg',
    role: 'Branch Manager',
    date: '2026-11-09',
    startTime: '09:00',
    endTime: '17:00',
    branchId: 'b1',
    status: 'Scheduled',
  },
  {
    id: 's2',
    userId: 'u3',
    userName: 'Cashier Main',
    role: 'Cashier',
    date: '2026-11-09',
    startTime: '12:00',
    endTime: '20:00',
    branchId: 'b1',
    status: 'Scheduled',
  },
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'a1',
    userId: 'u3',
    userName: 'Cashier Main',
    clockIn: '08:55 AM',
    clockOut: '05:02 PM',
    totalHours: 8.1,
    date: '2026-11-08',
  },
];

export const INITIAL_RECIPES: Recipe[] = [
  {
    id: 'rc1',
    menuName: 'Special Zuraiz Karahi',
    cogs: 850,
    sellingPrice: 1800,
    ingredients: [
      { name: 'Chicken/Mutton', qty: '1 kg', cost: 650 },
      { name: 'Desi Ghee & Spices', qty: '200g', cost: 200 },
    ],
  },
];

export const INITIAL_VOID_LOGS: VoidLog[] = [
  {
    id: 'v1',
    orderNumber: '#1024',
    item: 'Cold Drink',
    amount: 150,
    reason: 'Customer changed mind',
    voidedBy: 'Manager Gulberg',
    date: '2026-11-08 14:30',
  },
];

export const INITIAL_WASTE_LOGS: WasteLog[] = [
  {
    id: 'w1',
    ingredient: 'Fresh Tomatoes',
    qty: '3 kg',
    cost: 450,
    reason: 'Spoiled during storage',
    branchId: 'b1',
    date: '2026-11-08',
  },
];

export const INITIAL_REGISTER: CashRegister = {
  id: 'main',
  isOpen: true,
  openingBalance: 10000,
  currentCash: 10000,
  cashDrops: [],
};

export async function seedInitialCloudDataIfEmpty(
  ownerUid: string,
  allowedEmails: string[]
): Promise<boolean> {
  try {
    const existingBranches = await getDocs(query(collection(db, 'branches'), limit(1)));
    if (!existingBranches.empty) {
      return false;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'branches');
  }

  const emails = normalizeAllowedEmails(allowedEmails);
  const now = serverTimestamp();

  // Seed branches first so relational exists(/branches/{id}) checks pass on subsequent writes.
  try {
    const branchBatch = writeBatch(db);
    for (const branch of INITIAL_BRANCHES) {
      branchBatch.set(doc(db, 'branches', branch.id), {
        ...branch,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      });
    }
    await branchBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'branches');
  }

  try {
    const batch = writeBatch(db);

    for (const user of INITIAL_USERS) {
      batch.set(doc(db, 'staffUsers', user.id), {
        ...user,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const customer of INITIAL_CUSTOMERS) {
      batch.set(doc(db, 'customers', customer.id), {
        ...customer,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const card of INITIAL_GIFT_CARDS) {
      batch.set(doc(db, 'giftCards', card.id), {
        ...card,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const promo of INITIAL_PROMOS) {
      batch.set(doc(db, 'promos', promo.id), {
        ...promo,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const reservation of INITIAL_RESERVATIONS) {
      batch.set(doc(db, 'reservations', reservation.id), {
        ...reservation,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const shift of INITIAL_SHIFTS) {
      batch.set(doc(db, 'shifts', shift.id), {
        ...shift,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const att of INITIAL_ATTENDANCE) {
      batch.set(doc(db, 'attendance', att.id), {
        ...att,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const recipe of INITIAL_RECIPES) {
      batch.set(doc(db, 'recipes', recipe.id), {
        ...recipe,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const log of INITIAL_VOID_LOGS) {
      batch.set(doc(db, 'voidLogs', log.id), {
        ...log,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
      });
    }

    for (const waste of INITIAL_WASTE_LOGS) {
      batch.set(doc(db, 'wasteLogs', waste.id), {
        ...waste,
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
      });
    }

    batch.set(doc(db, 'registers', INITIAL_REGISTER.id), {
      ...INITIAL_REGISTER,
      ownerUid,
      allowedEmails: emails,
      updatedAt: now,
    });

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed');
  }
}

export interface BackupPayload {
  branches: Branch[];
  users: StaffUser[];
  menuItems: MenuItem[];
  orders: Order[];
  inventory: InventoryItem[];
  customers: Customer[];
  giftCards: GiftCard[];
  promos: PromoCode[];
  reservations: Reservation[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  recipes: Recipe[];
  voidLogs: VoidLog[];
  wasteLogs: WasteLog[];
  registerState: CashRegister;
}

export async function restoreBackupToFirestore(
  data: BackupPayload,
  ownerUid: string,
  allowedEmails: string[]
): Promise<void> {
  const emails = normalizeAllowedEmails(allowedEmails);
  const now = serverTimestamp();

  // Commit branches first so relational foreign keys exist.
  const branchBatch = writeBatch(db);
  for (const b of data.branches) {
    const id = sanitizeId(b.id, 'b');
    branchBatch.set(doc(db, 'branches', id), {
      id,
      name: clampStr(b.name || 'Branch', LIMITS.nameMax),
      address: clampStr(b.address, LIMITS.addressMax),
      phone: clampStr(b.phone, LIMITS.phoneMax),
      status: b.status === 'Inactive' ? 'Inactive' : 'Active',
      ownerUid,
      allowedEmails: emails,
      createdAt: now,
      updatedAt: now,
    });
  }
  await branchBatch.commit();

  const fallbackBranchId = sanitizeId(data.branches[0]?.id || 'b1', 'b');
  const ops: Array<{ col: string; id: string; docData: Record<string, unknown> }> = [];

  for (const u of data.users) {
    const id = sanitizeId(u.id, 'u');
    ops.push({
      col: 'staffUsers',
      id,
      docData: {
        id,
        name: clampStr(u.name || 'Staff', LIMITS.shortNameMax),
        role: ['Super Admin', 'Branch Manager', 'Cashier', 'Waiter', 'Chef', 'Kitchen'].includes(u.role)
          ? u.role
          : 'Cashier',
        branch_id: clampStr(u.branch_id || 'all', LIMITS.idMax),
        email: clampStr(u.email, LIMITS.emailMax),
        avatar: clampStr(u.avatar || DEFAULT_AVATAR_URL, LIMITS.imageMax),
        phone: clampStr(u.phone, LIMITS.phoneMax),
        status: u.status === 'Inactive' ? 'Inactive' : 'Active',
        hourly_rate: clampNum(u.hourly_rate, 0, 1_000_000),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const m of data.menuItems) {
    const id = sanitizeId(m.id, 'menu');
    ops.push({
      col: 'menuItems',
      id,
      docData: {
        id,
        name: clampStr(m.name || 'Dish', LIMITS.nameMax),
        category: clampStr(m.category || 'BBQ', LIMITS.categoryMax),
        price: clampNum(m.price, 1, 10_000_000),
        stock: Math.round(clampNum(m.stock ?? 50, 0, 1_000_000)),
        image: clampStr(m.image || '', LIMITS.imageMax),
        availability: (Array.isArray(m.availability) ? m.availability : [fallbackBranchId])
          .slice(0, LIMITS.maxAvailability)
          .map((bid) => sanitizeId(bid, 'b')),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const o of data.orders) {
    const id = sanitizeId(o.id, 'ord');
    const items = (Array.isArray(o.items) ? o.items : [])
      .slice(0, LIMITS.maxOrderItems)
      .map((it) => ({
        id: sanitizeId(it.id || 'item', 'item'),
        name: clampStr(it.name || 'Item', LIMITS.nameMax),
        price: clampNum(it.price, 0, 10_000_000),
        quantity: Math.max(1, Math.round(clampNum(it.quantity, 1, 1000))),
        notes: clampStr(it.notes || '', LIMITS.notesMax),
      }));
    if (items.length === 0) continue;
    const branchId = sanitizeId(o.branch_id || fallbackBranchId, 'b');
    ops.push({
      col: 'orders',
      id,
      docData: {
        id,
        order_number: clampStr(o.order_number || '#1000', LIMITS.orderNumberMax),
        branch_id: branchId,
        table_number: clampStr(o.table_number || 'T-01', LIMITS.tableMax),
        customer_name: clampStr(o.customer_name || '', LIMITS.shortNameMax),
        customer_phone: clampStr(o.customer_phone || '', LIMITS.phoneMax),
        order_type: ['Dine-in', 'Takeaway', 'Delivery'].includes(o.order_type)
          ? o.order_type
          : 'Dine-in',
        status: ['New Orders', 'In Preparation', 'Ready for Pickup', 'Completed', 'Cancelled'].includes(o.status)
          ? o.status
          : 'New Orders',
        items,
        subtotal: clampNum(o.subtotal ?? o.total_amount, 0),
        discount_amount: clampNum(o.discount_amount ?? 0, 0),
        tax_amount: clampNum(o.tax_amount ?? 0, 0),
        total_amount: clampNum(o.total_amount, 0),
        payment_method: ['Cash', 'Card', 'Gift Card'].includes(o.payment_method)
          ? o.payment_method
          : 'Cash',
        custom_notes: clampStr(o.custom_notes || '', LIMITS.notesMax),
        created_by: clampStr(o.created_by || 'Admin', LIMITS.shortNameMax),
        created_at: clampStr(o.created_at || new Date().toISOString(), LIMITS.dateTimeStrMax),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const inv of data.inventory) {
    const id = sanitizeId(inv.id, 'stock');
    ops.push({
      col: 'inventory',
      id,
      docData: {
        id,
        name: clampStr(inv.name || (inv as unknown as { ingredient?: string }).ingredient || 'Stock', LIMITS.nameMax),
        quantity: clampNum(inv.quantity, 0, 10_000_000),
        reorder_level: clampNum(inv.reorder_level, 0, 10_000_000),
        unit: clampStr(inv.unit || 'units', LIMITS.unitMax),
        branch_id: sanitizeId(inv.branch_id || fallbackBranchId, 'b'),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const c of data.customers) {
    const id = sanitizeId(c.id, 'c');
    ops.push({
      col: 'customers',
      id,
      docData: {
        id,
        name: clampStr(c.name || 'Guest', LIMITS.shortNameMax),
        phone: clampStr(c.phone || '', LIMITS.phoneMax),
        email: clampStr(c.email || '', LIMITS.emailMax),
        points: clampNum(c.points, 0),
        totalSpent: clampNum(c.totalSpent, 0),
        visits: clampNum(c.visits, 0),
        favorite: clampStr(c.favorite || '', LIMITS.nameMax),
        rating: clampNum(c.rating ?? 5, 1, 5),
        feedback: clampStr(c.feedback || '', LIMITS.feedbackMax),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const gc of data.giftCards) {
    const id = sanitizeId(gc.id, 'gc');
    ops.push({
      col: 'giftCards',
      id,
      docData: {
        id,
        code: clampStr(gc.code || 'GIFT', LIMITS.codeMax),
        balance: clampNum(gc.balance, 0),
        initialValue: clampNum(gc.initialValue || 100, 1),
        customer: clampStr(gc.customer || 'Guest', LIMITS.shortNameMax),
        status: ['Active', 'Redeemed', 'Inactive'].includes(gc.status) ? gc.status : 'Active',
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const pr of data.promos) {
    const id = sanitizeId(pr.id, 'pr');
    ops.push({
      col: 'promos',
      id,
      docData: {
        id,
        code: clampStr(pr.code || 'PROMO', LIMITS.promoCodeMax),
        discountType: pr.discountType === 'flat' ? 'flat' : 'percentage',
        value: clampNum(pr.value || 10, 1),
        usageCount: clampNum(pr.usageCount, 0),
        status: pr.status === 'Inactive' ? 'Inactive' : 'Active',
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const res of data.reservations) {
    const id = sanitizeId(res.id, 'r');
    ops.push({
      col: 'reservations',
      id,
      docData: {
        id,
        guestName: clampStr(res.guestName || 'Guest', LIMITS.shortNameMax),
        phone: clampStr(res.phone || '+92', LIMITS.phoneMax),
        guests: clampNum(res.guests || 2, 1, 200),
        date: clampStr(res.date || new Date().toISOString().slice(0, 10), LIMITS.dateMax),
        time: clampStr(res.time || '20:00', LIMITS.dateMax),
        branchId: sanitizeId(res.branchId || fallbackBranchId, 'b'),
        table: clampStr(res.table || 'T-01', LIMITS.tableMax),
        status: ['Confirmed', 'Waitlist', 'Seated', 'Cancelled'].includes(res.status) ? res.status : 'Confirmed',
        notes: clampStr(res.notes || '', LIMITS.notesMax),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const sh of data.shifts) {
    const id = sanitizeId(sh.id, 's');
    ops.push({
      col: 'shifts',
      id,
      docData: {
        id,
        userId: sanitizeId(sh.userId || 'u1', 'u'),
        userName: clampStr(sh.userName || 'Staff', LIMITS.shortNameMax),
        role: clampStr(sh.role || 'Cashier', LIMITS.roleMax),
        date: clampStr(sh.date || new Date().toISOString().slice(0, 10), LIMITS.dateMax),
        startTime: clampStr(sh.startTime || '09:00', LIMITS.dateMax),
        endTime: clampStr(sh.endTime || '17:00', LIMITS.dateMax),
        branchId: sanitizeId(sh.branchId || fallbackBranchId, 'b'),
        status: ['Scheduled', 'Completed', 'Cancelled'].includes(sh.status) ? sh.status : 'Scheduled',
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const att of data.attendance) {
    const id = sanitizeId(att.id, 'a');
    ops.push({
      col: 'attendance',
      id,
      docData: {
        id,
        userId: sanitizeId(att.userId || 'u3', 'u'),
        userName: clampStr(att.userName || 'Staff', LIMITS.shortNameMax),
        clockIn: clampStr(att.clockIn || '09:00 AM', LIMITS.phoneMax),
        clockOut: clampStr(att.clockOut || 'In Progress', LIMITS.phoneMax),
        totalHours: clampNum(att.totalHours, 0, 24),
        date: clampStr(att.date || new Date().toISOString().slice(0, 10), LIMITS.dateMax),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const rc of data.recipes) {
    const id = sanitizeId(rc.id, 'rc');
    ops.push({
      col: 'recipes',
      id,
      docData: {
        id,
        menuName: clampStr(rc.menuName || 'Recipe', LIMITS.nameMax),
        cogs: clampNum(rc.cogs, 0),
        sellingPrice: clampNum(rc.sellingPrice || 100, 1),
        ingredients: (Array.isArray(rc.ingredients) ? rc.ingredients : [])
          .slice(0, LIMITS.maxRecipeIngredients)
          .map((ing) => ({
            name: clampStr(ing.name || 'Ingredient', LIMITS.nameMax),
            qty: clampStr(ing.qty || '1', LIMITS.qtyStrMax),
            cost: clampNum(ing.cost, 0),
          })),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const vl of data.voidLogs) {
    const id = sanitizeId(vl.id, 'v');
    ops.push({
      col: 'voidLogs',
      id,
      docData: {
        id,
        orderNumber: clampStr(vl.orderNumber || '#1000', LIMITS.orderNumberMax),
        item: clampStr(vl.item || 'Order Void', LIMITS.nameMax),
        amount: clampNum(vl.amount, 0),
        reason: clampStr(vl.reason || 'Voided', LIMITS.notesMax),
        voidedBy: clampStr(vl.voidedBy || 'Admin', LIMITS.shortNameMax),
        date: clampStr(vl.date || new Date().toLocaleString(), LIMITS.dateTimeStrMax),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
      },
    });
  }

  for (const wl of data.wasteLogs) {
    const id = sanitizeId(wl.id, 'w');
    ops.push({
      col: 'wasteLogs',
      id,
      docData: {
        id,
        ingredient: clampStr(wl.ingredient || 'Item', LIMITS.nameMax),
        qty: clampStr(wl.qty || '1', LIMITS.qtyStrMax),
        cost: clampNum(wl.cost, 0),
        reason: clampStr(wl.reason || 'Expired', LIMITS.notesMax),
        branchId: sanitizeId(wl.branchId || fallbackBranchId, 'b'),
        date: clampStr(wl.date || new Date().toISOString().slice(0, 10), LIMITS.dateMax),
        ownerUid,
        allowedEmails: emails,
        createdAt: now,
      },
    });
  }

  ops.push({
    col: 'registers',
    id: 'main',
    docData: {
      id: 'main',
      isOpen: Boolean(data.registerState?.isOpen ?? true),
      openingBalance: clampNum(data.registerState?.openingBalance ?? 10000, 0),
      currentCash: clampNum(data.registerState?.currentCash ?? 10000, 0),
      cashDrops: (Array.isArray(data.registerState?.cashDrops) ? data.registerState.cashDrops : [])
        .slice(0, LIMITS.maxCashDrops)
        .map((drop) => ({
          id: Number(drop.id) || Date.now(),
          amount: clampNum(drop.amount, 0),
          time: clampStr(drop.time || '', LIMITS.phoneMax),
          note: clampStr(drop.note || '', LIMITS.shortNameMax),
        })),
      ownerUid,
      allowedEmails: emails,
      updatedAt: now,
    },
  });

  // Chunk into batches of 400 to respect Firestore 500-op batch limit.
  for (let i = 0; i < ops.length; i += 400) {
    const chunk = ops.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const op of chunk) {
      batch.set(doc(db, op.col, op.id), op.docData);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'restoreBackup');
    }
  }
}
