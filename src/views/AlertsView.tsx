import React from 'react';
import { AlertTriangle, CheckCircle2, ArrowDownRight, XCircle } from 'lucide-react';
import { getStockStatus, Material, UserRole, WarehouseLocation } from '../types/inventory';

interface AlertsViewProps {
  materials: Material[];
  locationsById: Record<string, WarehouseLocation>;
  userRole: UserRole;
  onQuickRestock: (material: Material) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  materials,
  locationsById,
  userRole,
  onQuickRestock,
}) => {
  const canOperate = userRole === 'admin' || userRole === 'manager' || userRole === 'operator';

  const alertItems = materials
    .filter((m) => getStockStatus(m) !== 'in_stock')
    .sort((a, b) => a.quantity - a.minStockLevel - (b.quantity - b.minStockLevel));

  const outOfStockCount = alertItems.filter((m) => m.quantity <= 0).length;
  const estimatedReplenishmentCost = alertItems.reduce((sum, m) => {
    const recommendedOrder = Math.max(m.minStockLevel * 2 - m.quantity, 1);
    return sum + recommendedOrder * m.unitCost;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Active Low-Stock Alerts</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {alertItems.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">SKUs at or below reorder threshold</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Critical Out-of-Stock</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-700">
            {outOfStockCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Zero units remaining on hand</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Est. Reorder Budget</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            ${estimatedReplenishmentCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-500">To restore 2x safety stock target</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Replenishment Queue</h2>
          <p className="text-xs text-slate-500">
            Materials ordered by urgency against configured minimum safety levels
          </p>
        </div>

        {alertItems.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">
              All materials are above safety stock levels
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Low-stock alerts will trigger automatically whenever withdrawals drop inventory to or
              below the minimum threshold.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {alertItems.map((mat) => {
              const isOut = mat.quantity <= 0;
              const deficit = Math.max(mat.minStockLevel - mat.quantity, 0);
              const suggestedQty = Math.max(mat.minStockLevel * 2 - mat.quantity, 10);
              const loc = locationsById[mat.locationId];

              return (
                <div
                  key={mat.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Out of Stock</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Low Stock</span>
                        </span>
                      )}
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs font-mono text-slate-500">{mat.sku}</span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-slate-500">
                        {loc ? `${loc.code} / Bin ${mat.binCode}` : mat.binCode}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900">{mat.name}</h3>
                    <p className="text-xs text-slate-500">
                      Supplier: {mat.supplier || 'Unassigned'} · Recommended PO:{' '}
                      <span className="font-mono font-medium text-slate-700">
                        +{suggestedQty} {mat.unit}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                    <div className="text-left md:text-right font-mono tabular-nums">
                      <p className="text-sm font-bold text-slate-900">
                        {mat.quantity} / {mat.minStockLevel} {mat.unit}
                      </p>
                      <p className="text-xs text-red-700">
                        {isOut ? '0 remaining' : `-${deficit} below min`}
                      </p>
                    </div>

                    {canOperate && (
                      <button
                        type="button"
                        onClick={() => onQuickRestock(mat)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        <span>Restock Now</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
