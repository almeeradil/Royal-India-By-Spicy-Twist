import { useState } from 'react';
import { createCloudDoc, deleteCloudDoc, updateCloudDoc } from '../lib/cloudStore';
import { clampNum, clampStr, LIMITS, sanitizeId } from '../lib/validation';
import type {
  Branch,
  MenuItem,
  Order,
  OrderStatus,
  OrderType,
  PaymentMethod,
  StaffUser,
  ToastItem,
} from '../types';
import { Icon } from './Icon';

interface OrderManagementModuleProps {
  orders: Order[];
  branches: Branch[];
  menuItems: MenuItem[];
  selectedBranchId: string;
  currentUser: StaffUser;
  allowedEmails: string[];
  setReceiptModalOrder: (order: Order | null) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

interface FormItemRow {
  item_id: string;
  quantity: number;
  notes: string;
}

export function OrderManagementModule({
  orders,
  branches,
  menuItems,
  selectedBranchId,
  currentUser,
  allowedEmails,
  setReceiptModalOrder,
  showToast,
}: OrderManagementModuleProps) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const [orderForm, setOrderForm] = useState<{
    branch_id: string;
    table_number: string;
    customer_name: string;
    customer_phone: string;
    order_type: OrderType;
    payment_method: PaymentMethod;
    status: OrderStatus;
    items: FormItemRow[];
    custom_notes: string;
  }>({
    branch_id: selectedBranchId !== 'all' ? selectedBranchId : branches[0]?.id || 'b1',
    table_number: 'T-01',
    customer_name: '',
    customer_phone: '',
    order_type: 'Dine-in',
    payment_method: 'Cash',
    status: 'New Orders',
    items: [],
    custom_notes: '',
  });

  const filtered = orders.filter((o) => (statusFilter === 'All' ? true : o.status === statusFilter));

  const handleOpenAddModal = () => {
    setEditingOrder(null);
    setOrderForm({
      branch_id: selectedBranchId !== 'all' ? selectedBranchId : branches[0]?.id || 'b1',
      table_number: 'T-05',
      customer_name: '',
      customer_phone: '',
      order_type: 'Dine-in',
      payment_method: 'Cash',
      status: 'New Orders',
      items: [{ item_id: menuItems[0]?.id || '', quantity: 1, notes: '' }],
      custom_notes: '',
    });
    setAddModalOpen(true);
  };

  const handleOpenEditModal = (ord: Order) => {
    setEditingOrder(ord);
    setOrderForm({
      branch_id: ord.branch_id,
      table_number: ord.table_number,
      customer_name: ord.customer_name || '',
      customer_phone: ord.customer_phone || '',
      order_type: ord.order_type,
      payment_method: ord.payment_method,
      status: ord.status,
      items: ord.items.map((i) => ({
        item_id: i.id || menuItems.find((m) => m.name === i.name)?.id || '',
        quantity: i.quantity,
        notes: i.notes || '',
      })),
      custom_notes: ord.custom_notes || '',
    });
    setAddModalOpen(true);
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    const reason = clampStr(voidReason, LIMITS.notesMax);
    if (!reason) {
      showToast('Please enter a void reason.', 'error');
      return;
    }

    try {
      const voidId = sanitizeId(`v-${Date.now()}`, 'v');
      await createCloudDoc(
        'voidLogs',
        voidId,
        {
          orderNumber: clampStr(voidTarget.order_number, LIMITS.orderNumberMax),
          item: 'Whole Order Voided',
          amount: clampNum(voidTarget.total_amount, 0),
          reason,
          voidedBy: clampStr(currentUser.name, LIMITS.shortNameMax),
          date: clampStr(new Date().toLocaleString(), LIMITS.dateTimeStrMax),
        },
        allowedEmails,
        { hasUpdatedAt: false }
      );
      await deleteCloudDoc('orders', voidTarget.id);
      showToast(`Order ${voidTarget.order_number} voided and logged!`, 'warning');
      setVoidTarget(null);
      setVoidReason('');
    } catch {
      showToast('Failed to void order in cloud database.', 'error');
    }
  };

  const handleAddItemToForm = () => {
    if (orderForm.items.length >= LIMITS.maxOrderItems) {
      showToast(`Maximum ${LIMITS.maxOrderItems} line items per order.`, 'warning');
      return;
    }
    setOrderForm((prev) => ({
      ...prev,
      items: [...prev.items, { item_id: menuItems[0]?.id || '', quantity: 1, notes: '' }],
    }));
  };

