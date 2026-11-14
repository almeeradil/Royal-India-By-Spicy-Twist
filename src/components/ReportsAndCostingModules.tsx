import { useState } from 'react';
import { createCloudDoc, deleteCloudDoc } from '../lib/cloudStore';
import { clampNum, clampStr, LIMITS, sanitizeId } from '../lib/validation';
import type {
  AttendanceRecord,
  Branch,
  Order,
  Recipe,
  RecipeIngredient,
  ToastItem,
  VoidLog,
  WasteLog,
} from '../types';
import { Icon } from './Icon';

export function SalesReportsModule({
  orders,
  voidLogs,
}: {
  orders: Order[];
  voidLogs: VoidLog[];
}) {
  const activeOrders = orders.filter((o) => o.status !== 'Cancelled');
  const grossSales = activeOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalGST = grossSales * (16 / 116);
  const netSales = grossSales - totalGST;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Sales & Financial Reporting</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Daily, weekly, and monthly sales summaries & official GST tax logs
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <span className="text-xs font-semibold text-slate-500">Gross Sales</span>
            <h3 className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
              Rs. {grossSales.toLocaleString()}
            </h3>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <span className="text-xs font-semibold text-slate-500">Net Revenue (Excl Tax)</span>
            <h3 className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
              Rs. {netSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <span className="text-xs font-bold text-amber-800">Total GST Tax (16%)</span>
            <h3 className="text-xl font-extrabold text-amber-900 mt-1 tabular-nums">
              Rs. {totalGST.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[10px] text-amber-700 mt-1">
              Tax extracted from GST-inclusive sales
            </p>
          </div>
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
            <span className="text-xs font-bold text-rose-800">Void & Refunded Logs</span>
            <h3 className="text-xl font-extrabold text-rose-900 mt-1 tabular-nums">
              {voidLogs.length} Voids
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 overflow-x-auto">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Icon name="ban" className="w-4 h-4 text-rose-600" /> Void & Refund Audit Log
        </h3>
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
            <tr>
              <th className="p-3">Order Ref</th>
              <th className="p-3">Item Voided</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Authorized By</th>
              <th className="p-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {voidLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-400">
                  No voids or refunds recorded.
                </td>
              </tr>
            ) : (
              voidLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-orange-600 font-mono">{log.orderNumber}</td>
                  <td className="p-3 font-semibold text-slate-800">{log.item}</td>
                  <td className="p-3 font-bold text-slate-900 tabular-nums">
                    Rs. {Number(log.amount).toLocaleString()}
                  </td>
                  <td className="p-3 text-slate-600">{log.reason}</td>
                  <td className="p-3 font-medium text-slate-700">{log.voidedBy}</td>
                  <td className="p-3 text-slate-400 tabular-nums">{log.date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LaborReportModule({
  orders,
  attendance,
  wasteLogs,
  branches,
  selectedBranchId,
  allowedEmails,
  showToast,
}: {
  orders: Order[];
  attendance: AttendanceRecord[];
  wasteLogs: WasteLog[];
  branches: Branch[];
  selectedBranchId: string;
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const defaultBranch = selectedBranchId !== 'all' ? selectedBranchId : branches[0]?.id || 'b1';
  const [wasteForm, setWasteForm] = useState({
    ingredient: '',
    qty: '',
    cost: '',
    reason: '',
    branchId: defaultBranch,
    date: new Date().toISOString().split('T')[0],
  });

  const grossSales = orders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalLaborHours = attendance.reduce((sum, a) => sum + Number(a.totalHours || 0), 0);
  const estimatedLaborCost = totalLaborHours * 750;
  const totalWasteCost = wasteLogs.reduce((sum, w) => sum + Number(w.cost || 0), 0);
  const estimatedCOGS = grossSales * 0.32;
  const primeCost = estimatedCOGS + estimatedLaborCost;

  const laborPercent = grossSales > 0 ? ((estimatedLaborCost / grossSales) * 100).toFixed(1) : '0';
  const primeCostPercent = grossSales > 0 ? ((primeCost / grossSales) * 100).toFixed(1) : '0';

  const handleAddWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    const ingredient = clampStr(wasteForm.ingredient, LIMITS.nameMax);
    const qty = clampStr(wasteForm.qty, LIMITS.qtyStrMax);
    const reason = clampStr(wasteForm.reason || 'Spoiled / Damaged', LIMITS.notesMax);
    const cost = Number(wasteForm.cost);

    if (!ingredient || !qty || !Number.isFinite(cost) || cost < 0) {
      showToast('Enter ingredient, quantity, and valid cost.', 'error');
      return;
    }

    try {
      const wasteId = sanitizeId(`w-${Date.now()}`, 'w');
      await createCloudDoc(
        'wasteLogs',
        wasteId,
        {
          ingredient,
          qty,
          cost: clampNum(cost, 0),
          reason,
          branchId: wasteForm.branchId || defaultBranch,
          date: clampStr(wasteForm.date || new Date().toISOString().split('T')[0], LIMITS.dateMax),
        },
        allowedEmails,
        { hasUpdatedAt: false }
      );
      setWasteForm({
        ingredient: '',
        qty: '',
        cost: '',
        reason: '',
        branchId: defaultBranch,
        date: new Date().toISOString().split('T')[0],
      });
      showToast('Food waste saved to cloud database!', 'warning');
    } catch {
      showToast('Failed to log food waste.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Labor Cost % against Sales</span>
          <h3 className="text-2xl font-extrabold text-orange-600 mt-1 tabular-nums">
            {laborPercent}%
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
            Est. Labor Cost: Rs. {estimatedLaborCost.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Prime Cost (COGS + Labor)</span>
          <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            Rs. {primeCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h3>
          <p className="text-[11px] text-orange-600 font-bold mt-1 tabular-nums">
            {primeCostPercent}% of Gross Revenue
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Recorded Food Waste Cost</span>
          <h3 className="text-2xl font-extrabold text-rose-600 mt-1 tabular-nums">
            Rs. {totalWasteCost.toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
            {wasteLogs.length} logged waste entries
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 overflow-x-auto">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Icon name="trash-2" className="w-4 h-4 text-rose-600" /> Log Food Waste & Inventory Loss
        </h3>
        <form onSubmit={handleAddWaste} className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
          <input
            type="text"
            required
            maxLength={LIMITS.nameMax}
            placeholder="Ingredient name..."
            value={wasteForm.ingredient}
            onChange={(e) => setWasteForm({ ...wasteForm, ingredient: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="text"
            required
            maxLength={LIMITS.qtyStrMax}
            placeholder="Qty (e.g. 2 kg)..."
            value={wasteForm.qty}
            onChange={(e) => setWasteForm({ ...wasteForm, qty: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <input
            type="number"
            required
            min="0"
            placeholder="Cost (Rs.)..."
            value={wasteForm.cost}
            onChange={(e) => setWasteForm({ ...wasteForm, cost: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <select
            value={wasteForm.branchId}
            onChange={(e) => setWasteForm({ ...wasteForm, branchId: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            maxLength={LIMITS.notesMax}
            placeholder="Reason (Expired/Burnt)..."
            value={wasteForm.reason}
            onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
          />
          <button
            type="submit"
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl py-2.5"
          >
            Log Waste
          </button>
        </form>

        <table className="w-full text-left text-xs text-slate-700 mt-4">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
            <tr>
              <th className="p-3">Ingredient</th>
              <th className="p-3">Quantity</th>
              <th className="p-3">Branch</th>
              <th className="p-3">Waste Cost (Rs.)</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {wasteLogs.map((w) => (
              <tr key={w.id}>
                <td className="p-3 font-bold text-slate-800">{w.ingredient}</td>
                <td className="p-3">{w.qty}</td>
                <td className="p-3 text-slate-600">
                  {branches.find((b) => b.id === w.branchId)?.name || w.branchId}
                </td>
                <td className="p-3 font-bold text-rose-600 tabular-nums">Rs. {w.cost}</td>
                <td className="p-3 text-slate-500">{w.reason}</td>
                <td className="p-3 text-slate-400 tabular-nums">{w.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecipesModule({
  recipes,
  allowedEmails,
  showToast,
}: {
  recipes: Recipe[];
  allowedEmails: string[];
  showToast: (msg: string, type?: ToastItem['type']) => void;
}) {
  const [menuName, setMenuName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { name: '', qty: '', cost: 0 },
  ]);

  const computedCogs = ingredients.reduce((sum, ing) => sum + Number(ing.cost || 0), 0);

  const handleAddRow = () => {
    if (ingredients.length >= LIMITS.maxRecipeIngredients) {
      showToast(`Maximum ${LIMITS.maxRecipeIngredients} ingredients per recipe.`, 'warning');
      return;
    }
    setIngredients([...ingredients, { name: '', qty: '', cost: 0 }]);
  };

  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = clampStr(menuName, LIMITS.nameMax);
    const price = Number(sellingPrice);
    const validIngs = ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: clampStr(i.name, LIMITS.nameMax),
        qty: clampStr(i.qty || '1', LIMITS.qtyStrMax),
        cost: clampNum(i.cost, 0),
      }));

    if (!cleanName || !Number.isFinite(price) || price <= 0 || validIngs.length === 0) {
      showToast('Enter dish name, valid selling price, and at least one ingredient.', 'error');
      return;
    }

    const totalCogs = validIngs.reduce((sum, i) => sum + i.cost, 0);

    try {
      const id = sanitizeId(`rc-${Date.now()}`, 'rc');
      await createCloudDoc(
        'recipes',
        id,
        {
          menuName: cleanName,
          cogs: clampNum(totalCogs, 0),
          sellingPrice: clampNum(price, 1),
          ingredients: validIngs,
        },
        allowedEmails
      );
      setMenuName('');
      setSellingPrice('');
      setIngredients([{ name: '', qty: '', cost: 0 }]);
      showToast('Recipe & food costing saved to cloud!', 'success');
    } catch {
      showToast('Failed to save recipe.', 'error');
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    try {
      await deleteCloudDoc('recipes', id);
      showToast('Recipe removed.', 'info');
    } catch {
      showToast('Failed to remove recipe.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Recipe & Ingredient Food Costing</h2>
          <p className="text-xs text-slate-500">
            Analyze COGS per dish, calculate profit margins, and standardize kitchen recipes
          </p>
        </div>

        <form onSubmit={handleAddRecipe} className="space-y-3 border-t border-slate-100 pt-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              maxLength={LIMITS.nameMax}
              placeholder="Dish / Recipe Name..."
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
            />
            <input
              type="number"
              required
              min="1"
              placeholder="Selling Price (Rs.)..."
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
            />
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-semibold">Calculated COGS:</span>
              <span className="font-extrabold text-orange-600 tabular-nums">
                Rs. {computedCogs.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Ingredient name"
                  value={ing.name}
                  onChange={(e) =>
                    setIngredients(
                      ingredients.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                    )
                  }
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2"
                />
                <input
                  type="text"
                  placeholder="Quantity (e.g. 500g)"
                  value={ing.qty}
                  onChange={(e) =>
                    setIngredients(
                      ingredients.map((item, i) => (i === idx ? { ...item, qty: e.target.value } : item))
                    )
                  }
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Ingredient cost (Rs.)"
                  value={ing.cost || ''}
                  onChange={(e) =>
                    setIngredients(
                      ingredients.map((item, i) =>
                        i === idx ? { ...item, cost: Number(e.target.value) } : item
                      )
                    )
                  }
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2"
                />
                <div className="flex gap-2">
                  {idx === ingredients.length - 1 && (
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                    >
                      + Ingredient
                    </button>
                  )}
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                      className="px-3 rounded-xl bg-rose-50 text-rose-600 font-bold"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl"
          >
            Save Recipe to Cloud
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((rc) => {
          const margin = rc.sellingPrice - rc.cogs;
          const marginPct = rc.sellingPrice > 0 ? ((margin / rc.sellingPrice) * 100).toFixed(1) : '0';
          return (
            <div key={rc.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <h4 className="font-extrabold text-slate-900 text-sm">{rc.menuName}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 tabular-nums">
                    {marginPct}% Margin
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRecipe(rc.id)}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="text-xs space-y-1 tabular-nums">
                <p className="text-slate-500">
                  Selling Price: <span className="font-bold text-slate-900">Rs. {rc.sellingPrice}</span>
                </p>
                <p className="text-slate-500">
                  Dish COGS: <span className="font-bold text-rose-600">Rs. {rc.cogs}</span>
                </p>
                <p className="text-slate-500">
                  Profit Margin: <span className="font-bold text-emerald-600">Rs. {margin}</span>
                </p>
              </div>
              {rc.ingredients && rc.ingredients.length > 0 && (
                <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-600 space-y-1">
                  {rc.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between tabular-nums">
                      <span>
                        {ing.name} ({ing.qty})
                      </span>
                      <span className="font-semibold">Rs. {ing.cost}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
