import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CashRegisterModule, ReceiptModal, ZReportModal } from './components/CashRegisterModule';
import {
  CustomerDirectoryModule,
  LoyaltyModule,
  ReservationsModule,
} from './components/CustomerAndGrowthModules';
import { DashboardModule } from './components/DashboardModule';
import { Icon } from './components/Icon';
import { KDSModule } from './components/KDSModule';
import { LoginScreen } from './components/LoginScreen';
import { OrderManagementModule } from './components/OrderManagementModule';
import { POSModule } from './components/POSModule';
import {
  LaborReportModule,
  RecipesModule,
  SalesReportsModule,
} from './components/ReportsAndCostingModules';
import {
  BranchManagementModule,
  InventoryModule,
  MenuManagementModule,
  PayrollModule,
  SchedulingModule,
  StaffDirectoryModule,
} from './components/StaffAndOperationsModules';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_AVATAR_URL,
  INITIAL_REGISTER,
  INITIAL_USERS,
  LOGO_ASSET_URL,
  restoreBackupToFirestore,
  seedInitialCloudDataIfEmpty,
  type BackupPayload,
} from './lib/seed';
import { normalizeAllowedEmails } from './lib/validation';
import type {
  ActiveTab,
  AppNotification,
  AttendanceRecord,
  AuthorizedStaff,
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
  ToastItem,
  VoidLog,
  WasteLog,
} from './types';

function playKitchenChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.08, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.36);
    });
  } catch {
    // Ignore autoplay restriction if user hasn't interacted yet
  }
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [portalUnlocked, setPortalUnlocked] = useState(false);
  const [cloudBootstrapping, setCloudBootstrapping] = useState(false);
  const [queuedBackup, setQueuedBackup] = useState<BackupPayload | null>(null);

  // Live Cloud State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<StaffUser[]>(INITIAL_USERS);
  const [authorizedStaff, setAuthorizedStaff] = useState<AuthorizedStaff[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [voidLogs, setVoidLogs] = useState<VoidLog[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [registerState, setRegisterState] = useState<CashRegister>(INITIAL_REGISTER);
  const [registerExistsInCloud, setRegisterExistsInCloud] = useState(false);

  // UI Navigation & Filters
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [currentUserId, setCurrentUserId] = useState(INITIAL_USERS[0].id);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 1,
      title: 'Cloud Sync Connected',
      msg: 'Real-time PKR POS & Kitchen Display sync active.',
      time: 'Just now',
      unread: true,
    },
  ]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);
  const [showZReportModal, setShowZReportModal] = useState(false);

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const ordersLoadedOnceRef = useRef(false);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const showToast = (message: string, type: ToastItem['type'] = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeTab]);

  // Listen for Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user && user.emailVerified) {
        setPortalUnlocked(true);
      } else {
        setPortalUnlocked(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const isAuthenticated = Boolean(
    authReady && portalUnlocked && firebaseUser && firebaseUser.emailVerified
  );

  // Seed or restore backup once authenticated, and attach live Firestore listeners
  useEffect(() => {
    if (!isAuthenticated || !firebaseUser) {
      ordersLoadedOnceRef.current = false;
      knownOrderIdsRef.current = new Set();
      return;
    }

    let cancelled = false;
    setCloudBootstrapping(true);

    const bootstrap = async () => {
      try {
        const defaultEmails = firebaseUser.email ? [firebaseUser.email] : [];
        if (queuedBackup) {
          await restoreBackupToFirestore(queuedBackup, firebaseUser.uid, defaultEmails);
          if (!cancelled) {
            setQueuedBackup(null);
            showToast('JSON backup restored to Cloud Database!', 'success');
          }
        } else {
          await seedInitialCloudDataIfEmpty(firebaseUser.uid, defaultEmails);
        }
      } catch (err) {
        console.error('Cloud bootstrap error:', err);
      } finally {
        if (!cancelled) {
          setCloudBootstrapping(false);
        }
      }
    };

    void bootstrap();

    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      onSnapshot(
        collection(db, 'branches'),
        (snap) => setBranches(snap.docs.map((d) => d.data() as Branch)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'branches')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'staffUsers'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as StaffUser);
          if (list.length > 0) setUsers(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'staffUsers')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'authorizedStaff'),
        (snap) => setAuthorizedStaff(snap.docs.map((d) => d.data() as AuthorizedStaff)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'authorizedStaff')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'menuItems'),
        (snap) => setMenuItems(snap.docs.map((d) => d.data() as MenuItem)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'menuItems')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'orders'),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as Order)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

          if (ordersLoadedOnceRef.current) {
            for (const ord of list) {
              if (!knownOrderIdsRef.current.has(ord.id) && ord.status === 'New Orders') {
                if (soundEnabledRef.current) {
                  playKitchenChime();
                }
                showToast(
                  `New Kitchen Order ${ord.order_number} (${ord.order_type} · ${ord.table_number})`,
                  'info'
                );
                setNotifications((prev) => [
                  {
                    id: Date.now() + Math.floor(Math.random() * 100),
                    title: `New Order ${ord.order_number}`,
                    msg: `${ord.items.length} items · ${ord.order_type} (${ord.table_number})`,
                    time: 'Just now',
                    unread: true,
                  },
                  ...prev.slice(0, 19),
                ]);
              }
            }
          } else {
            ordersLoadedOnceRef.current = true;
          }
          knownOrderIdsRef.current = new Set(list.map((o) => o.id));
          setOrders(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'inventory'),
        (snap) => setInventory(snap.docs.map((d) => d.data() as InventoryItem)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'inventory')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'customers'),
        (snap) => setCustomers(snap.docs.map((d) => d.data() as Customer)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'giftCards'),
        (snap) => setGiftCards(snap.docs.map((d) => d.data() as GiftCard)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'giftCards')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'promos'),
        (snap) => setPromos(snap.docs.map((d) => d.data() as PromoCode)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'promos')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'reservations'),
        (snap) => setReservations(snap.docs.map((d) => d.data() as Reservation)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'reservations')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'shifts'),
        (snap) => setShifts(snap.docs.map((d) => d.data() as Shift)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'shifts')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'attendance'),
        (snap) => setAttendance(snap.docs.map((d) => d.data() as AttendanceRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'recipes'),
        (snap) => setRecipes(snap.docs.map((d) => d.data() as Recipe)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'recipes')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'voidLogs'),
        (snap) => setVoidLogs(snap.docs.map((d) => d.data() as VoidLog)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'voidLogs')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'wasteLogs'),
        (snap) => setWasteLogs(snap.docs.map((d) => d.data() as WasteLog)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'wasteLogs')
      )
    );

    unsubscribers.push(
      onSnapshot(
        doc(db, 'registers', 'main'),
        (snap) => {
          if (snap.exists()) {
            setRegisterState(snap.data() as CashRegister);
            setRegisterExistsInCloud(true);
          } else {
            setRegisterExistsInCloud(false);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'registers/main')
      )
    );

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isAuthenticated, firebaseUser, queuedBackup]);

  const allowedEmails = useMemo(() => {
    const emails = [
      ...(firebaseUser?.email ? [firebaseUser.email] : []),
      ...authorizedStaff.map((s) => s.email),
    ];
    return normalizeAllowedEmails(emails);
  }, [firebaseUser, authorizedStaff]);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) || users[0] || INITIAL_USERS[0],
    [users, currentUserId]
  );

  const filteredOrders = useMemo(() => {
    if (selectedBranchId === 'all') return orders;
    return orders.filter((o) => o.branch_id === selectedBranchId);
  }, [orders, selectedBranchId]);

  const filteredInventory = useMemo(() => {
    if (selectedBranchId === 'all') return inventory;
    return inventory.filter((i) => i.branch_id === selectedBranchId);
  }, [inventory, selectedBranchId]);

  const filteredMenu = useMemo(() => {
    if (selectedBranchId === 'all') return menuItems;
    return menuItems.filter((m) => m.availability && m.availability.includes(selectedBranchId));
  }, [menuItems, selectedBranchId]);

  const handleExportBackup = () => {
    const backup = {
      app: 'Royal India By Spicy Twist',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        branches,
        users,
        menuItems,
        orders,
        inventory,
        customers,
        giftCards,
        promos,
        reservations,
        shifts,
        attendance,
        recipes,
        voidLogs,
        wasteLogs,
        registerState,
        selectedBranchId,
        currentUserId: currentUser.id,
      },
    };
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `royal-india-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Cloud JSON backup downloaded successfully.', 'success');
  };

  const handleLogout = async () => {
    setPortalUnlocked(false);
    try {
      await signOut(auth);
    } catch {
      // Ignore signout error
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-800 text-sm font-semibold">
        Connecting to Royal India Cloud...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onCredentialUnlock={() => setPortalUnlocked(true)}
        onQueueBackupRestore={(data) => setQueuedBackup(data)}
        pendingBackupMessage={
          queuedBackup ? 'Backup queued. Sign in to upload it to the cloud database.' : ''
        }
      />
    );
  }

  const activeKdsCount = orders.filter(
    (o) => o.status !== 'Completed' && o.status !== 'Cancelled'
  ).length;
  const lowStockCount = inventory.filter((i) => i.quantity <= i.reorder_level).length;

  return (
    <div className="flex h-screen bg-white text-slate-800 overflow-hidden">
      {/* TOAST CONTAINER */}
      <div className="fixed bottom-20 md:bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border transition-all duration-200 ${
              toast.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : toast.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-orange-50 text-orange-900 border-orange-200'
            }`}
          >
            <Icon
              name={
                toast.type === 'error'
                  ? 'alert-triangle'
                  : toast.type === 'warning'
                  ? 'alert-circle'
                  : 'check-circle-2'
              }
              className="w-5 h-5 text-orange-600 shrink-0"
            />
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 md:static transition-transform duration-200 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${
          sidebarCollapsed ? 'md:w-20' : 'w-64'
        } bg-white border-r border-slate-200 flex flex-col justify-between shadow-sm`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 shrink-0">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                  <img
                    src={LOGO_ASSET_URL}
                    alt="Royal India By Spicy Twist logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="font-extrabold text-sm text-slate-900 leading-tight truncate">
                    Royal India By Spicy Twist
                  </h1>
                  <span className="text-[10px] uppercase tracking-wider text-orange-600 font-bold block">
                    Cloud PKR POS
                  </span>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="mx-auto w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden shadow-sm">
                <img
                  src={LOGO_ASSET_URL}
                  alt="Royal India By Spicy Twist logo"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:inline-flex p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-orange-50 hover:text-orange-600 text-slate-600 transition shrink-0"
              title="Toggle Sidebar"
            >
              <Icon name="menu" className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-3 space-y-1 overflow-y-auto flex-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1">
              Core Operations
            </div>
            <NavItem
              icon={<Icon name="layout-dashboard" className="w-4 h-4" />}
              label="Dashboard Overview"
              active={activeTab === 'dashboard'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('dashboard')}
            />
            <NavItem
              icon={<Icon name="shopping-bag" className="w-4 h-4" />}
              label="POS / Order Counter"
              active={activeTab === 'pos'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('pos')}
              badge="Live"
            />
            <NavItem
              icon={<Icon name="utensils-crossed" className="w-4 h-4" />}
              label="Kitchen Display (KDS)"
              active={activeTab === 'kds'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('kds')}
              badge={activeKdsCount || undefined}
              badgeColor="bg-amber-100 text-amber-800 font-bold"
            />
            <NavItem
              icon={<Icon name="clipboard-list" className="w-4 h-4" />}
              label="Order History & List"
              active={activeTab === 'orders'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('orders')}
            />
            <NavItem
              icon={
                <Icon
                  name="calculator"
                  className={`w-4 h-4 ${activeTab === 'register' ? 'text-white' : 'text-orange-500'}`}
                />
              }
              label="Cash Register & Z-Report"
              active={activeTab === 'register'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('register')}
            />

            <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1 pt-2">
              Financials & Costs
            </div>
            <NavItem
              icon={<Icon name="line-chart" className="w-4 h-4" />}
              label="Sales & Financial Reports"
              active={activeTab === 'reports'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('reports')}
            />
            <NavItem
              icon={<Icon name="pie-chart" className="w-4 h-4" />}
              label="Labor & Prime Cost"
              active={activeTab === 'labor_report'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('labor_report')}
            />
            <NavItem
              icon={<Icon name="chef-hat" className="w-4 h-4" />}
              label="Recipe & Food Costing"
              active={activeTab === 'recipes'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('recipes')}
            />

            <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1 pt-2">
              Customer & Growth
            </div>
            <NavItem
              icon={<Icon name="gift" className="w-4 h-4" />}
              label="Loyalty, Promos & Cards"
              active={activeTab === 'loyalty'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('loyalty')}
            />
            <NavItem
              icon={<Icon name="users" className="w-4 h-4" />}
              label="Customer Directory"
              active={activeTab === 'customers'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('customers')}
            />
            <NavItem
              icon={<Icon name="calendar-days" className="w-4 h-4" />}
              label="Reservations & Waitlist"
              active={activeTab === 'reservations'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('reservations')}
              badge={reservations.length || undefined}
            />

            <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1 pt-2">
              Staff & Management
            </div>
            <NavItem
              icon={<Icon name="user-cog" className="w-4 h-4" />}
              label="Staff Directory & Sync"
              active={activeTab === 'staff'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('staff')}
            />
            <NavItem
              icon={<Icon name="clock" className="w-4 h-4" />}
              label="Scheduling & Attendance"
              active={activeTab === 'scheduling'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('scheduling')}
            />
            <NavItem
              icon={<Icon name="wallet" className="w-4 h-4" />}
              label="Payroll & Tip Pooling"
              active={activeTab === 'payroll'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('payroll')}
            />
            <NavItem
              icon={<Icon name="book-open" className="w-4 h-4" />}
              label="Menu Management"
              active={activeTab === 'menu'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('menu')}
              badge={menuItems.length || undefined}
            />
            <NavItem
              icon={<Icon name="boxes" className="w-4 h-4" />}
              label="Inventory & Stock"
              active={activeTab === 'inventory'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('inventory')}
              badge={lowStockCount || undefined}
              badgeColor="bg-rose-100 text-rose-700 font-bold"
            />
            <NavItem
              icon={<Icon name="building-2" className="w-4 h-4" />}
              label="Branch Management"
              active={activeTab === 'branches'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveTab('branches')}
            />
          </nav>

          <div className="p-3 border-t border-slate-200 bg-white shrink-0">
            {!sidebarCollapsed ? (
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-2.5">
                <img
                  src={currentUser.avatar || DEFAULT_AVATAR_URL}
                  alt={currentUser.name}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR_URL;
                  }}
                  className="w-8 h-8 rounded-full object-cover border-2 border-orange-500 shrink-0"
                />
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-orange-600 font-bold truncate">
                    {currentUser.role}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <img
                  src={currentUser.avatar || DEFAULT_AVATAR_URL}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-orange-500"
                  title={`${currentUser.name} (${currentUser.role})`}
                />
              </div>
            )}
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/55 md:hidden"
        />
      )}

      {/* Mobile Bottom Nav */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white py-1.5 px-1 md:hidden"
      >
        {[
          { id: 'dashboard', icon: 'layout-dashboard', label: 'Home' },
          { id: 'pos', icon: 'shopping-bag', label: 'POS' },
          { id: 'orders', icon: 'clipboard-list', label: 'Orders' },
          { id: 'kds', icon: 'utensils-crossed', label: 'Kitchen' },
        ].map((nav) => (
          <button
            key={nav.id}
            type="button"
            onClick={() => setActiveTab(nav.id as ActiveTab)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 mx-0.5 rounded-xl text-[10px] font-bold transition ${
              activeTab === nav.id
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600'
            }`}
          >
            <Icon name={nav.icon} className="w-4 h-4" />
            <span>{nav.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setSidebarCollapsed(false);
            setMobileNavOpen(true);
          }}
          className="flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-bold text-slate-500"
        >
          <Icon name="menu" className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </nav>

      {/* MAIN CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-20 shadow-sm shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => {
                setSidebarCollapsed(false);
                setMobileNavOpen(true);
              }}
              className="md:hidden rounded-lg bg-white border border-slate-200 p-2 text-slate-700 shrink-0"
            >
              <Icon name="menu" className="w-4 h-4" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 capitalize truncate">
              {activeTab.replace('_', ' ')}
            </h2>
            <div className="hidden sm:block h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-2 bg-white border border-slate-200 text-xs text-slate-700 px-2.5 py-1.5 rounded-lg min-w-0">
              <Icon name="building-2" className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-slate-900 font-bold outline-none cursor-pointer max-w-[160px] sm:max-w-[230px] truncate"
              >
                <option value="all">All Branches (Aggregated PKR)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden lg:flex items-center gap-2 text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg">
              <span className="text-slate-500">Staff Role:</span>
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const found = users.find((u) => u.id === e.target.value);
                  if (found) {
                    setCurrentUserId(found.id);
                    showToast(`Switched active staff to ${found.name} (${found.role})`, 'info');
                  }
                }}
                className="bg-transparent text-slate-900 font-bold outline-none cursor-pointer"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 rounded-xl bg-white border border-slate-200 hover:bg-orange-50 hover:text-orange-600 text-slate-700 transition"
              >
                <Icon name="bell" className="w-5 h-5" />
                {notifications.some((n) => n.unread) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white" />
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 z-50">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="font-bold text-sm text-slate-900">Notifications</h4>
                    <button
                      type="button"
                      onClick={() =>
                        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
                      }
                      className="text-[11px] text-orange-600 hover:underline font-bold"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto my-2">
                    {notifications.map((n) => (
                      <div key={n.id} className="py-2.5 px-1 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{n.title}</span>
                          <span className="text-[10px] text-slate-400">{n.time}</span>
                        </div>
                        <p className="text-xs text-slate-500">{n.msg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 whitespace-nowrap"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6 bg-white">
          {cloudBootstrapping && branches.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm font-semibold text-slate-500">
              Syncing restaurant cloud database...
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardModule
                  orders={filteredOrders}
                  inventory={filteredInventory}
                  branches={branches}
                  menuItems={menuItems}
                  onExportBackup={handleExportBackup}
                />
              )}
              {activeTab === 'pos' && (
                <POSModule
                  menuItems={filteredMenu}
                  selectedBranchId={selectedBranchId}
                  branches={branches}
                  promos={promos}
                  giftCards={giftCards}
                  registerState={registerState}
                  registerExistsInCloud={registerExistsInCloud}
                  allowedEmails={allowedEmails}
                  activeStaffName={currentUser.name}
                  showToast={showToast}
                  setReceiptModalOrder={setReceiptModalOrder}
                />
              )}
              {activeTab === 'kds' && (
                <KDSModule
                  orders={filteredOrders}
                  branches={branches}
                  soundEnabled={soundEnabled}
                  onToggleSound={() => setSoundEnabled((prev) => !prev)}
                  showToast={showToast}
                />
              )}
              {activeTab === 'orders' && (
                <OrderManagementModule
                  orders={filteredOrders}
                  branches={branches}
                  menuItems={menuItems}
                  selectedBranchId={selectedBranchId}
                  currentUser={currentUser}
                  allowedEmails={allowedEmails}
                  setReceiptModalOrder={setReceiptModalOrder}
                  showToast={showToast}
                />
              )}
              {activeTab === 'register' && (
                <CashRegisterModule
                  registerState={registerState}
                  registerExistsInCloud={registerExistsInCloud}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                  setShowZReportModal={setShowZReportModal}
                />
              )}
              {activeTab === 'reports' && (
                <SalesReportsModule orders={filteredOrders} voidLogs={voidLogs} />
              )}
              {activeTab === 'labor_report' && (
                <LaborReportModule
                  orders={filteredOrders}
                  attendance={attendance}
                  wasteLogs={wasteLogs}
                  branches={branches}
                  selectedBranchId={selectedBranchId}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
              {activeTab === 'recipes' && (
                <RecipesModule
                  recipes={recipes}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
              {activeTab === 'loyalty' && (
                <LoyaltyModule
                  customers={customers}
                  giftCards={giftCards}
                  promos={promos}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
              {activeTab === 'customers' && (
                <CustomerDirectoryModule
                  customers={customers}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
              {activeTab === 'reservations' && (
                <ReservationsModule
                  reservations={reservations}
                  branches={branches}
                  selectedBranchId={selectedBranchId}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
              {activeTab === 'staff' && (
                <StaffDirectoryModule
                  users={users}
                  authorizedStaff={authorizedStaff}
                  branches={branches}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
              {activeTab === 'scheduling' && (
                <SchedulingModule
                  shifts={shifts}
                  attendance={attendance}
                  users={users}
                  branches={branches}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
              {activeTab === 'payroll' && (
                <PayrollModule users={users} attendance={attendance} showToast={showToast} />
              )}
              {activeTab === 'menu' && (
                <MenuManagementModule
                  menuItems={menuItems}
                  branches={branches}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
              {activeTab === 'inventory' && (
                <InventoryModule
                  inventory={filteredInventory}
                  branches={branches}
                  selectedBranchId={selectedBranchId}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
              {activeTab === 'branches' && (
                <BranchManagementModule
                  branches={branches}
                  users={users}
                  allowedEmails={allowedEmails}
                  showToast={showToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      {receiptModalOrder && (
        <ReceiptModal
          order={receiptModalOrder}
          branch={branches.find((b) => b.id === receiptModalOrder.branch_id)}
          onClose={() => setReceiptModalOrder(null)}
        />
      )}

      {showZReportModal && (
        <ZReportModal
          registerState={registerState}
          orders={filteredOrders}
          onClose={() => setShowZReportModal(false)}
        />
      )}
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  collapsed,
  onClick,
  badge,
  badgeColor,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badge?: string | number;
  badgeColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between p-2.5 rounded-xl transition font-medium text-xs ${
        active
          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 font-bold'
          : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600'
      }`}
      title={collapsed ? label : undefined}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0">{icon}</span>
        {!collapsed && <span className="truncate whitespace-nowrap">{label}</span>}
      </div>
      {!collapsed && badge !== undefined && (
        <span
          className={`text-[10px] px-2 py-0.5 rounded-lg tabular-nums shrink-0 ${
            badgeColor || (active ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700 font-bold')
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
