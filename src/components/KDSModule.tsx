import { useEffect, useState } from 'react';
import { updateCloudDoc } from '../lib/cloudStore';
import type { Branch, Order, OrderStatus, ToastItem } from '../types';
import { Icon } from './Icon';

interface KDSModuleProps {
  orders: Order[];
  branches: Branch[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export function KDSModule({
  orders,
  branches,
  soundEnabled,
  onToggleSound,
  showToast,
}: KDSModuleProps) {
  const [statusFilter, setStatusFilter] = useState<'Active' | OrderStatus>('Active');
  const [nowTick, setNowTick] = useState(Date.now());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const activeOrders = orders.filter((order) => {
    if (statusFilter === 'Active') {
      return order.status !== 'Completed' && order.status !== 'Cancelled';
    }
    return order.status === statusFilter;
  });

  const advanceOrder = async (order: Order) => {
    const nextStatus: OrderStatus =
      order.status === 'New Orders'
        ? 'In Preparation'
        : order.status === 'In Preparation'
        ? 'Ready for Pickup'
        : 'Completed';

    setUpdatingId(order.id);
    try {
      await updateCloudDoc('orders', order.id, { status: nextStatus });
      showToast(`${order.order_number} moved to ${nextStatus}`, 'success');
    } catch {
      showToast('Failed to update order status in cloud.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const getElapsedMinutes = (createdAt: string) => {
    const diff = Math.max(0, Math.floor((nowTick - new Date(createdAt).getTime()) / 60000));
    return diff;
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Icon name="utensils-crossed" className="w-5 h-5 text-orange-600" />
            Live Kitchen Display System (KDS)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Orders placed by waiters on any POS terminal appear here instantaneously.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              soundEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            <Icon name={soundEnabled ? 'volume-2' : 'volume-x'} className="w-4 h-4" />
            {soundEnabled ? 'Kitchen Chime On' : 'Kitchen Chime Muted'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['Active', 'New Orders', 'In Preparation', 'Ready for Pickup'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              statusFilter === tab
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab === 'Active' ? 'All Active Tickets' : tab}
          </button>
        ))}
      </div>

      {activeOrders.length === 0 ? (
        <div className="bg-white border border-slate-200 p-12 rounded-2xl text-center shadow-sm">
          <Icon name="chef-hat" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Kitchen Queue Clear</h3>
          <p className="text-xs text-slate-500 mt-1">
            Waiting for new orders from POS / Waiter terminals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeOrders.map((order) => {
            const minsAgo = getElapsedMinutes(order.created_at);
            const branchName =
              branches.find((b) => b.id === order.branch_id)?.name || order.branch_id;
            const statusStyle =
              order.status === 'New Orders'
                ? 'border-sky-300 bg-sky-50/40'
                : order.status === 'In Preparation'
                ? 'border-amber-300 bg-amber-50/40'
                : 'border-emerald-300 bg-emerald-50/40';

            return (
              <div
                key={order.id}
                className={`bg-white border-2 ${statusStyle} rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900 font-mono tabular-nums">
                        {order.order_number}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {order.order_type} · {order.table_number} ·{' '}
                        <span className="font-mono tabular-nums">{minsAgo}m ago</span>
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        order.status === 'New Orders'
                          ? 'bg-sky-100 text-sky-800'
                          : order.status === 'In Preparation'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800 truncate">{branchName}</p>
                    {order.customer_name && (
                      <p>
                        Guest: <span className="font-semibold">{order.customer_name}</span>
                      </p>
                    )}
                    {order.created_by && (
                      <p>
                        Waiter / POS: <span className="font-semibold">{order.created_by}</span>
                      </p>
                    )}
                  </div>

                  <ul className="divide-y divide-slate-100 border-t border-b border-slate-100 py-2 text-sm">
                    {order.items.map((item, index) => (
                      <li key={`${item.id}-${index}`} className="py-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            <span className="font-mono tabular-nums text-orange-600">
                              {item.quantity}×
                            </span>{' '}
                            {item.name}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-xs font-semibold text-rose-600 mt-0.5">
                            Note: {item.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                  {order.custom_notes && (
                    <p className="text-xs font-semibold text-amber-800 bg-amber-50 rounded-xl p-2.5">
                      Order Note: {order.custom_notes}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={updatingId === order.id}
                  onClick={() => advanceOrder(order)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-2.5 text-xs shadow-sm transition disabled:opacity-60"
                >
                  {updatingId === order.id
                    ? 'Updating...'
                    : order.status === 'New Orders'
                    ? 'Start Preparation'
                    : order.status === 'In Preparation'
                    ? 'Mark Ready for Pickup'
                    : 'Complete Order'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
