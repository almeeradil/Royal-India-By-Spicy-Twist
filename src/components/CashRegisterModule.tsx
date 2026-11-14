import { useState } from 'react';
import { upsertCashRegister } from '../lib/cloudStore';
import { clampNum, clampStr, LIMITS } from '../lib/validation';
import type { Branch, CashRegister, Order, ToastItem } from '../types';
import { Icon } from './Icon';

interface CashRegisterModuleProps {
  registerState: CashRegister;
  registerExistsInCloud: boolean;
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
  setShowZReportModal: (open: boolean) => void;
}

export function CashRegisterModule({
  registerState,
  registerExistsInCloud,
  allowedEmails,
  showToast,
  setShowZReportModal,
}: CashRegisterModuleProps) {
  const [cashDropAmt, setCashDropAmt] = useState('');
  const [cashDropNote, setCashDropNote] = useState('');
  const [openingInput, setOpeningInput] = useState(String(registerState.openingBalance));
  const [editingOpening, setEditingOpening] = useState(false);

  const handleCashDrop = async () => {
    const amount = Number(cashDropAmt);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid drop amount greater than zero.', 'warning');
      return;
    }
    if (amount > registerState.currentCash) {
      showToast('Cash drop cannot exceed the drawer balance.', 'error');
      return;
    }
    try {
      const updatedDrops = [
        ...(registerState.cashDrops || []),
        {
          id: Date.now(),
          amount: Math.round(amount),
          time: new Date().toLocaleTimeString(),
          note: clampStr(cashDropNote || 'Safe drop', LIMITS.shortNameMax),
        },
      ].slice(-LIMITS.maxCashDrops);
      await upsertCashRegister(
        registerState.id || 'main',
        {
          isOpen: registerState.isOpen,
          openingBalance: registerState.openingBalance,
          currentCash: Number(registerState.currentCash) - Math.round(amount),
          cashDrops: updatedDrops,
        },
        allowedEmails,
        registerExistsInCloud
      );
      showToast(`Cash drop of Rs. ${Math.round(amount).toLocaleString()} saved to cloud!`, 'success');
      setCashDropAmt('');
      setCashDropNote('');
    } catch {
      showToast('Failed to record cash drop.', 'error');
    }
  };

  const handleSaveOpening = async () => {
    const newOpening = clampNum(openingInput, 0);
    const delta = newOpening - Number(registerState.openingBalance || 0);
    try {
      await upsertCashRegister(
        registerState.id || 'main',
        {
          isOpen: registerState.isOpen,
          openingBalance: newOpening,
          currentCash: Math.max(0, Number(registerState.currentCash || 0) + delta),
          cashDrops: registerState.cashDrops || [],
        },
        allowedEmails,
        registerExistsInCloud
      );
      setEditingOpening(false);
      showToast('Opening cash float updated in cloud.', 'success');
    } catch {
      showToast('Failed to update opening float.', 'error');
    }
  };

  const handleToggleOpen = async () => {
    try {
      await upsertCashRegister(
        registerState.id || 'main',
        {
          isOpen: !registerState.isOpen,
          openingBalance: registerState.openingBalance,
          currentCash: registerState.currentCash,
          cashDrops: registerState.cashDrops || [],
        },
        allowedEmails,
        registerExistsInCloud
      );
      showToast(
        !registerState.isOpen ? 'Cash register opened.' : 'Cash register closed.',
        'info'
      );
    } catch {
      showToast('Failed to toggle register state.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Cash Register & Shift Control</h2>
          <p className="text-xs text-slate-500">
            Manage float balance, record cash drops, and produce official End-of-Shift Z-Reports
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleToggleOpen}
            className={`px-4 py-2 font-bold rounded-xl text-xs border transition ${
              registerState.isOpen
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          >
            {registerState.isOpen ? 'Drawer Open (Click to Close)' : 'Drawer Closed (Click to Open)'}
          </button>
          <button
            type="button"
            onClick={() => setShowZReportModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-orange-500/20"
          >
            <Icon name="file-text" className="w-4 h-4" /> Print End-of-Shift Z-Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Opening Cash Float</span>
            <button
              type="button"
              onClick={() => {
                setOpeningInput(String(registerState.openingBalance));
                setEditingOpening(!editingOpening);
              }}
              className="text-xs font-bold text-orange-600 hover:underline"
            >
              {editingOpening ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingOpening ? (
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min="0"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-bold"
              />
              <button
                type="button"
                onClick={handleSaveOpening}
                className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white"
              >
                Save
              </button>
            </div>
          ) : (
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
              Rs. {Number(registerState.openingBalance).toLocaleString()}
            </h3>
          )}
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Current Cash in Drawer</span>
          <h3 className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">
            Rs. {Number(registerState.currentCash).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Total Cash Drops Executed</span>
          <h3 className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">
            {(registerState.cashDrops || []).length} Drops
          </h3>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Perform Safe Cash Drop</h3>
        <div className="flex flex-wrap gap-3">
          <input
            type="number"
            min="1"
            placeholder="Drop Amount in Rs...."
            value={cashDropAmt}
            onChange={(e) => setCashDropAmt(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold w-48"
          />
          <input
            type="text"
            maxLength={LIMITS.shortNameMax}
            placeholder="Note (e.g. Safe deposit)..."
            value={cashDropNote}
            onChange={(e) => setCashDropNote(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs flex-1 min-w-[200px]"
          />
          <button
            type="button"
            onClick={handleCashDrop}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
          >
            Execute Drop
          </button>
        </div>

        {(registerState.cashDrops || []).length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-slate-700 mb-2">Recent Cash Drops</h4>
            <div className="divide-y divide-slate-100 text-xs">
              {registerState.cashDrops.map((drop) => (
                <div key={drop.id} className="py-2 flex items-center justify-between tabular-nums">
                  <span className="text-slate-600">
                    {drop.time} · {drop.note || 'Safe Drop'}
                  </span>
                  <span className="font-bold text-slate-900">
                    Rs. {Number(drop.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ZReportModal({
  registerState,
  orders,
  onClose,
}: {
  registerState: CashRegister;
  orders: Order[];
  onClose: () => void;
}) {
  const activeOrders = orders.filter((o) => o.status !== 'Cancelled');
  const cashSales = activeOrders
    .filter((o) => o.payment_method === 'Cash')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalDrops = (registerState.cashDrops || []).reduce(
    (sum, drop) => sum + Number(drop.amount || 0),
    0
  );
  const expectedCash = Number(registerState.openingBalance || 0) + cashSales - totalDrops;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="print-area bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
        <div className="text-center border-b border-dashed border-slate-300 pb-3">
          <h2 className="font-extrabold text-lg text-slate-900">ROYAL INDIA BY SPICY TWIST Z-REPORT</h2>
          <p className="text-[11px] text-slate-500">Official End-of-Shift Terminal Audit</p>
          <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
            {new Date().toLocaleString()}
          </p>
        </div>

        <div className="text-xs space-y-2 text-slate-700 tabular-nums">
          <div className="flex justify-between">
            <span>Opening Cash Float:</span>
            <span className="font-bold">
              Rs. {Number(registerState.openingBalance).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Cash Sales:</span>
            <span className="font-bold text-orange-600">Rs. {cashSales.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Cash Drops:</span>
            <span className="font-bold">Rs. {totalDrops.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Orders Processed:</span>
            <span className="font-bold">{activeOrders.length}</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 font-extrabold text-slate-900">
            <span>Expected Cash In Drawer:</span>
            <span className="text-emerald-600">Rs. {expectedCash.toLocaleString()}</span>
          </div>
        </div>

        <div className="no-print pt-3 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-xl text-xs"
          >
            Print Z-Report
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 bg-slate-200 text-slate-800 font-bold py-2 rounded-xl text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReceiptModal({
  order,
  branch,
  onClose,
}: {
  order: Order;
  branch?: Branch;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="print-area bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
        <div className="text-center border-b border-dashed border-slate-200 pb-4">
          <h2 className="text-lg font-extrabold text-slate-900">ROYAL INDIA BY SPICY TWIST</h2>
          <p className="text-xs text-slate-500">{branch?.name || 'Main Branch'}</p>
          {branch?.address && <p className="text-[10px] text-slate-400">{branch.address}</p>}
          {branch?.phone && <p className="text-[10px] text-slate-400">Phone: {branch.phone}</p>}
        </div>

        <div className="text-xs space-y-1 text-slate-600 tabular-nums">
          <div className="flex justify-between">
            <span>Order Ref:</span>
            <span className="font-bold text-slate-900">{order.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{new Date(order.created_at).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Type / Table:</span>
            <span>
              {order.order_type} ({order.table_number})
            </span>
          </div>
          {order.customer_name && (
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{order.customer_name}</span>
            </div>
          )}
          {order.customer_phone && (
            <div className="flex justify-between">
              <span>Phone:</span>
              <span>{order.customer_phone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Payment:</span>
            <span className="font-bold text-orange-600">{order.payment_method}</span>
          </div>
        </div>

        <div className="border-t border-b border-dashed border-slate-200 py-3 space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs tabular-nums">
              <div>
                <p className="font-bold text-slate-800">{item.name}</p>
                <p className="text-[10px] text-slate-400">
                  {item.quantity} x Rs. {item.price}
                </p>
              </div>
              <span className="font-bold text-slate-900">
                Rs. {(item.quantity * item.price).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-xs text-slate-600 font-medium tabular-nums">
          <div className="flex justify-between">
            <span>Sales Tax (16% GST):</span>
            <span>Included</span>
          </div>
          <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1">
            <span>Total Amount:</span>
            <span className="text-orange-600">
              Rs. {Number(order.total_amount).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="no-print pt-2 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
          >
            <Icon name="printer" className="w-3.5 h-3.5" /> Print Receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 rounded-xl text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
