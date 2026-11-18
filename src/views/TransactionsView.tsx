import React, { useMemo, useState } from 'react';
import { Download, Search, ArrowDownRight, ArrowUpRight, ArrowLeftRight, SlidersHorizontal } from 'lucide-react';
import {
  InventoryTransaction,
  TransactionType,
  WarehouseLocation,
} from '../types/inventory';
import { exportTransactionsCsv } from '../lib/csvExport';

interface TransactionsViewProps {
  transactions: InventoryTransaction[];
  locations: WarehouseLocation[];
  locationsById: Record<string, WarehouseLocation>;
  loading: boolean;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  locations,
  locationsById,
  loading,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (
        locationFilter !== 'all' &&
        tx.locationId !== locationFilter &&
        tx.targetLocationId !== locationFilter
      ) {
        return false;
      }

      if (dateFrom || dateTo) {
        const txDate = tx.createdAt ? tx.createdAt.toDate().toISOString().slice(0, 10) : '';
        if (dateFrom && txDate < dateFrom) return false;
        if (dateTo && txDate > dateTo) return false;
      }

      if (q) {
        const hay = [
          tx.materialName,
          tx.materialSku,
          tx.referenceCode,
          tx.operatorName,
          tx.reason,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [transactions, search, typeFilter, locationFilter, dateFrom, dateTo]);

  const formatTimestamp = (tx: InventoryTransaction) => {
    if (!tx.createdAt) return 'Pending sync';
    return tx.createdAt.toDate().toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTypeBadge = (type: TransactionType) => {
    if (type === 'IN') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
          <ArrowDownRight className="w-3.5 h-3.5" />
          <span>Restock (IN)</span>
        </span>
      );
    }
    if (type === 'OUT') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Take Out (OUT)</span>
        </span>
      );
    }
    if (type === 'TRANSFER') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Transfer</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>Audit Adjust</span>
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Inventory Movement Ledger
              </h2>
              <p className="text-xs text-slate-500">
                Immutable audit trail of all warehouse withdrawals, receipts, transfers, and
                adjustments
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportTransactionsCsv(filtered, locationsById)}
              disabled={filtered.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer self-start lg:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Movement History (CSV)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU, material, reference, operator..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} — {loc.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
              className="px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-700"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
              className="px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-700"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['ALL', 'OUT', 'IN', 'TRANSFER', 'ADJUST'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    typeFilter === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'ALL' ? 'All Types' : t}
                </button>
              ))}
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {filtered.length} records
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <p className="text-sm font-medium text-slate-900">No movement transactions logged</p>
            <p className="text-xs text-slate-500 mt-1">
              Material receipts, withdrawals, and transfers will appear here in real time.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Movement</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Delta</th>
                    <th className="py-3 px-4 text-right">Stock Level</th>
                    <th className="py-3 px-4">Location &amp; Ref</th>
                    <th className="py-3 px-4">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filtered.map((tx) => {
                    const srcLoc = locationsById[tx.locationId]?.code || tx.locationId;
                    const dstLoc = tx.targetLocationId
                      ? locationsById[tx.targetLocationId]?.code || tx.targetLocationId
                      : '';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {formatTimestamp(tx)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{renderTypeBadge(tx.type)}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{tx.materialName}</div>
                          <div className="text-xs font-mono text-slate-500">{tx.materialSku}</div>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                            tx.quantityChange > 0
                              ? 'text-emerald-700'
                              : tx.quantityChange < 0
                                ? 'text-red-700'
                                : 'text-slate-700'
                          }`}
                        >
                          {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                          {tx.previousQuantity} →{' '}
                          <span className="font-semibold text-slate-900">{tx.newQuantity}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div>
                            {srcLoc}
                            {dstLoc ? ` → ${dstLoc}` : ''}
                            {tx.referenceCode ? ` · ${tx.referenceCode}` : ''}
                          </div>
                          {tx.reason && (
                            <div className="text-slate-500 truncate max-w-[220px]">{tx.reason}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          <div>{tx.operatorName}</div>
                          <div className="text-[11px] text-slate-400">
                            {tx.scanMethod === 'camera_scanner'
                              ? 'Camera Scan'
                              : tx.scanMethod === 'usb_scanner'
                                ? 'HID Scanner'
                                : 'Manual'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-200">
              {filtered.map((tx) => (
                <div key={tx.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {renderTypeBadge(tx.type)}
                    <span className="font-mono text-xs text-slate-500">{formatTimestamp(tx)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{tx.materialName}</p>
                      <p className="text-xs font-mono text-slate-500">{tx.materialSku}</p>
                    </div>
                    <div className="text-right font-mono">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          tx.quantityChange > 0
                            ? 'text-emerald-700'
                            : tx.quantityChange < 0
                              ? 'text-red-700'
                              : 'text-slate-700'
                        }`}
                      >
                        {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {tx.previousQuantity} → {tx.newQuantity}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {tx.operatorName}
                    {tx.referenceCode ? ` · Ref ${tx.referenceCode}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
