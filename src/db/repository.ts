import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  attendanceRecords,
  branches,
  cashRegisters,
  customers,
  giftCards,
  inventoryItems,
  menuItems,
  orders,
  promos,
  recipes,
  reservations,
  shifts,
  staffUsers,
  voidLogs,
  wasteLogs,
} from './schema.ts';

function wrapDbError(error: unknown): never {
  console.error('Database query failed:', error);
  throw new Error('Database query failed. Please try again later.', { cause: error });
}

export async function getAllRestaurantData(ownerUid: string) {
  try {
    const [
      branchRows,
      staffRows,
      menuRows,
      orderRows,
      inventoryRows,
      customerRows,
      giftCardRows,
      promoRows,
      reservationRows,
      shiftRows,
      attendanceRows,
      recipeRows,
      voidRows,
      wasteRows,
      registerRows,
    ] = await Promise.all([
      db.select().from(branches).where(eq(branches.ownerUid, ownerUid)),
      db.select().from(staffUsers).where(eq(staffUsers.ownerUid, ownerUid)),
      db.select().from(menuItems).where(eq(menuItems.ownerUid, ownerUid)),
      db.select().from(orders).where(eq(orders.ownerUid, ownerUid)),
      db.select().from(inventoryItems).where(eq(inventoryItems.ownerUid, ownerUid)),
      db.select().from(customers).where(eq(customers.ownerUid, ownerUid)),
      db.select().from(giftCards).where(eq(giftCards.ownerUid, ownerUid)),
      db.select().from(promos).where(eq(promos.ownerUid, ownerUid)),
      db.select().from(reservations).where(eq(reservations.ownerUid, ownerUid)),
      db.select().from(shifts).where(eq(shifts.ownerUid, ownerUid)),
      db.select().from(attendanceRecords).where(eq(attendanceRecords.ownerUid, ownerUid)),
      db.select().from(recipes).where(eq(recipes.ownerUid, ownerUid)),
      db.select().from(voidLogs).where(eq(voidLogs.ownerUid, ownerUid)),
      db.select().from(wasteLogs).where(eq(wasteLogs.ownerUid, ownerUid)),
      db.select().from(cashRegisters).where(eq(cashRegisters.ownerUid, ownerUid)),
    ]);

    return {
      branches: branchRows,
      staffUsers: staffRows,
      menuItems: menuRows,
      orders: orderRows.map((o) => ({
        id: o.id,
        order_number: o.orderNumber,
        branch_id: o.branchId,
        table_number: o.tableNumber,
        customer_name: o.customerName,
        customer_phone: o.customerPhone,
        order_type: o.orderType,
        status: o.status,
        items: o.items,
        subtotal: o.subtotal,
        discount_amount: o.discountAmount,
        tax_amount: o.taxAmount,
        total_amount: o.totalAmount,
        payment_method: o.paymentMethod,
        custom_notes: o.customNotes,
        created_by: o.createdBy,
        created_at: o.createdAtStr,
      })),
      inventory: inventoryRows.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        reorder_level: i.reorderLevel,
        unit: i.unit,
        branch_id: i.branchId,
      })),
      customers: customerRows,
      giftCards: giftCardRows,
      promos: promoRows,
      reservations: reservationRows.map((r) => ({ ...r, table: r.tableName })),
      shifts: shiftRows,
      attendance: attendanceRows,
      recipes: recipeRows,
      voidLogs: voidRows,
      wasteLogs: wasteRows,
      registerState: registerRows[0] || null,
    };
  } catch (error) {
    wrapDbError(error);
  }
}

