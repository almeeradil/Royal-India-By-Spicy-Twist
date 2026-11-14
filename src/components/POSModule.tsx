import { useEffect, useState } from 'react';
import { createCloudDoc, deleteCloudDoc, updateCloudDoc, upsertCashRegister } from '../lib/cloudStore';
import { DEFAULT_DISH_IMAGE_URL } from '../lib/seed';
import { clampNum, clampStr, LIMITS, sanitizeId } from '../lib/validation';
import type {
  Branch,
  CashRegister,
  GiftCard,
  MenuItem,
  Order,
  OrderLineItem,
  OrderType,
  PaymentMethod,
  PromoCode,
  ToastItem,
} from '../types';
import { Icon } from './Icon';

interface POSModuleProps {
  menuItems: MenuItem[];
  selectedBranchId: string;
  branches: Branch[];
  promos: PromoCode[];
  giftCards: GiftCard[];
  registerState: CashRegister;
  registerExistsInCloud: boolean;
  allowedEmails: string[];
  activeStaffName: string;
  showToast: (msg: string, type?: ToastItem['type']) => void;
  setReceiptModalOrder: (order: Order | null) => void;
}

const CATEGORIES = [
  'All',
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

export function POSModule({
  menuItems,
  selectedBranchId,
  branches,
  promos,
  giftCards,
  registerState,
  registerExistsInCloud,
  allowedEmails,
  activeStaffName,
  showToast,
  setReceiptModalOrder,
}: POSModuleProps) {
  const [cart, setCart] = useState<OrderLineItem[]>([]);
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<MenuItem | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'BBQ',
    price: '',
    stock: '50',
    image: '',
  });
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [tableNumber, setTableNumber] = useState('T-01');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [selectedGiftCardId, setSelectedGiftCardId] = useState('');
  const [appliedPromoId, setAppliedPromoId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [fixedDiscount, setFixedDiscount] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeBranchForOrder, setActiveBranchForOrder] = useState(
    selectedBranchId !== 'all' ? selectedBranchId : branches[0]?.id || 'b1'
  );

  useEffect(() => {
    if (selectedBranchId !== 'all') {
      setActiveBranchForOrder(selectedBranchId);
    } else if (!branches.some((branch) => branch.id === activeBranchForOrder)) {
      setActiveBranchForOrder(branches[0]?.id || 'b1');
    }
  }, [selectedBranchId, branches, activeBranchForOrder]);

  const openAddProduct = () => {
    setEditingProductId(null);
    setProductForm({ name: '', category: 'BBQ', price: '', stock: '50', image: '' });
    setProductModalOpen(true);
  };

  const openEditProduct = (item: MenuItem) => {
    setEditingProductId(item.id);
    setProductForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      stock: String(item.stock ?? 50),
      image: item.image || '',
    });
    setOpenItemMenuId(null);
    setProductModalOpen(true);
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = clampStr(productForm.name, LIMITS.nameMax);
    const price = Number(productForm.price);
    const stock = Number(productForm.stock);

    if (!name) {
      showToast('Please enter a product name.', 'error');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      showToast('Please enter a price greater than zero.', 'error');
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      showToast('Please enter a whole-number stock quantity of zero or more.', 'error');
      return;
    }

    try {
      if (editingProductId) {
        await updateCloudDoc('menuItems', editingProductId, {
          name,
          category: clampStr(productForm.category, LIMITS.categoryMax),
          price: clampNum(price, 1, 10_000_000),
          stock: Math.round(clampNum(stock, 0, 1_000_000)),
          image: clampStr(productForm.image, LIMITS.imageMax),
        });
        showToast('Product updated in cloud menu.', 'success');
      } else {
        const availability =
          selectedBranchId === 'all'
            ? branches.map((b) => b.id).slice(0, LIMITS.maxAvailability)
            : [selectedBranchId];
        const newId = sanitizeId(`menu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, 'menu');
        await createCloudDoc(
          'menuItems',
          newId,
          {
            name,
            category: clampStr(productForm.category, LIMITS.categoryMax),
            price: clampNum(price, 1, 10_000_000),
            stock: Math.round(clampNum(stock, 0, 1_000_000)),
            image: clampStr(productForm.image, LIMITS.imageMax),
            availability,
          },
          allowedEmails
        );
        showToast('Product added & synced to all terminals.', 'success');
      }
      setProductModalOpen(false);
    } catch {
      showToast('Failed to save product to cloud database.', 'error');
    }
  };

  const confirmDeleteProduct = async () => {
    if (!confirmDeleteItem) return;
    try {
      await deleteCloudDoc('menuItems', confirmDeleteItem.id);
      setCart((prev) => prev.filter((entry) => entry.id !== confirmDeleteItem.id));
      showToast('Product removed from cloud menu.', 'success');
    } catch {
      showToast('Failed to remove product.', 'error');
    } finally {
      setConfirmDeleteItem(null);
      setOpenItemMenuId(null);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      if (prev.length >= LIMITS.maxOrderItems && !prev.some((entry) => entry.id === item.id)) {
        showToast(`Maximum ${LIMITS.maxOrderItems} unique items per order.`, 'warning');
        return prev;
      }
      const existing = prev.find((entry) => entry.id === item.id);
      const stock = Number(item.stock ?? 50);
      if (existing && existing.quantity >= stock) {
        showToast(`Only ${stock} ${item.name} available.`, 'warning');
        return prev;
      }
      if (!existing && stock < 1) {
        showToast(`${item.name} is out of stock.`, 'warning');
        return prev;
      }
      if (existing) {
        return prev.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry
        );
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, notes: '' }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    const sourceItem = menuItems.find((m) => m.id === id);
    const stock = Number(sourceItem?.stock ?? 50);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty > stock) {
              showToast(`Only ${stock} ${item.name} available.`, 'warning');
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((x): x is OrderLineItem => x !== null)
    );
  };

  const updateItemNotes = (id: string, notes: string) => {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, notes: notes.slice(0, LIMITS.notesMax) } : i)));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = Math.min(subtotal, (subtotal * discountPercent) / 100 + fixedDiscount);
  const tax = (subtotal - discountAmount) * 0.16;
  const grandTotal = subtotal - discountAmount + tax;

  const applyDiscount = () => {
    const foundPromo = promos.find(
      (p) => p.code === discountCode.trim().toUpperCase() && p.status === 'Active'
    );
    if (foundPromo) {
      setAppliedPromoId(foundPromo.id);
      setDiscountPercent(
        foundPromo.discountType === 'percentage' ? Math.min(100, Number(foundPromo.value) || 0) : 0
      );
      setFixedDiscount(
        foundPromo.discountType === 'flat' ? Math.max(0, Number(foundPromo.value) || 0) : 0
      );
      showToast(
        foundPromo.discountType === 'flat'
          ? `Rs. ${foundPromo.value} discount applied!`
          : `${foundPromo.value}% promo discount applied!`,
        'success'
      );
    } else {
      setAppliedPromoId(null);
      setDiscountPercent(0);
      setFixedDiscount(0);
      showToast('Invalid Promo Code', 'error');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty!', 'warning');
      return;
    }

    const selectedGiftCard =
      paymentMethod === 'Gift Card'
        ? giftCards.find((card) => card.id === selectedGiftCardId && card.status === 'Active')
        : undefined;

    if (paymentMethod === 'Gift Card') {
      if (!selectedGiftCard) {
        showToast('Select an active gift card before checkout.', 'warning');
        return;
      }
      if (Number(selectedGiftCard.balance) < grandTotal) {
        showToast('Gift card balance is not enough to cover this order.', 'error');
        return;
      }
    }

    const unavailableItem = cart.find((cartItem) => {
      const currentItem = menuItems.find((item) => item.id === cartItem.id);
      return !currentItem || cartItem.quantity > Number(currentItem.stock ?? 50);
    });
    if (unavailableItem) {
      showToast(`${unavailableItem.name} is no longer available in that quantity.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderId = sanitizeId(`ord-${Date.now()}`, 'ord');
      const totalRounded = Math.round(grandTotal);
      const orderNumber = `#${Math.floor(1000 + Math.random() * 9000)}`;
      const createdAtIso = new Date().toISOString();

      const newOrderPayload: Omit<Order, 'ownerUid' | 'allowedEmails' | 'createdAt' | 'updatedAt'> = {
        id: orderId,
        order_number: orderNumber,
        branch_id: activeBranchForOrder,
        table_number: clampStr(tableNumber || 'T-01', LIMITS.tableMax),
        customer_name: clampStr(customerName, LIMITS.shortNameMax),
        customer_phone: clampStr(customerPhone, LIMITS.phoneMax),
        order_type: orderType,
        status: 'New Orders',
        items: cart.map((c) => ({
          id: sanitizeId(c.id, 'item'),
          name: clampStr(c.name, LIMITS.nameMax),
          price: clampNum(c.price, 0),
          quantity: Math.max(1, Math.round(c.quantity)),
          notes: clampStr(c.notes, LIMITS.notesMax),
        })),
        subtotal: Math.round(subtotal),
        discount_amount: Math.round(discountAmount),
        tax_amount: Math.round(tax),
        total_amount: totalRounded,
        payment_method: paymentMethod,
        custom_notes: '',
        created_by: clampStr(activeStaffName, LIMITS.shortNameMax),
        created_at: createdAtIso,
      };

      await createCloudDoc('orders', orderId, newOrderPayload, allowedEmails);

      // Update menu stock in Firestore
      await Promise.all(
        cart.map((orderedItem) => {
          const current = menuItems.find((m) => m.id === orderedItem.id);
          if (!current) return Promise.resolve();
          const newStock = Math.max(0, Number(current.stock ?? 50) - orderedItem.quantity);
          return updateCloudDoc('menuItems', current.id, { stock: newStock });
        })
      );

      if (appliedPromoId) {
        const promoObj = promos.find((p) => p.id === appliedPromoId);
        if (promoObj) {
          await updateCloudDoc('promos', promoObj.id, {
            usageCount: Number(promoObj.usageCount || 0) + 1,
          });
        }
      }

      if (paymentMethod === 'Cash') {
        await upsertCashRegister(
          registerState.id || 'main',
          {
            isOpen: registerState.isOpen,
            openingBalance: registerState.openingBalance,
            currentCash: Number(registerState.currentCash || 0) + totalRounded,
            cashDrops: registerState.cashDrops || [],
          },
          allowedEmails,
          registerExistsInCloud
        );
      } else if (paymentMethod === 'Gift Card' && selectedGiftCard) {
        const newBal = Math.max(0, Number(selectedGiftCard.balance) - totalRounded);
        await updateCloudDoc('giftCards', selectedGiftCard.id, {
          balance: newBal,
          status: newBal === 0 ? 'Redeemed' : 'Active',
        });
      }

      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountCode('');
      setDiscountPercent(0);
      setFixedDiscount(0);
      setAppliedPromoId(null);
      showToast(`Order ${orderNumber} sent to Kitchen Display!`, 'success');
      setReceiptModalOrder(newOrderPayload);
    } catch {
      showToast('Failed to submit order to cloud database.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      <div className="flex-1 flex flex-col gap-4">
        {selectedBranchId === 'all' && (
          <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex items-center justify-between text-xs text-orange-900 font-semibold">
            <span>Aggregated View: Select branch for this order:</span>
            <select
              value={activeBranchForOrder}
              onChange={(e) => setActiveBranchForOrder(e.target.value)}
              className="bg-white border border-orange-300 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs font-bold"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <div className="relative flex-1 sm:w-52">
              <Icon name="search" className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
              />
            </div>
            <button
              type="button"
              onClick={openAddProduct}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Icon name="plus" className="w-3.5 h-3.5" /> Add Dish
            </button>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center my-auto shadow-sm">
            <Icon name="book-open" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base">No Menu Items Available</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add dishes via "Add Dish" or in Menu Management. Every dish added syncs instantly across all laptops.
            </p>
            <button
              type="button"
              onClick={openAddProduct}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600"
            >
              <Icon name="plus" className="w-4 h-4" /> Add First Menu Dish
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto max-h-[calc(100vh-230px)] pr-1">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-orange-500 transition cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md"
              >
                <div className="h-32 relative overflow-hidden bg-slate-100">
                  <img
                    src={item.image || DEFAULT_DISH_IMAGE_URL}
                    alt={item.name}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_DISH_IMAGE_URL;
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <span className="absolute top-2 right-2 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-lg text-[11px] font-bold text-orange-600 border border-slate-200 shadow-sm tabular-nums">
                    Rs. {item.price}
                  </span>
                  <div className="absolute top-2 left-2" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      aria-label={`More options for ${item.name}`}
                      onClick={() => setOpenItemMenuId(openItemMenuId === item.id ? null : item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow hover:bg-white"
                    >
                      <Icon name="more-vertical" className="w-4 h-4" />
                    </button>
                    {openItemMenuId === item.id && (
                      <div className="absolute left-0 top-8 z-20 w-28 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                        <button
                          type="button"
                          onClick={() => openEditProduct(item)}
                          className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteItem(item);
                            setOpenItemMenuId(null);
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-xs text-slate-800 line-clamp-1 group-hover:text-orange-600 transition">
                    {item.name}
                  </h4>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 tabular-nums">
                    <span>Stock: {item.stock ?? 50}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        addToCart(item);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-1.5 text-[10px] font-bold text-orange-600 transition hover:bg-orange-500 hover:text-white"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" /> Add item
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Cart Panel */}
      <div className="w-full lg:w-96 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between p-4 shadow-sm">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Icon name="shopping-bag" className="w-4 h-4 text-orange-600" /> Current Order Cart
            </h3>
            <span className="text-xs text-slate-500 font-bold tabular-nums">{cart.length} items</span>
          </div>

          <div className="grid grid-cols-2 gap-2 my-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400">Order Type</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as OrderType)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-2 mt-1 focus:outline-none font-semibold"
              >
                <option value="Dine-in">Dine-in</option>
                <option value="Takeaway">Takeaway</option>
                <option value="Delivery">Delivery</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400">Table / Ref</label>
              <input
                type="text"
                maxLength={LIMITS.tableMax}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-2 mt-1 focus:outline-none font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <input
              type="text"
              maxLength={LIMITS.shortNameMax}
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-2 focus:outline-none font-semibold"
            />
            <input
              type="tel"
              maxLength={LIMITS.phoneMax}
              placeholder="Customer phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-2 focus:outline-none font-semibold"
            />
          </div>

          <div className="space-y-3 max-h-56 overflow-y-auto pr-1 border-b border-slate-100 pb-3">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No items added to order yet.</div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="font-bold text-slate-800">{item.name}</span>
                    <span className="text-orange-600 font-bold">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Custom notes (e.g. Extra spicy)..."
                    value={item.notes}
                    onChange={(e) => updateItemNotes(item.id, e.target.value)}
                    className="w-full bg-transparent text-[11px] text-slate-600 placeholder-slate-400 mt-1 focus:outline-none"
                  />
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium tabular-nums">
                      Rs. {item.price} each
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-slate-900 w-4 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 pt-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Promo Code (PROMO10)"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-1.5 text-slate-800 uppercase font-semibold"
            />
            <button
              type="button"
              onClick={applyDiscount}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-xs font-bold rounded-xl text-slate-800"
            >
              Apply
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-slate-500 font-medium tabular-nums">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>Rs. {subtotal.toLocaleString()}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-orange-600 font-bold">
                <span>Discount{discountPercent > 0 ? ` (${discountPercent}%)` : ''}:</span>
                <span>-Rs. {discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Sales Tax (16% GST):</span>
              <span>Rs. {tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between font-extrabold text-sm text-slate-900 border-t border-slate-200 pt-2 mt-1">
              <span>Grand Total:</span>
              <span className="text-orange-600">
                Rs. {grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {(['Cash', 'Card', 'Gift Card'] as const).map((pm) => (
              <button
                key={pm}
                type="button"
                onClick={() => setPaymentMethod(pm)}
                className={`py-1.5 rounded-xl text-[11px] font-bold border transition ${
                  paymentMethod === pm
                    ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {pm}
              </button>
            ))}
          </div>

          {paymentMethod === 'Gift Card' && (
            <select
              value={selectedGiftCardId}
              onChange={(event) => setSelectedGiftCardId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-800"
            >
              <option value="">Select an active gift card</option>
              {giftCards
                .filter((card) => card.status === 'Active')
                .map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.code} — Rs. {Number(card.balance).toLocaleString()}
                  </option>
                ))}
            </select>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCheckout}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-500/30 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Icon name="receipt" className="w-4 h-4" />
            {isSubmitting ? 'Sending to Kitchen...' : 'Place Order & Send to Kitchen'}
          </button>
        </div>
      </div>

      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            noValidate
            onSubmit={saveProduct}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">
                {editingProductId ? 'Edit Product' : 'Add Product to Cloud Menu'}
              </h3>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-800"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            <input
              required
              maxLength={LIMITS.nameMax}
              value={productForm.name}
              onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
              placeholder="Product name"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={productForm.category}
                onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
                className="rounded-xl border border-slate-200 p-2.5 text-sm"
              >
                {CATEGORIES.filter((c) => c !== 'All').map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={productForm.price}
                onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
                placeholder="Price (Rs.)"
                className="rounded-xl border border-slate-200 p-2.5 text-sm"
              />
            </div>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={productForm.stock}
              onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })}
              placeholder="Stock quantity"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
            />
            <input
              type="url"
              maxLength={LIMITS.imageMax}
              value={productForm.image}
              onChange={(event) => setProductForm({ ...productForm, image: event.target.value })}
              placeholder="Image URL (optional)"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600"
              >
                {editingProductId ? 'Save Changes' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDeleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900">Remove Menu Item?</h3>
            <p className="text-xs text-slate-600">
              Remove <span className="font-bold">{confirmDeleteItem.name}</span> from the live cloud menu?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
