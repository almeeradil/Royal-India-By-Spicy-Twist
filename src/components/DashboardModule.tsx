import type { Branch, InventoryItem, MenuItem, Order } from '../types';
import { Icon } from './Icon';

interface DashboardModuleProps {
  orders: Order[];
  inventory: InventoryItem[];
  branches: Branch[];
  menuItems: MenuItem[];
  onExportBackup: () => void;
}

export function DashboardModule({
  orders,
  inventory,
  branches,
  menuItems,
  onExportBackup,
}: DashboardModuleProps) {
  const activeOrders = orders.filter((o) => o.status !== 'Cancelled');
  const totalRevenue = activeOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalOrders = orders.length;
  const activeDineIn = orders.filter(
    (o) => o.order_type === 'Dine-in' && o.status !== 'Completed' && o.status !== 'Cancelled'
  ).length;
  const takeawayOrders = orders.filter((o) => o.order_type === 'Takeaway').length;
  const deliveryOrders = orders.filter((o) => o.order_type === 'Delivery').length;
  const totalMenuItemsCount = menuItems.length;
  const lowStockCount = inventory.filter((i) => i.quantity <= i.reorder_level).length;
  const activeBranchesCount = branches.filter((b) => b.status === 'Active').length;

  // Chart 1: Branch Revenue
  const branchRevenueData = branches.map((b) => {
    const rev = activeOrders
      .filter((o) => o.branch_id === b.id)
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    return { name: b.name.split('-')[1]?.trim() || b.name, revenue: rev };
  });
  const maxRevenue = Math.max(...branchRevenueData.map((d) => d.revenue), 1000);

  // Chart 2: Order Channels
  const orderTypeData = [
    { label: 'Dine-In', count: orders.filter((o) => o.order_type === 'Dine-in').length, color: 'bg-orange-500' },
    { label: 'Takeaway', count: takeawayOrders, color: 'bg-amber-500' },
    { label: 'Delivery', count: deliveryOrders, color: 'bg-teal-500' },
  ];
  const maxOrderType = Math.max(...orderTypeData.map((d) => d.count), 1);

  // Chart 3: Hourly Traffic (computed from real order timestamps)
  const hourBuckets = [
    { label: '12 PM', start: 0, end: 13 },
    { label: '2 PM', start: 13, end: 15 },
    { label: '4 PM', start: 15, end: 17 },
    { label: '6 PM', start: 17, end: 19 },
    { label: '8 PM', start: 19, end: 21 },
    { label: '10 PM', start: 21, end: 24 },
  ];
  const hourlySalesData = hourBuckets.map((bucket) => {
    const sales = activeOrders.reduce((sum, o) => {
      const hr = new Date(o.created_at).getHours();
      return hr >= bucket.start && hr < bucket.end ? sum + Number(o.total_amount || 0) : sum;
    }, 0);
    return { hour: bucket.label, sales };
  });
  const maxHourly = Math.max(...hourlySalesData.map((d) => d.sales), 1000);

  // Chart 4: Category Share from ordered items (or menu catalog fallback)
  const catTotals: Record<string, number> = {};
  for (const ord of activeOrders) {
    for (const line of ord.items) {
      const matched = menuItems.find((m) => m.id === line.id || m.name === line.name);
      const cat = matched?.category || 'Other';
      catTotals[cat] = (catTotals[cat] || 0) + Number(line.quantity || 1);
    }
  }
  const totalCatQty = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const catColors = ['bg-orange-500', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-500'];
  const categorySalesData =
    totalCatQty > 0
      ? Object.entries(catTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([cat, qty], idx) => ({
            cat,
            percent: Math.round((qty / totalCatQty) * 100),
            color: catColors[idx % catColors.length],
          }))
      : [
          { cat: 'No ordered dishes yet', percent: 0, color: 'bg-slate-300' },
        ];

  // Chart 5: Payment Methods from real orders
  const totalPaymentCount = activeOrders.length || 1;
  const paymentMethodData = [
    {
      type: 'Cash in Drawer',
      val: Math.round((activeOrders.filter((o) => o.payment_method === 'Cash').length / totalPaymentCount) * 100),
      color: 'bg-emerald-500',
    },
    {
      type: 'Card POS Swipe',
      val: Math.round((activeOrders.filter((o) => o.payment_method === 'Card').length / totalPaymentCount) * 100),
      color: 'bg-indigo-500',
    },
    {
      type: 'Gift Cards & Vouchers',
      val: Math.round((activeOrders.filter((o) => o.payment_method === 'Gift Card').length / totalPaymentCount) * 100),
      color: 'bg-orange-500',
    },
  ];

  // Chart 6: Weekly Revenue Trend (Sun-Sat from real orders)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyTrend = dayNames.map((day, idx) => {
    const jsDay = (idx + 1) % 7;
    const rev = activeOrders
      .filter((o) => new Date(o.created_at).getDay() === jsDay)
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    return { day, rev };
  });
  const maxWeekly = Math.max(...weeklyTrend.map((d) => d.rev), 1000);

  // Chart 7: Order Pipeline Breakdown
  const totalPipe = orders.length || 1;
  const kdsSpeedData = [
    {
      stage: 'New Orders',
      val: Math.round((orders.filter((o) => o.status === 'New Orders').length / totalPipe) * 100),
      color: 'bg-sky-500',
    },
    {
      stage: 'In Preparation',
      val: Math.round((orders.filter((o) => o.status === 'In Preparation').length / totalPipe) * 100),
      color: 'bg-amber-500',
    },
    {
      stage: 'Ready / Completed',
      val: Math.round(
        (orders.filter((o) => o.status === 'Ready for Pickup' || o.status === 'Completed').length /
          totalPipe) *
          100
      ),
      color: 'bg-emerald-500',
    },
  ];

  // Chart 8: Inventory Health from real inventory items
  const inventoryHealthData =
    inventory.length > 0
      ? inventory.slice(0, 4).map((inv) => {
          const target = Math.max(inv.reorder_level * 3, 10);
          const pct = Math.min(100, Math.round((inv.quantity / target) * 100));
          return {
            name: inv.name,
            level: pct,
            color:
              inv.quantity <= inv.reorder_level
                ? 'bg-rose-500'
                : pct < 60
                ? 'bg-amber-500'
                : 'bg-emerald-500',
          };
        })
      : [{ name: 'No inventory items logged', level: 0, color: 'bg-slate-300' }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Royal India By Spicy Twist Executive Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Live cloud-synced multi-branch metrics in{' '}
            <span className="text-orange-600 font-bold">Pakistani Rupees (Rs.)</span>
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <Icon name="cloud" className="w-4 h-4 text-emerald-600" />
            Cloud Sync Active
          </span>
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition hover:bg-orange-600 whitespace-nowrap"
          >
            <Icon name="download" className="w-4 h-4" /> Export Backup
          </button>
        </div>
      </div>

      {/* 8 KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Gross Revenue"
          value={`Rs. ${totalRevenue.toLocaleString()}`}
          subtext="Sales across active orders"
          icon={<Icon name="coins" className="w-5 h-5 text-orange-600" />}
        />
        <KpiCard
          title="Total Orders Count"
          value={totalOrders}
          subtext="All status orders processed"
          icon={<Icon name="clipboard-list" className="w-5 h-5 text-sky-600" />}
        />
        <KpiCard
          title="Active Dine-in Tables"
          value={activeDineIn}
          subtext="Tables currently occupied"
          icon={<Icon name="utensils" className="w-5 h-5 text-amber-600" />}
        />
        <KpiCard
          title="Takeaway Orders"
          value={takeawayOrders}
          subtext="Pickup orders count"
          icon={<Icon name="shopping-bag" className="w-5 h-5 text-indigo-600" />}
        />
        <KpiCard
          title="Delivery Orders"
          value={deliveryOrders}
          subtext="Home delivery dispatch"
          icon={<Icon name="bike" className="w-5 h-5 text-teal-600" />}
        />
        <KpiCard
          title="Total Menu Items"
          value={totalMenuItemsCount}
          subtext="Active food & drink dishes"
          icon={<Icon name="book-open" className="w-5 h-5 text-purple-600" />}
        />
        <KpiCard
          title="Low Stock Alerts"
          value={lowStockCount}
          subtext="Ingredients below reorder level"
          icon={<Icon name="alert-triangle" className="w-5 h-5 text-rose-600" />}
        />
        <KpiCard
          title="Active Branches"
          value={activeBranchesCount}
          subtext="Royal India By Spicy Twist locations"
          icon={<Icon name="building-2" className="w-5 h-5 text-orange-500" />}
        />
      </div>

      {/* 8 ANALYTICAL VISUALIZER CHARTS */}
      <div className="space-y-4 pt-2">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Icon name="pie-chart" className="w-5 h-5 text-orange-600" /> Executive Analytics & Live Charts
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
                <Icon name="bar-chart-3" className="w-4 h-4 text-orange-600" /> 1. Branch Revenue (PKR)
              </h4>
              <p className="text-[11px] text-slate-400 mb-4">Comparison across branches</p>
              <div className="h-36 flex items-end justify-around gap-2 pt-4 border-b border-slate-100">
                {branchRevenueData.map((b, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end">
                    <div
                      className="w-full bg-gradient-to-t from-orange-600 to-amber-500 rounded-t-lg"
                      style={{ height: `${Math.max((b.revenue / maxRevenue) * 100, 8)}%` }}
                      title={`Rs. ${b.revenue.toLocaleString()}`}
                    />
                    <span className="text-[10px] text-slate-600 font-bold mt-2 truncate w-full text-center">
                      {b.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
                <Icon name="pie-chart" className="w-4 h-4 text-amber-600" /> 2. Order Channel Types
              </h4>
              <p className="text-[11px] text-slate-400 mb-4">Dine-in vs Takeaway vs Delivery</p>
              <div className="space-y-3 pt-2">
                {orderTypeData.map((ot, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold tabular-nums">
                      <span className="text-slate-700">{ot.label}</span>
                      <span className="text-orange-600">{ot.count} orders</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`${ot.color} h-2 rounded-full`}
                        style={{ width: `${Math.max((ot.count / maxOrderType) * 100, ot.count > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
                <Icon name="clock" className="w-4 h-4 text-sky-600" /> 3. Peak Hourly Traffic
              </h4>
              <p className="text-[11px] text-slate-400 mb-4">Sales curve across lunch/dinner</p>
              <div className="h-36 flex items-end justify-between gap-1 pt-4 border-b border-slate-100">
                {hourlySalesData.map((hs, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end">
                    <div
                      className="w-full bg-sky-500 rounded-t"
                      style={{ height: `${Math.max((hs.sales / maxHourly) * 100, hs.sales > 0 ? 8 : 4)}%` }}
                      title={`Rs. ${hs.sales.toLocaleString()}`}
                    />
                    <span className="text-[9px] text-slate-500 mt-2 tabular-nums">{hs.hour}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
                <Icon name="layers" className="w-4 h-4 text-emerald-600" /> 4. Menu Category Share
              </h4>
              <p className="text-[11px] text-slate-400 mb-4">Popularity % by food group</p>
              <div className="space-y-2.5">
                {categorySalesData.map((cat, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 tabular-nums">
                      <span className="truncate">{cat.cat}</span>
                      <span className="font-bold text-slate-900">{cat.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className={`${cat.color} h-full`} style={{ width: `${cat.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
                <Icon name="wallet" className="w-4 h-4 text-indigo-600" /> 5. Payment Methods
              </h4>
              <p className="text-[11px] text-slate-400 mb-4">Cash vs Card vs Gift Cards</p>
              <div className="space-y-3">
                {paymentMethodData.map((pm, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold tabular-nums">
                      <span className="text-slate-700">{pm.type}</span>
                      <span className="text-indigo-600">{pm.val}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`${pm.color} h-2 rounded-full`} style={{ width: `${pm.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
                <Icon name="trending-up" className="w-4 h-4 text-emerald-600" /> 6. Weekly Revenue Trend
              </h4>
              <p className="text-[11px] text-slate-400 mb-4">Day-by-day weekly growth</p>
              <div className="h-36 flex items-end justify-between gap-1 pt-4 border-b border-slate-100">
                {weeklyTrend.map((wt, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end">
                    <div
                      className="w-full bg-emerald-500 rounded-t-lg"
                      style={{ height: `${Math.max((wt.rev / maxWeekly) * 100, wt.rev > 0 ? 8 : 4)}%` }}
                      title={`Rs. ${wt.rev.toLocaleString()}`}
                    />
                    <span className="text-[9px] text-slate-500 mt-2 font-bold">{wt.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
                <Icon name="timer" className="w-4 h-4 text-rose-600" /> 7. Kitchen Order Pipeline
              </h4>
              <p className="text-[11px] text-slate-400 mb-4">Live order stage breakdown</p>
              <div className="space-y-3">
                {kdsSpeedData.map((ks, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold tabular-nums">
                      <span className="text-slate-700">{ks.stage}</span>
                      <span>{ks.val}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`${ks.color} h-2 rounded-full`} style={{ width: `${ks.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
                <Icon name="boxes" className="w-4 h-4 text-purple-600" /> 8. Stock Health Status
              </h4>
              <p className="text-[11px] text-slate-400 mb-4">Key ingredient storage levels</p>
              <div className="space-y-3">
                {inventoryHealthData.map((ih, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold tabular-nums">
                      <span className="text-slate-700 truncate">{ih.name}</span>
                      <span>{ih.level}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`${ih.color} h-2 rounded-full`} style={{ width: `${ih.level}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtext,
  icon,
}: {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center justify-between">
      <div>
        <span className="text-xs font-semibold text-slate-500">{title}</span>
        <h3 className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">{value}</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">{subtext}</p>
      </div>
      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">{icon}</div>
    </div>
  );
}
