import { useState } from 'react';
import {
  authorizeStaffEmail,
  createCloudDoc,
  deleteCloudDoc,
  revokeStaffEmail,
  syncAllowedEmailsAcrossCollections,
  updateCloudDoc,
} from '../lib/cloudStore';
import { DEFAULT_AVATAR_URL } from '../lib/seed';
import { clampNum, clampStr, LIMITS, sanitizeId } from '../lib/validation';
import type {
  AttendanceRecord,
  AuthorizedStaff,
  Branch,
  InventoryItem,
  MenuItem,
  Shift,
  StaffRole,
  StaffUser,
  ToastItem,
} from '../types';
import { Icon } from './Icon';

const MENU_CATEGORIES = [
  'BBQ',
  'Karahi',
  'Handi',
  'Qorma',
  'Rice',
  'Tandoor & Breads',
  'Burgers',
  'Pizzas',
  'Starters',
  'Chinese',
  'Pasta',
  'Seafood',
  'Deals',
  'Drinks',
  'Desserts',
];

export function StaffDirectoryModule({
  users,
  authorizedStaff,
  branches,
  allowedEmails,
  showToast,
}: {
  users: StaffUser[];
  authorizedStaff: AuthorizedStaff[];
  branches: Branch[];
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const [staffForm, setStaffForm] = useState({
    name: '',
    role: 'Waiter' as StaffRole,
    branch_id: branches[0]?.id || 'b1',
    email: '',
    phone: '',
    hourly_rate: '500',
  });

  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState<'Branch Manager' | 'Cashier' | 'Waiter' | 'Chef' | 'Kitchen'>('Chef');

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = clampStr(staffForm.name, LIMITS.shortNameMax);
    if (!name) {
      showToast('Enter staff member name.', 'error');
      return;
    }
    try {
      const id = sanitizeId(`u-${Date.now()}`, 'u');
      await createCloudDoc(
        'staffUsers',
        id,
        {
          name,
          role: staffForm.role,
          branch_id: staffForm.branch_id || 'all',
          email: clampStr(staffForm.email, LIMITS.emailMax),
          avatar: DEFAULT_AVATAR_URL,
          phone: clampStr(staffForm.phone, LIMITS.phoneMax),
          status: 'Active',
          hourly_rate: clampNum(staffForm.hourly_rate, 0, 1_000_000),
        },
        allowedEmails
      );
      setStaffForm({
        name: '',
        role: 'Waiter',
        branch_id: branches[0]?.id || 'b1',
        email: '',
        phone: '',
        hourly_rate: '500',
      });
      showToast('Staff member added to cloud directory.', 'success');
    } catch {
      showToast('Failed to add staff member.', 'error');
    }
  };

  const handleAuthorizeLaptopEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = authEmail.trim().toLowerCase();
    const name = clampStr(authName || 'Kitchen / Waiter Terminal', LIMITS.shortNameMax);
    if (!email || !email.includes('@')) {
      showToast('Enter a valid Google email address for the other laptop.', 'error');
      return;
    }
    try {
      await authorizeStaffEmail(email, name, authRole);
      const nextList = Array.from(new Set([...allowedEmails, email]));
      await syncAllowedEmailsAcrossCollections(nextList);
      setAuthEmail('');
      setAuthName('');
      showToast(`Cloud sync enabled for ${email}!`, 'success');
    } catch {
      showToast('Failed to authorize staff email.', 'error');
    }
  };

  const handleRevokeEmail = async (email: string) => {
    try {
      await revokeStaffEmail(email);
      const nextList = allowedEmails.filter((item) => item !== email);
      await syncAllowedEmailsAcrossCollections(nextList);
      showToast(`Revoked sync access for ${email}.`, 'info');
    } catch {
      showToast('Failed to revoke access.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Staff & Security Directory</h2>
          <p className="text-xs text-slate-500">
            Manage staff roles (Cashier, Waiter, Chef, Manager), branch access, and hourly rates in PKR
          </p>
        </div>

        <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs pt-2">
          <input
            type="text"
            required
            maxLength={LIMITS.shortNameMax}
            placeholder="Staff Name *"
            value={staffForm.name}
            onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
          />
          <select
            value={staffForm.role}
            onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as StaffRole })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
          >
            <option value="Waiter">Waiter</option>
            <option value="Chef">Chef</option>
            <option value="Kitchen">Kitchen</option>
            <option value="Cashier">Cashier</option>
            <option value="Branch Manager">Branch Manager</option>
            <option value="Super Admin">Super Admin</option>
          </select>
          <select
            value={staffForm.branch_id}
            onChange={(e) => setStaffForm({ ...staffForm, branch_id: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            type="email"
            maxLength={LIMITS.emailMax}
            placeholder="Email"
            value={staffForm.email}
            onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="number"
            min="0"
            placeholder="Hourly Rate (Rs.)"
            value={staffForm.hourly_rate}
            onChange={(e) => setStaffForm({ ...staffForm, hourly_rate: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-2.5"
          >
            Add Staff
          </button>
        </form>
      </div>

      {/* Multi-Laptop Cloud Sync Access */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Icon name="cloud" className="w-4 h-4 text-orange-500" />
            Multi-Laptop Cloud Sync Access (Chef / Waiter Laptops)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Authorize another Google email so a Chef or Waiter on a different laptop can sign in
            with Google and receive live orders and menus instantly.
          </p>
        </div>

        <form onSubmit={handleAuthorizeLaptopEmail} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <input
            type="email"
            required
            placeholder="Chef / Waiter Gmail (e.g. chef@gmail.com)"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
          />
          <input
            type="text"
            maxLength={LIMITS.shortNameMax}
            placeholder="Staff / Terminal Name"
            value={authName}
            onChange={(e) => setAuthName(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <select
            value={authRole}
            onChange={(e) =>
              setAuthRole(
                e.target.value as 'Branch Manager' | 'Cashier' | 'Waiter' | 'Chef' | 'Kitchen'
              )
            }
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
          >
            <option value="Chef">Chef</option>
            <option value="Kitchen">Kitchen</option>
            <option value="Waiter">Waiter</option>
            <option value="Cashier">Cashier</option>
            <option value="Branch Manager">Branch Manager</option>
          </select>
          <button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl py-2.5"
          >
            Authorize Laptop Email
          </button>
        </form>

        {authorizedStaff.length > 0 && (
          <div className="divide-y divide-slate-100 text-xs pt-2">
            {authorizedStaff.map((item) => (
              <div key={item.email} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{item.email}</span>
                  <span className="text-slate-500 ml-2">
                    {item.name} · {item.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeEmail(item.email)}
                  className="font-bold text-rose-600 hover:underline"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {users.map((u) => (
          <div key={u.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={u.avatar || DEFAULT_AVATAR_URL}
                  alt={u.name}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR_URL;
                  }}
                  className="w-12 h-12 rounded-full object-cover border-2 border-orange-500"
                />
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{u.name}</h4>
                  <span className="text-xs font-bold text-orange-600">{u.role}</span>
                </div>
              </div>
              {users.length > 1 && (
                <button
                  type="button"
                  onClick={() => deleteCloudDoc('staffUsers', u.id)}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="text-xs space-y-1 text-slate-600 pt-2 border-t border-slate-100">
              <p>
                Email: <span className="font-medium text-slate-800">{u.email}</span>
              </p>
              <p>
                Phone: <span className="font-medium text-slate-800">{u.phone || '+92 300 0000000'}</span>
              </p>
              <p className="tabular-nums">
                Rate:{' '}
                <span className="font-bold text-orange-600">Rs. {u.hourly_rate || 500} / hr</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SchedulingModule({
  shifts,
  attendance,
  users,
  branches,
  allowedEmails,
  showToast,
}: {
  shifts: Shift[];
  attendance: AttendanceRecord[];
  users: StaffUser[];
  branches: Branch[];
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || 'u1');
  const [shiftForm, setShiftForm] = useState({
    userId: users[0]?.id || 'u1',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    branchId: branches[0]?.id || 'b1',
  });

  const handleClockIn = async () => {
    const staff = users.find((u) => u.id === selectedUserId) || users[0];
    if (!staff) return;
    const timeStr = new Date().toLocaleTimeString();
    try {
      const id = sanitizeId(`a-${Date.now()}`, 'a');
      await createCloudDoc(
        'attendance',
        id,
        {
          userId: staff.id,
          userName: staff.name,
          clockIn: timeStr,
          clockOut: 'In Progress',
          totalHours: 0,
          date: new Date().toISOString().split('T')[0],
        },
        allowedEmails
      );
      showToast(`${staff.name} clocked IN at ${timeStr}`, 'success');
    } catch {
      showToast('Failed to clock in.', 'error');
    }
  };

  const handleClockOut = async (record: AttendanceRecord) => {
    const outStr = new Date().toLocaleTimeString();
    const hours = 8;
    try {
      await updateCloudDoc('attendance', record.id, {
        clockOut: outStr,
        totalHours: hours,
      });
      showToast(`${record.userName} clocked OUT at ${outStr}`, 'info');
    } catch {
      showToast('Failed to clock out.', 'error');
    }
  };

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const staff = users.find((u) => u.id === shiftForm.userId) || users[0];
    if (!staff) return;
    try {
      const id = sanitizeId(`s-${Date.now()}`, 's');
      await createCloudDoc(
        'shifts',
        id,
        {
          userId: staff.id,
          userName: staff.name,
          role: staff.role,
          date: shiftForm.date,
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          branchId: shiftForm.branchId || branches[0]?.id || 'b1',
          status: 'Scheduled',
        },
        allowedEmails
      );
      showToast('Shift scheduled & synced to cloud!', 'success');
    } catch {
      showToast('Failed to schedule shift.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Shift Scheduling & Attendance</h2>
          <p className="text-xs text-slate-500">
            Coordinate shifts, time clocks, and live attendance records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleClockIn}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md"
          >
            <Icon name="clock" className="w-4 h-4" /> Quick Time Clock IN
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Schedule Staff Shift</h3>
        <form onSubmit={handleAddShift} className="grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs">
          <select
            value={shiftForm.userId}
            onChange={(e) => setShiftForm({ ...shiftForm, userId: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={shiftForm.branchId}
            onChange={(e) => setShiftForm({ ...shiftForm, branchId: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={shiftForm.date}
            onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="time"
            value={shiftForm.startTime}
            onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="time"
            value={shiftForm.endTime}
            onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-2.5"
          >
            Add Shift
          </button>
        </form>

        <div className="divide-y divide-slate-100 text-xs">
          {shifts.map((s) => (
            <div key={s.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900">{s.userName}</span>
                <span className="text-slate-500 ml-2">
                  {s.role} · {s.date} ({s.startTime} - {s.endTime})
                </span>
              </div>
              <span className="font-bold text-orange-600">{s.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 overflow-x-auto">
        <h3 className="font-bold text-sm text-slate-900">Attendance & Time Clock Records</h3>
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
            <tr>
              <th className="p-3">Staff Member</th>
              <th className="p-3">Clock In</th>
              <th className="p-3">Clock Out</th>
              <th className="p-3">Total Shift Hours</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attendance.map((a) => (
              <tr key={a.id}>
                <td className="p-3 font-bold text-slate-900">{a.userName}</td>
                <td className="p-3 font-medium text-emerald-600 tabular-nums">{a.clockIn}</td>
                <td className="p-3 font-medium text-slate-600 tabular-nums">{a.clockOut}</td>
                <td className="p-3 font-bold text-orange-600 tabular-nums">{a.totalHours} hrs</td>
                <td className="p-3 text-slate-400 tabular-nums">{a.date}</td>
                <td className="p-3 text-right">
                  {a.clockOut === 'In Progress' && (
                    <button
                      type="button"
                      onClick={() => handleClockOut(a)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold text-[11px]"
                    >
                      Clock Out
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PayrollModule({
  users,
  attendance,
  showToast,
}: {
  users: StaffUser[];
  attendance: AttendanceRecord[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const handleExportCsv = () => {
    const rows = [
      ['Employee', 'Role', 'Hourly Rate (PKR)', 'Logged Hours', 'Gross Wage (PKR)'],
      ...users.map((u) => {
        const hours = attendance
          .filter((a) => a.userId === u.id)
          .reduce((sum, a) => sum + Number(a.totalHours || 0), 0);
        const rate = u.hourly_rate || 500;
        return [u.name, u.role, String(rate), String(hours), String(hours * rate)];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `royal-india-payroll-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Payroll dataset exported to CSV file!', 'info');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Payroll & Tip Declarations</h2>
          <p className="text-xs text-slate-500">
            Calculate total hours worked, hourly wages, and export CSV for payroll processing
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 whitespace-nowrap"
        >
          <Icon name="download" className="w-4 h-4" /> Export Payroll CSV
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
            <tr>
              <th className="p-4">Employee</th>
              <th className="p-4">Role</th>
              <th className="p-4">Hourly Rate (PKR)</th>
              <th className="p-4">Logged Hours</th>
              <th className="p-4">Gross Wage (Rs.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const hours = attendance
                .filter((a) => a.userId === u.id)
                .reduce((sum, a) => sum + Number(a.totalHours || 0), 0);
              const rate = u.hourly_rate || 500;
              const grossWage = hours * rate;
              return (
                <tr key={u.id}>
                  <td className="p-4 font-bold text-slate-900">{u.name}</td>
                  <td className="p-4 font-semibold text-slate-600">{u.role}</td>
                  <td className="p-4 font-medium tabular-nums">Rs. {rate} / hr</td>
                  <td className="p-4 font-bold text-orange-600 tabular-nums">{hours} hrs</td>
                  <td className="p-4 font-extrabold text-emerald-600 tabular-nums">
                    Rs. {grossWage.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MenuManagementModule({
  menuItems,
  branches,
  allowedEmails,
  showToast,
}: {
  menuItems: MenuItem[];
  branches: Branch[];
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    category: 'BBQ',
    price: '',
    stock: '50',
    image: '',
    availability: branches.map((b) => b.id),
  });

  const toggleBranch = (branchId: string) => {
    setForm((prev) => ({
      ...prev,
      availability: prev.availability.includes(branchId)
        ? prev.availability.filter((id) => id !== branchId)
        : [...prev.availability, branchId],
    }));
  };

  const addItem = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = clampStr(form.name, LIMITS.nameMax);
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      showToast(
        'Enter a dish name, a valid price, and a whole-number stock quantity of zero or more.',
        'error'
      );
      return;
    }

    const avail =
      form.availability.length > 0 ? form.availability : branches.map((b) => b.id);

    try {
      const id = sanitizeId(`menu-${Date.now()}`, 'menu');
      await createCloudDoc(
        'menuItems',
        id,
        {
          name,
          category: clampStr(form.category, LIMITS.categoryMax),
          price: clampNum(price, 1, 10_000_000),
          stock: Math.round(clampNum(stock, 0, 1_000_000)),
          image: clampStr(form.image, LIMITS.imageMax),
          availability: avail.slice(0, LIMITS.maxAvailability),
        },
        allowedEmails
      );
      setForm({
        name: '',
        category: 'BBQ',
        price: '',
        stock: '50',
        image: '',
        availability: branches.map((b) => b.id),
      });
      showToast('Menu item added & synced across all terminals!', 'success');
    } catch {
      showToast('Failed to add menu item.', 'error');
    }
  };

  const removeItem = async (id: string) => {
    try {
      await deleteCloudDoc('menuItems', id);
      showToast('Menu item removed.', 'info');
    } catch {
      showToast('Failed to remove menu item.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h2 className="font-bold text-slate-900">Add Menu Item (Cloud Synced)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Items added here immediately appear on every Waiter POS and branch terminal.
          </p>
        </div>
        <form onSubmit={addItem} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <input
              value={form.name}
              maxLength={LIMITS.nameMax}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Dish name"
              className="border border-slate-200 rounded-xl p-2.5 text-sm"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border border-slate-200 rounded-xl p-2.5 text-sm"
            >
              {MENU_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Price (Rs.)"
              className="border border-slate-200 rounded-xl p-2.5 text-sm"
            />
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              placeholder="Stock quantity"
              className="border border-slate-200 rounded-xl p-2.5 text-sm"
            />
            <input
              type="url"
              maxLength={LIMITS.imageMax}
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="Image URL (optional)"
              className="border border-slate-200 rounded-xl p-2.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-slate-600">Available at:</span>
              {branches.map((b) => (
                <label key={b.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.availability.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                    className="accent-orange-500"
                  />
                  <span className="text-slate-700 font-medium">{b.name}</span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl px-5 py-2.5 text-xs"
            >
              Add Menu Item
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase">
            <tr>
              <th className="p-3">Dish</th>
              <th className="p-3">Category</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Availability</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {menuItems.map((item) => (
              <tr key={item.id}>
                <td className="p-3 font-bold text-slate-900">{item.name}</td>
                <td className="p-3">{item.category}</td>
                <td className="p-3 tabular-nums font-semibold">
                  Rs. {Number(item.price).toLocaleString()}
                </td>
                <td className="p-3 tabular-nums">{item.stock ?? 50}</td>
                <td className="p-3">{(item.availability || []).length} branches</td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-rose-600 font-bold hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {menuItems.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No menu items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InventoryModule({
  inventory,
  branches,
  selectedBranchId,
  allowedEmails,
  showToast,
}: {
  inventory: InventoryItem[];
  branches: Branch[];
  selectedBranchId: string;
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const defaultBranch = selectedBranchId !== 'all' ? selectedBranchId : branches[0]?.id || 'b1';
  const [form, setForm] = useState({
    name: '',
    quantity: '',
    reorder_level: '5',
    unit: 'kg',
    branch_id: defaultBranch,
  });

  const addStock = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = clampStr(form.name, LIMITS.nameMax);
    const quantity = Number(form.quantity);
    if (!name || !Number.isFinite(quantity) || quantity < 0) {
      showToast('Enter an ingredient name and a valid quantity.', 'error');
      return;
    }

    try {
      const id = sanitizeId(`stock-${Date.now()}`, 'stock');
      await createCloudDoc(
        'inventory',
        id,
        {
          name,
          quantity: clampNum(quantity, 0, 10_000_000),
          reorder_level: clampNum(form.reorder_level || 0, 0, 10_000_000),
          unit: clampStr(form.unit || 'units', LIMITS.unitMax),
          branch_id: form.branch_id || defaultBranch,
        },
        allowedEmails
      );
      setForm({
        name: '',
        quantity: '',
        reorder_level: '5',
        unit: 'kg',
        branch_id: defaultBranch,
      });
      showToast('Inventory item saved to cloud!', 'success');
    } catch {
      showToast('Failed to add inventory item.', 'error');
    }
  };

  const adjustQuantity = async (item: InventoryItem, delta: number) => {
    const nextQty = Math.max(0, Number(item.quantity) + delta);
    try {
      await updateCloudDoc('inventory', item.id, { quantity: nextQty });
    } catch {
      showToast('Failed to update stock.', 'error');
    }
  };

  const removeStock = async (id: string) => {
    try {
      await deleteCloudDoc('inventory', id);
      showToast('Stock item removed.', 'info');
    } catch {
      showToast('Failed to remove stock item.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-slate-900">Inventory & Stock Control</h2>
        <form onSubmit={addStock} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <input
            value={form.name}
            maxLength={LIMITS.nameMax}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ingredient / stock item"
            className="border border-slate-200 rounded-xl p-2.5 text-sm sm:col-span-2"
          />
          <input
            type="number"
            min="0"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            placeholder="Quantity"
            className="border border-slate-200 rounded-xl p-2.5 text-sm"
          />
          <input
            value={form.unit}
            maxLength={LIMITS.unitMax}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            placeholder="Unit (kg, pcs)"
            className="border border-slate-200 rounded-xl p-2.5 text-sm"
          />
          <input
            type="number"
            min="0"
            value={form.reorder_level}
            onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
            placeholder="Reorder at"
            className="border border-slate-200 rounded-xl p-2.5 text-sm"
          />
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl p-2.5 text-sm"
          >
            Add stock item
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Branch</th>
              <th className="p-3">Quantity</th>
              <th className="p-3">Reorder level</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.map((item) => (
              <tr key={item.id}>
                <td className="p-3 font-bold text-slate-900">{item.name}</td>
                <td className="p-3">
                  {branches.find((branch) => branch.id === item.branch_id)?.name || item.branch_id}
                </td>
                <td className="p-3 tabular-nums">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustQuantity(item, -1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold">
                      {item.quantity} {item.unit || ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustQuantity(item, 1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className="p-3 tabular-nums">{item.reorder_level}</td>
                <td
                  className={`p-3 font-bold ${
                    item.quantity <= item.reorder_level ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {item.quantity <= item.reorder_level ? 'Low stock' : 'In stock'}
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => removeStock(item.id)}
                    className="text-rose-600 font-bold hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {inventory.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No inventory recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BranchManagementModule({
  branches,
  users,
  allowedEmails,
  showToast,
}: {
  branches: Branch[];
  users: StaffUser[];
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  const addBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = clampStr(form.name, LIMITS.nameMax);
    if (!name) {
      showToast('Enter a branch name.', 'error');
      return;
    }

    try {
      const id = sanitizeId(`b-${Date.now()}`, 'b');
      await createCloudDoc(
        'branches',
        id,
        {
          name,
          address: clampStr(form.address, LIMITS.addressMax),
          phone: clampStr(form.phone, LIMITS.phoneMax),
          status: 'Active',
        },
        allowedEmails
      );
      setForm({ name: '', address: '', phone: '' });
      showToast('Branch saved to cloud database!', 'success');
    } catch {
      showToast('Failed to add branch.', 'error');
    }
  };

  const toggleStatus = async (branch: Branch) => {
    const status = branch.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await updateCloudDoc('branches', branch.id, { status });
      showToast(`${branch.name} is now ${status.toLowerCase()}.`, 'success');
    } catch {
      showToast('Failed to update branch status.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-slate-900">Add Branch</h2>
        <form onSubmit={addBranch} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            value={form.name}
            maxLength={LIMITS.nameMax}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Branch name"
            className="border border-slate-200 rounded-xl p-2.5 text-sm"
          />
          <input
            value={form.address}
            maxLength={LIMITS.addressMax}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Address"
            className="border border-slate-200 rounded-xl p-2.5 text-sm"
          />
          <input
            value={form.phone}
            maxLength={LIMITS.phoneMax}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone"
            className="border border-slate-200 rounded-xl p-2.5 text-sm"
          />
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl p-2.5 text-sm"
          >
            Add branch
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map((branch) => (
          <div
            key={branch.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4"
          >
            <div>
              <h3 className="font-bold text-slate-900">{branch.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{branch.address}</p>
              <p className="text-xs text-slate-500 tabular-nums">
                {branch.phone} · {users.filter((user) => user.branch_id === branch.id).length} staff
              </p>
              <span
                className={`text-xs font-bold ${
                  branch.status === 'Active' ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {branch.status}
              </span>
            </div>
            <button
              type="button"
              onClick={() => toggleStatus(branch)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              {branch.status === 'Active' ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