  const handleRemoveItemFromForm = (index: number) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderForm.items.length === 0) {
      showToast('Please add at least one item to the order.', 'error');
      return;
    }
    const hasInvalidItem = orderForm.items.some(
      (row) =>
        !menuItems.some((item) => item.id === row.item_id) ||
        !Number.isInteger(Number(row.quantity)) ||
        Number(row.quantity) < 1
    );
    if (hasInvalidItem) {
      showToast('Select a menu item and enter a whole-number quantity of at least 1.', 'error');
      return;
    }

    const compiledItems = orderForm.items.map((row) => {
      const foundItem = menuItems.find((m) => m.id === row.item_id)!;
      return {
        id: foundItem.id,
        name: clampStr(foundItem.name, LIMITS.nameMax),
        price: clampNum(foundItem.price, 0),
        quantity: Math.max(1, Math.round(Number(row.quantity))),
        notes: clampStr(row.notes, LIMITS.notesMax),
      };
    });

    const subtotal = compiledItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const taxAmount = Math.round(subtotal * 0.16);
    const totalAmount = Math.round(subtotal + taxAmount);

    try {
      if (editingOrder) {
        await updateCloudDoc('orders', editingOrder.id, {
          branch_id: orderForm.branch_id,
          table_number: clampStr(orderForm.table_number || 'T-01', LIMITS.tableMax),
          customer_name: clampStr(orderForm.customer_name, LIMITS.shortNameMax),
          customer_phone: clampStr(orderForm.customer_phone, LIMITS.phoneMax),
          order_type: orderForm.order_type,
          payment_method: orderForm.payment_method,
          status: orderForm.status,
          items: compiledItems,
          subtotal: Math.round(subtotal),
          discount_amount: 0,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          custom_notes: clampStr(orderForm.custom_notes, LIMITS.notesMax),
        });
        showToast(`Order ${editingOrder.order_number} updated!`, 'success');
      } else {
        const ordId = sanitizeId(`ord-${Date.now()}`, 'ord');
        const orderNumber = `#${Math.floor(1000 + Math.random() * 9000)}`;
        await createCloudDoc(
          'orders',
          ordId,
          {
            order_number: orderNumber,
            branch_id: orderForm.branch_id,
            table_number: clampStr(orderForm.table_number || 'T-01', LIMITS.tableMax),
            customer_name: clampStr(orderForm.customer_name, LIMITS.shortNameMax),
            customer_phone: clampStr(orderForm.customer_phone, LIMITS.phoneMax),
            order_type: orderForm.order_type,
            status: orderForm.status,
            items: compiledItems,
            subtotal: Math.round(subtotal),
            discount_amount: 0,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            payment_method: orderForm.payment_method,
            custom_notes: clampStr(orderForm.custom_notes, LIMITS.notesMax),
            created_by: clampStr(currentUser.name, LIMITS.shortNameMax),
            created_at: new Date().toISOString(),
          },
          allowedEmails
        );
        showToast(`New Order ${orderNumber} synced to kitchen!`, 'success');
      }
      setAddModalOpen(false);
    } catch {
      showToast('Failed to save order in cloud database.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Order History & Management</h2>
          <p className="text-xs text-slate-500">Create, edit, view receipts, or void branch orders</p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-orange-500/20 transition"
        >
          <Icon name="plus" className="w-4 h-4" /> Create New Order
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['All', 'New Orders', 'In Preparation', 'Ready for Pickup', 'Completed', 'Cancelled'].map(
          (st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          )
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-bold text-[10px] tracking-wider">
            <tr>
              <th className="p-4">Order ID</th>
              <th className="p-4">Branch</th>
              <th className="p-4">Table / Type</th>
              <th className="p-4">Items Count</th>
              <th className="p-4">Total Amount (PKR)</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No orders found matching status filter.
                </td>
              </tr>
            ) : (
              filtered.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-extrabold text-orange-600 font-mono tabular-nums">
                    {ord.order_number}
                  </td>
                  <td className="p-4 font-semibold text-slate-700">
                    {branches.find((b) => b.id === ord.branch_id)?.name || ord.branch_id}
                  </td>
                  <td className="p-4 font-medium">
                    {ord.table_number} <span className="text-slate-400">({ord.order_type})</span>
                  </td>
                  <td className="p-4 font-semibold tabular-nums">{ord.items.length} items</td>
                  <td className="p-4 font-bold text-slate-900 tabular-nums">
                    Rs. {Number(ord.total_amount).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        ord.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : ord.status === 'In Preparation'
                          ? 'bg-amber-100 text-amber-700'
                          : ord.status === 'Cancelled'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setReceiptModalOrder(ord)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition"
                    >
                      Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(ord)}
                      className="px-2.5 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold text-[11px] transition"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVoidTarget(ord);
                        setVoidReason('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-[11px] transition"
                    >
                      Void
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT ORDER MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editingOrder ? `Edit Order ${editingOrder.order_number}` : 'Create New Customer Order'}
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-800"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 block mb-1">Target Branch</label>
                  <select
                    value={orderForm.branch_id}
                    onChange={(e) => setOrderForm({ ...orderForm, branch_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold focus:outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Order Status</label>
                  <select
                    value={orderForm.status}
                    onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value as OrderStatus })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold focus:outline-none"
                  >
                    <option value="New Orders">New Orders</option>
                    <option value="In Preparation">In Preparation</option>
                    <option value="Ready for Pickup">Ready for Pickup</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-500 block mb-1">Order Type</label>
                  <select
                    value={orderForm.order_type}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, order_type: e.target.value as OrderType })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold focus:outline-none"
                  >
                    <option value="Dine-in">Dine-in</option>
                    <option value="Takeaway">Takeaway</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Table Number</label>
                  <input
                    type="text"
                    maxLength={LIMITS.tableMax}
                    value={orderForm.table_number}
                    onChange={(e) => setOrderForm({ ...orderForm, table_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold focus:outline-none"
                    placeholder="T-01"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Payment Method</label>
                  <select
                    value={orderForm.payment_method}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, payment_method: e.target.value as PaymentMethod })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Gift Card">Gift Card</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  maxLength={LIMITS.shortNameMax}
                  placeholder="Customer name"
                  value={orderForm.customer_name}
                  onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
                <input
                  type="tel"
                  maxLength={LIMITS.phoneMax}
                  placeholder="Customer phone"
                  value={orderForm.customer_phone}
                  onChange={(e) => setOrderForm({ ...orderForm, customer_phone: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <input
                type="text"
                maxLength={LIMITS.notesMax}
                placeholder="Kitchen / delivery notes..."
                value={orderForm.custom_notes}
                onChange={(e) => setOrderForm({ ...orderForm, custom_notes: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
              />

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-700 font-bold">Select Order Items</label>
                  <button
                    type="button"
                    onClick={handleAddItemToForm}
                    className="text-orange-600 hover:text-orange-700 font-bold text-[11px] flex items-center gap-1"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="space-y-2">
                  {orderForm.items.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200"
                    >
                      {menuItems.length > 0 ? (
                        <select
                          value={row.item_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOrderForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) => (i === idx ? { ...it, item_id: val } : it)),
                            }));
                          }}
                          className="flex-1 bg-white border border-slate-200 text-xs rounded-lg p-2 font-semibold text-slate-800"
                        >
                          {menuItems.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} (Rs. {m.price})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Add item in Menu Management first"
                          disabled
                          className="flex-1 bg-slate-100 border border-slate-200 text-xs rounded-lg p-2 text-slate-400"
                        />
                      )}
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setOrderForm((prev) => ({
                            ...prev,
                            items: prev.items.map((it, i) => (i === idx ? { ...it, quantity: val } : it)),
                          }));
                        }}
                        className="w-16 bg-white border border-slate-200 text-xs rounded-lg p-2 font-bold text-center"
                      />
                      <input
                        type="text"
                        maxLength={LIMITS.notesMax}
                        placeholder="Notes..."
                        value={row.notes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOrderForm((prev) => ({
                            ...prev,
                            items: prev.items.map((it, i) => (i === idx ? { ...it, notes: val } : it)),
                          }));
                        }}
                        className="w-28 bg-white border border-slate-200 text-xs rounded-lg p-2 text-slate-600"
                      />
                      {orderForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromForm(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700"
                        >
                          <Icon name="trash-2" className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition shadow-md shadow-orange-500/30 text-sm mt-2"
              >
                {editingOrder ? 'Update Order Details' : 'Save & Submit Order'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP VOID REASON MODAL */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleConfirmVoid}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-slate-900">Void Order {voidTarget.order_number}</h3>
            <p className="text-xs text-slate-500">
              Enter the reason for voiding Rs. {Number(voidTarget.total_amount).toLocaleString()}.
              This action is recorded in the Void & Refund audit log.
            </p>
            <input
              required
              maxLength={LIMITS.notesMax}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Customer changed mind"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Confirm Void
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
