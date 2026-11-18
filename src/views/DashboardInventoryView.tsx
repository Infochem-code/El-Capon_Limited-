import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  Trash2,
  PackageOpen,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  getStockStatus,
  InventoryTransaction,
  Material,
  StockStatus,
  UserRole,
  WarehouseLocation,
} from '../types/inventory';
import { exportInventoryCsv } from '../lib/csvExport';

interface DashboardInventoryViewProps {
  materials: Material[];
  transactions: InventoryTransaction[];
  locations: WarehouseLocation[];
  locationsById: Record<string, WarehouseLocation>;
  loading: boolean;
  userRole: UserRole;
  onAddMaterial: () => void;
  onEditMaterial: (material: Material) => void;
  onDeleteMaterial: (material: Material) => void;
  onStartMovement: (material: Material, type: 'IN' | 'OUT') => void;
  onSeedSampleCatalog: () => Promise<void>;
  onNavigateAlerts: () => void;
}

export const DashboardInventoryView: React.FC<DashboardInventoryViewProps> = ({
  materials,
  transactions,
  locations,
  locationsById,
  loading,
  userRole,
  onAddMaterial,
  onEditMaterial,
  onDeleteMaterial,
  onStartMovement,
  onSeedSampleCatalog,
  onNavigateAlerts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');
  const [seeding, setSeeding] = useState(false);

  const canOperate = userRole === 'admin' || userRole === 'manager' || userRole === 'operator';
  const canManageCatalog = userRole === 'admin' || userRole === 'manager';
  const canDelete = userRole === 'admin';

  const categories = useMemo(() => {
    const set = new Set(materials.map((m) => m.category).filter(Boolean));
    return Array.from(set).sort();
  }, [materials]);

  const metrics = useMemo(() => {
    const totalSkus = materials.length;
    const totalUnits = materials.reduce((sum, m) => sum + m.quantity, 0);
    const totalValue = materials.reduce((sum, m) => sum + m.quantity * m.unitCost, 0);
    const lowStockCount = materials.filter((m) => getStockStatus(m) !== 'in_stock').length;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyMovements = transactions.filter((tx) => {
      const ts = tx.createdAt ? tx.createdAt.toMillis() : 0;
      return ts >= sevenDaysAgo;
    }).length;

    return { totalSkus, totalUnits, totalValue, lowStockCount, weeklyMovements };
  }, [materials, transactions]);

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return materials.filter((m) => {
      if (selectedLocation !== 'all' && m.locationId !== selectedLocation) return false;
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
      const status = getStockStatus(m);
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      if (q) {
        const hay = [m.name, m.sku, m.barcode, m.supplier, m.binCode, m.category]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [materials, searchQuery, selectedLocation, selectedCategory, statusFilter]);

  const renderStatusLabel = (mat: Material) => {
    const status = getStockStatus(mat);
    if (status === 'out_of_stock') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Out of Stock</span>
        </span>
      );
    }
    if (status === 'low_stock') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Low Stock</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>In Stock</span>
      </span>
    );
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedSampleCatalog();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section aria-label="Warehouse Summary Metrics">
        <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Total Material SKUs</p>
            <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900">
              {loading ? '—' : metrics.totalSkus.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Across {locations.filter((l) => l.isActive).length} active locations
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Total Units On Hand</p>
            <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900">
              {loading ? '—' : metrics.totalUnits.toLocaleString()}
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
              Est. value ${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Low Stock Alerts</p>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <p
                className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                  metrics.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {loading ? '—' : metrics.lowStockCount}
              </p>
              {metrics.lowStockCount > 0 && (
                <button
                  type="button"
                  onClick={onNavigateAlerts}
                  className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                >
                  Review alerts
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">Items at or below safety threshold</p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">7-Day Movements</p>
            <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900">
              {loading ? '—' : metrics.weeklyMovements.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-500">Inbound, outbound &amp; transfers</p>
          </div>
        </div>
      </section>

      {/* Low Stock Attention Strip */}
      {!loading && metrics.lowStockCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2.5 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong className="font-semibold font-mono tabular-nums">
                {metrics.lowStockCount}
              </strong>{' '}
              {metrics.lowStockCount === 1 ? 'material requires' : 'materials require'}{' '}
              replenishment to maintain safety stock levels.
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateAlerts}
            className="text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700 self-start sm:self-auto cursor-pointer whitespace-nowrap"
          >
            Open Replenishment Queue
          </button>
        </div>
      )}

      {/* Search, Filter & Catalog Toolbar */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by material name, SKU, barcode, bin, or supplier..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                aria-label="Filter by warehouse location"
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} — {loc.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by category"
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => exportInventoryCsv(filteredMaterials, locationsById)}
                disabled={filteredMaterials.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              {canManageCatalog && (
                <button
                  type="button"
                  onClick={onAddMaterial}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Material</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All Stock' },
                  { id: 'in_stock', label: 'In Stock' },
                  { id: 'low_stock', label: 'Low Stock' },
                  { id: 'out_of_stock', label: 'Out of Stock' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Showing {filteredMaterials.length} of {materials.length} materials
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="divide-y divide-slate-200">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-56 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Empty Catalog State */}
        {!loading && materials.length === 0 && (
          <div className="py-14 px-6 text-center max-w-md mx-auto">
            <PackageOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">No warehouse materials yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              Add your first material SKU or load an initial multi-location warehouse catalog to
              begin tracking inventory movements.
            </p>
            {canManageCatalog && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onAddMaterial}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Material</span>
                </button>
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  <span>{seeding ? 'Loading Catalog...' : 'Load Sample Catalog'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filtered Empty State */}
        {!loading && materials.length > 0 && filteredMaterials.length === 0 && (
          <div className="py-12 px-6 text-center">
            <p className="text-sm font-medium text-slate-900">
              No materials match your current filters
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedLocation('all');
                setSelectedCategory('all');
                setStatusFilter('all');
              }}
              className="mt-3 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}

        {/* Desktop High-Density Data Table */}
        {!loading && filteredMaterials.length > 0 && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">SKU / Barcode</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4">Location / Bin</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">On Hand</th>
                    <th className="py-3 px-4 text-right">Min</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredMaterials.map((mat) => {
                    const loc = locationsById[mat.locationId];
                    return (
                      <tr key={mat.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 align-top">
                          <div className="font-mono text-xs font-medium text-slate-900">
                            {mat.sku}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {mat.barcode}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top max-w-xs">
                          <div className="font-medium text-slate-900">{mat.name}</div>
                          <div className="text-xs text-slate-500">
                            {mat.category}
                            {mat.supplier ? ` · ${mat.supplier}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="text-xs font-medium text-slate-800">
                            {loc ? `${loc.code} (${loc.city})` : mat.locationId}
                          </div>
                          <div className="text-xs font-mono text-slate-500">Bin {mat.binCode}</div>
                        </td>
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          {renderStatusLabel(mat)}
                        </td>
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                          <span className="font-mono font-semibold tabular-nums text-slate-900">
                            {mat.quantity.toLocaleString()}
                          </span>{' '}
                          <span className="text-xs text-slate-500">{mat.unit}</span>
                        </td>
                        <td className="py-3 px-4 align-top text-right font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                          {mat.minStockLevel.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {canOperate && (
                              <>
                                <button
                                  type="button"
                                  disabled={mat.quantity <= 0}
                                  onClick={() => onStartMovement(mat, 'OUT')}
                                  title="Take Out Material"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-md transition-colors cursor-pointer"
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                  <span>Out</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onStartMovement(mat, 'IN')}
                                  title="Restock Material"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                                >
                                  <ArrowDownRight className="w-3.5 h-3.5" />
                                  <span>In</span>
                                </button>
                              </>
                            )}
                            {canManageCatalog && (
                              <button
                                type="button"
                                onClick={() => onEditMaterial(mat)}
                                title="Edit Material"
                                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
                                aria-label={`Edit ${mat.name}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => onDeleteMaterial(mat)}
                                title="Delete Material"
                                className="p-1.5 text-slate-400 hover:text-red-700 rounded-md cursor-pointer"
                                aria-label={`Delete ${mat.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredMaterials.map((mat) => {
                const loc = locationsById[mat.locationId];
                return (
                  <div key={mat.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-slate-500">
                          {mat.sku} · {mat.barcode}
                        </p>
                        <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{mat.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {mat.category} · {loc ? loc.code : mat.locationId} / Bin {mat.binCode}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
                          {mat.quantity}
                        </p>
                        <p className="text-[11px] text-slate-500">{mat.unit}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div>{renderStatusLabel(mat)}</div>
                      <div className="flex items-center gap-2">
                        {canOperate && (
                          <>
                            <button
                              type="button"
                              disabled={mat.quantity <= 0}
                              onClick={() => onStartMovement(mat, 'OUT')}
                              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg disabled:opacity-40 min-h-[40px]"
                            >
                              Take Out
                            </button>
                            <button
                              type="button"
                              onClick={() => onStartMovement(mat, 'IN')}
                              className="px-3 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg min-h-[40px]"
                            >
                              Restock
                            </button>
                          </>
                        )}
                        {canManageCatalog && (
                          <button
                            type="button"
                            onClick={() => onEditMaterial(mat)}
                            className="p-2.5 text-slate-600 border border-slate-200 rounded-lg min-h-[40px]"
                            aria-label={`Edit ${mat.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
