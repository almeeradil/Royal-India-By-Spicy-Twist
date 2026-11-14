import { useState } from 'react';
import { createCloudDoc, updateCloudDoc } from '../lib/cloudStore';
import { clampNum, clampStr, LIMITS, sanitizeId } from '../lib/validation';
import type {
  Branch,
  Customer,
  GiftCard,
  PromoCode,
  Reservation,
  ToastItem,
} from '../types';

export function LoyaltyModule({
  customers,
  giftCards,
  promos,
  allowedEmails,
  showToast,
}: {
  customers: Customer[];
  giftCards: GiftCard[];
  promos: PromoCode[];
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'flat'>('percentage');
  const [newPromoVal, setNewPromoVal] = useState('');

  const [gcCode, setGcCode] = useState('');
  const [gcCustomer, setGcCustomer] = useState('');
  const [gcAmount, setGcAmount] = useState('');

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = clampStr(newPromoCode.toUpperCase(), LIMITS.promoCodeMax);
    const value = Number(newPromoVal);
    if (!code || !Number.isFinite(value) || value <= 0) {
      showToast('Enter a valid promo code and discount value.', 'error');
      return;
    }

    try {
      const id = sanitizeId(`pr-${Date.now()}`, 'pr');
      await createCloudDoc(
        'promos',
        id,
        {
          code,
          discountType: newPromoType,
          value: clampNum(value, 1),
          usageCount: 0,
          status: 'Active',
        },
        allowedEmails
      );
      setNewPromoCode('');
      setNewPromoVal('');
      showToast('Promo campaign saved to cloud!', 'success');
    } catch {
      showToast('Failed to create promo code.', 'error');
    }
  };

  const handleIssueGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = clampStr(gcCode.toUpperCase(), LIMITS.codeMax);
    const customer = clampStr(gcCustomer, LIMITS.shortNameMax);
    const amount = Number(gcAmount);
    if (!code || !customer || !Number.isFinite(amount) || amount <= 0) {
      showToast('Enter voucher code, customer name, and amount.', 'error');
      return;
    }

    try {
      const id = sanitizeId(`gc-${Date.now()}`, 'gc');
      await createCloudDoc(
        'giftCards',
        id,
        {
          code,
          balance: clampNum(amount, 1),
          initialValue: clampNum(amount, 1),
          customer,
          status: 'Active',
        },
        allowedEmails
      );
      setGcCode('');
      setGcCustomer('');
      setGcAmount('');
      showToast(`Gift card ${code} issued & synced to cloud!`, 'success');
    } catch {
      showToast('Failed to issue gift card.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Active Loyalty Members</span>
          <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {customers.length} Members
          </h3>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Active Gift Card Balances</span>
          <h3 className="text-2xl font-extrabold text-orange-600 mt-1 tabular-nums">
            Rs. {giftCards.reduce((sum, g) => sum + Number(g.balance || 0), 0).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Active Promo Campaigns</span>
          <h3 className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">
            {promos.length} Campaigns
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Create New Promo Campaign Code</h3>
          <form onSubmit={handleAddPromo} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <input
              type="text"
              required
              maxLength={LIMITS.promoCodeMax}
              placeholder="Code (e.g. ZURAIZ20)"
              value={newPromoCode}
              onChange={(e) => setNewPromoCode(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold uppercase"
            />
            <select
              value={newPromoType}
              onChange={(e) => setNewPromoType(e.target.value as 'percentage' | 'flat')}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
            >
              <option value="percentage">% Off</option>
              <option value="flat">Flat Rs.</option>
            </select>
            <input
              type="number"
              required
              min="1"
              placeholder="Value..."
              value={newPromoVal}
              onChange={(e) => setNewPromoVal(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
            />
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl"
            >
              Add Campaign
            </button>
          </form>

          <div className="divide-y divide-slate-100 text-xs">
            {promos.map((p) => (
              <div key={p.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-orange-600">{p.code}</span>
                  <span className="text-slate-500 ml-2">
                    {p.discountType === 'flat' ? `Rs. ${p.value} off` : `${p.value}% off`} ·{' '}
                    {p.usageCount} uses
                  </span>
                </div>
                <span className="font-bold text-emerald-700">{p.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Issue Digital Gift Card</h3>
          <form onSubmit={handleIssueGiftCard} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <input
              type="text"
              required
              maxLength={LIMITS.codeMax}
              placeholder="Voucher Code"
              value={gcCode}
              onChange={(e) => setGcCode(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold uppercase"
            />
            <input
              type="text"
              required
              maxLength={LIMITS.shortNameMax}
              placeholder="Customer Name"
              value={gcCustomer}
              onChange={(e) => setGcCustomer(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
            />
            <input
              type="number"
              required
              min="1"
              placeholder="Amount (Rs.)"
              value={gcAmount}
              onChange={(e) => setGcAmount(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl"
            >
              Issue Card
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 overflow-x-auto">
        <h3 className="font-bold text-sm text-slate-900">Issued Digital Gift Cards</h3>
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
            <tr>
              <th className="p-3">Card Voucher Code</th>
              <th className="p-3">Assigned Customer</th>
              <th className="p-3">Remaining Balance</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {giftCards.map((gc) => (
              <tr key={gc.id}>
                <td className="p-3 font-mono font-bold text-orange-600">{gc.code}</td>
                <td className="p-3 font-semibold text-slate-800">{gc.customer}</td>
                <td className="p-3 font-bold text-slate-900 tabular-nums">
                  Rs. {Number(gc.balance).toLocaleString()}
                </td>
                <td className="p-3">
                  <span className="font-bold text-emerald-700">{gc.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CustomerDirectoryModule({
  customers,
  allowedEmails,
  showToast,
}: {
  customers: Customer[];
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    points: '0',
    totalSpent: '0',
    visits: '1',
    favorite: '',
    rating: '5',
    feedback: '',
  });

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = clampStr(form.name, LIMITS.shortNameMax);
    if (!name) {
      showToast('Enter customer name.', 'error');
      return;
    }
    try {
      const id = sanitizeId(`c-${Date.now()}`, 'c');
      await createCloudDoc(
        'customers',
        id,
        {
          name,
          phone: clampStr(form.phone, LIMITS.phoneMax),
          email: clampStr(form.email, LIMITS.emailMax),
          points: clampNum(form.points, 0),
          totalSpent: clampNum(form.totalSpent, 0),
          visits: clampNum(form.visits, 0),
          favorite: clampStr(form.favorite || 'House Special', LIMITS.nameMax),
          rating: clampNum(form.rating, 1, 5),
          feedback: clampStr(form.feedback || 'Great dining experience', LIMITS.feedbackMax),
        },
        allowedEmails
      );
      setForm({
        name: '',
        phone: '',
        email: '',
        points: '0',
        totalSpent: '0',
        visits: '1',
        favorite: '',
        rating: '5',
        feedback: '',
      });
      showToast('Customer added & synced to cloud CRM!', 'success');
    } catch {
      showToast('Failed to add customer.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Royal India By Spicy Twist Customer CRM</h2>
          <p className="text-xs text-slate-500">
            Track lifetime spend, favorite orders, ratings, and contact info
          </p>
        </div>

        <form onSubmit={handleAddCustomer} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-2">
          <input
            type="text"
            required
            maxLength={LIMITS.shortNameMax}
            placeholder="Customer Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
          />
          <input
            type="tel"
            maxLength={LIMITS.phoneMax}
            placeholder="Phone (+92...)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="email"
            maxLength={LIMITS.emailMax}
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="text"
            maxLength={LIMITS.nameMax}
            placeholder="Favorite Dish"
            value={form.favorite}
            onChange={(e) => setForm({ ...form, favorite: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="number"
            min="0"
            placeholder="Loyalty Points"
            value={form.points}
            onChange={(e) => setForm({ ...form, points: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="number"
            min="0"
            placeholder="Lifetime Spend (Rs.)"
            value={form.totalSpent}
            onChange={(e) => setForm({ ...form, totalSpent: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="text"
            maxLength={LIMITS.feedbackMax}
            placeholder="Feedback / Review..."
            value={form.feedback}
            onChange={(e) => setForm({ ...form, feedback: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-2.5"
          >
            Add Customer
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
            <tr>
              <th className="p-4">Customer Name</th>
              <th className="p-4">Phone & Email</th>
              <th className="p-4">Loyalty Points</th>
              <th className="p-4">Lifetime Spend (Rs.)</th>
              <th className="p-4">Favorite Dish</th>
              <th className="p-4">Recent Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-4 font-extrabold text-slate-900">{c.name}</td>
                <td className="p-4 text-slate-600">
                  <div>{c.phone}</div>
                  <div className="text-[10px] text-slate-400">{c.email}</div>
                </td>
                <td className="p-4 font-bold text-orange-600 tabular-nums">{c.points} pts</td>
                <td className="p-4 font-bold text-slate-900 tabular-nums">
                  Rs. {Number(c.totalSpent).toLocaleString()}
                </td>
                <td className="p-4 font-medium text-slate-700">{c.favorite}</td>
                <td className="p-4 text-slate-500 italic">"{c.feedback}"</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReservationsModule({
  reservations,
  branches,
  selectedBranchId,
  allowedEmails,
  showToast,
}: {
  reservations: Reservation[];
  branches: Branch[];
  selectedBranchId: string;
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const defaultBranch = selectedBranchId !== 'all' ? selectedBranchId : branches[0]?.id || 'b1';
  const [resForm, setResForm] = useState({
    guestName: '',
    phone: '',
    guests: '2',
    date: new Date().toISOString().split('T')[0],
    time: '20:00',
    branchId: defaultBranch,
    table: 'T-01',
    status: 'Confirmed' as Reservation['status'],
    notes: '',
  });

  const handleAddRes = async (e: React.FormEvent) => {
    e.preventDefault();
    const guestName = clampStr(resForm.guestName, LIMITS.shortNameMax);
    const phone = clampStr(resForm.phone, LIMITS.phoneMax);
    const guests = Number(resForm.guests);
    if (!guestName || !phone || !Number.isFinite(guests) || guests < 1) {
      showToast('Enter guest name, phone, and party size.', 'error');
      return;
    }

    try {
      const id = sanitizeId(`r-${Date.now()}`, 'r');
      await createCloudDoc(
        'reservations',
        id,
        {
          guestName,
          phone,
          guests: clampNum(guests, 1, 200),
          date: clampStr(resForm.date || new Date().toISOString().split('T')[0], LIMITS.dateMax),
          time: clampStr(resForm.time || '20:00', LIMITS.dateMax),
          branchId: resForm.branchId || defaultBranch,
          table: clampStr(resForm.table || 'T-01', LIMITS.tableMax),
          status: resForm.status,
          notes: clampStr(resForm.notes, LIMITS.notesMax),
        },
        allowedEmails
      );
      setResForm({
        guestName: '',
        phone: '',
        guests: '2',
        date: new Date().toISOString().split('T')[0],
        time: '20:00',
        branchId: defaultBranch,
        table: 'T-01',
        status: 'Confirmed',
        notes: '',
      });
      showToast(`Reservation saved for ${guestName}!`, 'success');
    } catch {
      showToast('Failed to save reservation.', 'error');
    }
  };

  const handleStatusChange = async (res: Reservation, nextStatus: Reservation['status']) => {
    try {
      await updateCloudDoc('reservations', res.id, { status: nextStatus });
      showToast(`Reservation updated to ${nextStatus}.`, 'success');
    } catch {
      showToast('Failed to update reservation.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900">
          Book Table Reservation / Walk-in Waitlist
        </h3>
        <form onSubmit={handleAddRes} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-medium">
          <input
            type="text"
            required
            maxLength={LIMITS.shortNameMax}
            placeholder="Guest Name..."
            value={resForm.guestName}
            onChange={(e) => setResForm({ ...resForm, guestName: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
          />
          <input
            type="text"
            required
            maxLength={LIMITS.phoneMax}
            placeholder="Phone (+92...)"
            value={resForm.phone}
            onChange={(e) => setResForm({ ...resForm, phone: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="number"
            required
            min="1"
            max="200"
            placeholder="Guests count"
            value={resForm.guests}
            onChange={(e) => setResForm({ ...resForm, guests: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
          />
          <select
            value={resForm.branchId}
            onChange={(e) => setResForm({ ...resForm, branchId: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={resForm.date}
            onChange={(e) => setResForm({ ...resForm, date: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="time"
            value={resForm.time}
            onChange={(e) => setResForm({ ...resForm, time: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="text"
            maxLength={LIMITS.tableMax}
            placeholder="Table (e.g. T-04)"
            value={resForm.table}
            onChange={(e) => setResForm({ ...resForm, table: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <select
            value={resForm.status}
            onChange={(e) =>
              setResForm({ ...resForm, status: e.target.value as Reservation['status'] })
            }
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
          >
            <option value="Confirmed">Confirmed</option>
            <option value="Waitlist">Waitlist</option>
          </select>
          <input
            type="text"
            maxLength={LIMITS.notesMax}
            placeholder="Special notes (e.g. Window seat, Anniversary)..."
            value={resForm.notes}
            onChange={(e) => setResForm({ ...resForm, notes: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 md:col-span-3"
          />
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-2.5"
          >
            Confirm Booking
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
            <tr>
              <th className="p-4">Guest Name</th>
              <th className="p-4">Phone</th>
              <th className="p-4">Party Size</th>
              <th className="p-4">Date, Time & Table</th>
              <th className="p-4">Notes</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reservations.map((r) => (
              <tr key={r.id}>
                <td className="p-4 font-bold text-slate-900">{r.guestName}</td>
                <td className="p-4 text-slate-600">{r.phone}</td>
                <td className="p-4 font-bold text-orange-600 tabular-nums">{r.guests} Guests</td>
                <td className="p-4 font-medium tabular-nums">
                  {r.date} · {r.time} ({r.table})
                </td>
                <td className="p-4 text-slate-500">{r.notes}</td>
                <td className="p-4">
                  <select
                    value={r.status}
                    disabled={r.status === 'Cancelled'}
                    onChange={(e) =>
                      handleStatusChange(r, e.target.value as Reservation['status'])
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Waitlist">Waitlist</option>
                    <option value="Seated">Seated</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