export async function upsertEntityInSql(
  entity: string,
  id: string,
  payload: Record<string, any>,
  ownerUid: string
) {
  try {
    switch (entity) {
      case 'branches':
        await db
          .insert(branches)
          .values({
            id,
            name: String(payload.name || 'Branch'),
            address: String(payload.address || ''),
            phone: String(payload.phone || ''),
            status: String(payload.status || 'Active'),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: branches.id,
            set: {
              ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
              ...(payload.address !== undefined ? { address: String(payload.address) } : {}),
              ...(payload.phone !== undefined ? { phone: String(payload.phone) } : {}),
              ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'staffUsers':
        await db
          .insert(staffUsers)
          .values({
            id,
            name: String(payload.name || 'Staff'),
            role: String(payload.role || 'Cashier'),
            branchId: String(payload.branch_id || 'all'),
            email: String(payload.email || ''),
            avatar: String(payload.avatar || ''),
            phone: String(payload.phone || ''),
            status: String(payload.status || 'Active'),
            hourlyRate: Number(payload.hourly_rate || 500),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: staffUsers.id,
            set: {
              ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
              ...(payload.role !== undefined ? { role: String(payload.role) } : {}),
              ...(payload.branch_id !== undefined ? { branchId: String(payload.branch_id) } : {}),
              ...(payload.email !== undefined ? { email: String(payload.email) } : {}),
              ...(payload.avatar !== undefined ? { avatar: String(payload.avatar) } : {}),
              ...(payload.phone !== undefined ? { phone: String(payload.phone) } : {}),
              ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
              ...(payload.hourly_rate !== undefined ? { hourlyRate: Number(payload.hourly_rate) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'menuItems':
        await db
          .insert(menuItems)
          .values({
            id,
            name: String(payload.name || 'Dish'),
            category: String(payload.category || 'BBQ'),
            price: Number(payload.price || 1),
            stock: Math.round(Number(payload.stock ?? 50)),
            image: String(payload.image || ''),
            availability: Array.isArray(payload.availability) ? payload.availability : [],
            ownerUid,
          })
          .onConflictDoUpdate({
            target: menuItems.id,
            set: {
              ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
              ...(payload.category !== undefined ? { category: String(payload.category) } : {}),
              ...(payload.price !== undefined ? { price: Number(payload.price) } : {}),
              ...(payload.stock !== undefined ? { stock: Math.round(Number(payload.stock)) } : {}),
              ...(payload.image !== undefined ? { image: String(payload.image) } : {}),
              ...(payload.availability !== undefined ? { availability: payload.availability } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'orders':
        await db
          .insert(orders)
          .values({
            id,
            orderNumber: String(payload.order_number || '#1000'),
            branchId: String(payload.branch_id || 'b1'),
            tableNumber: String(payload.table_number || 'T-01'),
            customerName: String(payload.customer_name || ''),
            customerPhone: String(payload.customer_phone || ''),
            orderType: String(payload.order_type || 'Dine-in'),
            status: String(payload.status || 'New Orders'),
            items: Array.isArray(payload.items) ? payload.items : [],
            subtotal: Number(payload.subtotal || 0),
            discountAmount: Number(payload.discount_amount || 0),
            taxAmount: Number(payload.tax_amount || 0),
            totalAmount: Number(payload.total_amount || 0),
            paymentMethod: String(payload.payment_method || 'Cash'),
            customNotes: String(payload.custom_notes || ''),
            createdBy: String(payload.created_by || 'Admin'),
            createdAtStr: String(payload.created_at || new Date().toISOString()),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: orders.id,
            set: {
              ...(payload.branch_id !== undefined ? { branchId: String(payload.branch_id) } : {}),
              ...(payload.table_number !== undefined ? { tableNumber: String(payload.table_number) } : {}),
              ...(payload.customer_name !== undefined ? { customerName: String(payload.customer_name) } : {}),
              ...(payload.customer_phone !== undefined ? { customerPhone: String(payload.customer_phone) } : {}),
              ...(payload.order_type !== undefined ? { orderType: String(payload.order_type) } : {}),
              ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
              ...(payload.items !== undefined ? { items: payload.items } : {}),
              ...(payload.subtotal !== undefined ? { subtotal: Number(payload.subtotal) } : {}),
              ...(payload.discount_amount !== undefined ? { discountAmount: Number(payload.discount_amount) } : {}),
              ...(payload.tax_amount !== undefined ? { taxAmount: Number(payload.tax_amount) } : {}),
              ...(payload.total_amount !== undefined ? { totalAmount: Number(payload.total_amount) } : {}),
              ...(payload.payment_method !== undefined ? { paymentMethod: String(payload.payment_method) } : {}),
              ...(payload.custom_notes !== undefined ? { customNotes: String(payload.custom_notes) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'inventory':
        await db
          .insert(inventoryItems)
          .values({
            id,
            name: String(payload.name || 'Stock'),
            quantity: Number(payload.quantity || 0),
            reorderLevel: Number(payload.reorder_level || 5),
            unit: String(payload.unit || 'units'),
            branchId: String(payload.branch_id || 'b1'),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: inventoryItems.id,
            set: {
              ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
              ...(payload.quantity !== undefined ? { quantity: Number(payload.quantity) } : {}),
              ...(payload.reorder_level !== undefined ? { reorderLevel: Number(payload.reorder_level) } : {}),
              ...(payload.unit !== undefined ? { unit: String(payload.unit) } : {}),
              ...(payload.branch_id !== undefined ? { branchId: String(payload.branch_id) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'customers':
        await db
          .insert(customers)
          .values({
            id,
            name: String(payload.name || 'Guest'),
            phone: String(payload.phone || ''),
            email: String(payload.email || ''),
            points: Math.round(Number(payload.points || 0)),
            totalSpent: Number(payload.totalSpent || 0),
            visits: Math.round(Number(payload.visits || 0)),
            favorite: String(payload.favorite || ''),
            rating: Math.round(Number(payload.rating || 5)),
            feedback: String(payload.feedback || ''),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: customers.id,
            set: {
              ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
              ...(payload.phone !== undefined ? { phone: String(payload.phone) } : {}),
              ...(payload.email !== undefined ? { email: String(payload.email) } : {}),
              ...(payload.points !== undefined ? { points: Math.round(Number(payload.points)) } : {}),
              ...(payload.totalSpent !== undefined ? { totalSpent: Number(payload.totalSpent) } : {}),
              ...(payload.visits !== undefined ? { visits: Math.round(Number(payload.visits)) } : {}),
              ...(payload.favorite !== undefined ? { favorite: String(payload.favorite) } : {}),
              ...(payload.rating !== undefined ? { rating: Math.round(Number(payload.rating)) } : {}),
              ...(payload.feedback !== undefined ? { feedback: String(payload.feedback) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'giftCards':
        await db
          .insert(giftCards)
          .values({
            id,
            code: String(payload.code || 'GIFT'),
            balance: Number(payload.balance || 0),
            initialValue: Number(payload.initialValue || 100),
            customer: String(payload.customer || 'Guest'),
            status: String(payload.status || 'Active'),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: giftCards.id,
            set: {
              ...(payload.balance !== undefined ? { balance: Number(payload.balance) } : {}),
              ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'promos':
        await db
          .insert(promos)
          .values({
            id,
            code: String(payload.code || 'PROMO'),
            discountType: String(payload.discountType || 'percentage'),
            value: Number(payload.value || 10),
            usageCount: Math.round(Number(payload.usageCount || 0)),
            status: String(payload.status || 'Active'),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: promos.id,
            set: {
              ...(payload.usageCount !== undefined ? { usageCount: Math.round(Number(payload.usageCount)) } : {}),
              ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'reservations':
        await db
          .insert(reservations)
          .values({
            id,
            guestName: String(payload.guestName || 'Guest'),
            phone: String(payload.phone || ''),
            guests: Math.round(Number(payload.guests || 2)),
            date: String(payload.date || ''),
            time: String(payload.time || '20:00'),
            branchId: String(payload.branchId || 'b1'),
            tableName: String(payload.table || 'T-01'),
            status: String(payload.status || 'Confirmed'),
            notes: String(payload.notes || ''),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: reservations.id,
            set: {
              ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
              ...(payload.table !== undefined ? { tableName: String(payload.table) } : {}),
              ...(payload.notes !== undefined ? { notes: String(payload.notes) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'shifts':
        await db
          .insert(shifts)
          .values({
            id,
            userId: String(payload.userId || 'u1'),
            userName: String(payload.userName || 'Staff'),
            role: String(payload.role || 'Cashier'),
            date: String(payload.date || ''),
            startTime: String(payload.startTime || '09:00'),
            endTime: String(payload.endTime || '17:00'),
            branchId: String(payload.branchId || 'b1'),
            status: String(payload.status || 'Scheduled'),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: shifts.id,
            set: {
              ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'attendance':
        await db
          .insert(attendanceRecords)
          .values({
            id,
            userId: String(payload.userId || 'u1'),
            userName: String(payload.userName || 'Staff'),
            clockIn: String(payload.clockIn || ''),
            clockOut: String(payload.clockOut || 'In Progress'),
            totalHours: Number(payload.totalHours || 0),
            date: String(payload.date || ''),
            ownerUid,
          })
          .onConflictDoUpdate({
            target: attendanceRecords.id,
            set: {
              ...(payload.clockOut !== undefined ? { clockOut: String(payload.clockOut) } : {}),
              ...(payload.totalHours !== undefined ? { totalHours: Number(payload.totalHours) } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'recipes':
        await db
          .insert(recipes)
          .values({
            id,
            menuName: String(payload.menuName || 'Recipe'),
            cogs: Number(payload.cogs || 0),
            sellingPrice: Number(payload.sellingPrice || 100),
            ingredients: Array.isArray(payload.ingredients) ? payload.ingredients : [],
            ownerUid,
          })
          .onConflictDoUpdate({
            target: recipes.id,
            set: {
              ...(payload.menuName !== undefined ? { menuName: String(payload.menuName) } : {}),
              ...(payload.cogs !== undefined ? { cogs: Number(payload.cogs) } : {}),
              ...(payload.sellingPrice !== undefined ? { sellingPrice: Number(payload.sellingPrice) } : {}),
              ...(payload.ingredients !== undefined ? { ingredients: Array.isArray(payload.ingredients) ? payload.ingredients : [] } : {}),
              updatedAt: new Date(),
            },
          });
        break;

      case 'voidLogs':
        await db
          .insert(voidLogs)
          .values({
            id,
            orderNumber: String(payload.orderNumber || '#1000'),
            item: String(payload.item || 'Order Void'),
            amount: Number(payload.amount || 0),
            reason: String(payload.reason || ''),
            voidedBy: String(payload.voidedBy || 'Admin'),
            date: String(payload.date || ''),
            ownerUid,
          })
          .onConflictDoNothing();
        break;

      case 'wasteLogs':
        await db
          .insert(wasteLogs)
          .values({
            id,
            ingredient: String(payload.ingredient || 'Item'),
            qty: String(payload.qty || '1'),
            cost: Number(payload.cost || 0),
            reason: String(payload.reason || ''),
            branchId: String(payload.branchId || 'b1'),
            date: String(payload.date || ''),
            ownerUid,
          })
          .onConflictDoNothing();
        break;

      case 'registers':
        await db
          .insert(cashRegisters)
          .values({
            id,
            isOpen: Boolean(payload.isOpen ?? true),
            openingBalance: Number(payload.openingBalance ?? 10000),
            currentCash: Number(payload.currentCash ?? 10000),
            cashDrops: Array.isArray(payload.cashDrops) ? payload.cashDrops : [],
            ownerUid,
          })
          .onConflictDoUpdate({
            target: cashRegisters.id,
            set: {
              isOpen: Boolean(payload.isOpen ?? true),
              openingBalance: Number(payload.openingBalance ?? 10000),
              currentCash: Number(payload.currentCash ?? 10000),
              cashDrops: Array.isArray(payload.cashDrops) ? payload.cashDrops : [],
              updatedAt: new Date(),
            },
          });
        break;

      default:
        break;
    }
  } catch (error) {
    wrapDbError(error);
  }
}

export async function deleteEntityInSql(entity: string, id: string) {
  try {
    switch (entity) {
      case 'menuItems':
        await db.delete(menuItems).where(eq(menuItems.id, id));
        break;
      case 'orders':
        await db.delete(orders).where(eq(orders.id, id));
        break;
      case 'inventory':
        await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
        break;
      case 'branches':
        await db.delete(branches).where(eq(branches.id, id));
        break;
      default:
        break;
    }
  } catch (error) {
    wrapDbError(error);
  }
}
