import React, { useMemo, useState } from 'react';
import { Download, Printer, TrendingUp, PackageCheck, AlertCircle } from 'lucide-react';
import {
  getStockStatus,
  InventoryTransaction,
  Material,
  WarehouseLocation,
} from '../types/inventory';
import { exportWeeklyReportCsv } from '../lib/csvExport';

interface ReportsViewProps {
  materials: Material[];
  transactions: InventoryTransaction[];
  locations: WarehouseLocation[];
  locationsById: Record<string, WarehouseLocation>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  materials,
  transactions,
  locations,
  locationsById,
}) => {
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(7);

  const report = useMemo(() => {
    const now = new Date();
    const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
    const prevCutoff = now.getTime() - windowDays * 2 * 24 * 60 * 60 * 1000;

    const currentTx = transactions.filter(
      (tx) => (tx.createdAt ? tx.createdAt.toMillis() : 0) >= cutoff
    );
    const previousTx = transactions.filter((tx) => {
      const ts = tx.createdAt ? tx.createdAt.toMillis() : 0;
      return ts >= prevCutoff && ts < cutoff;
    });

    const inboundUnits = currentTx
      .filter((t) => t.type === 'IN')
      .reduce((s, t) => s + Math.abs(t.quantityChange), 0);
    const outboundUnits = currentTx
      .filter((t) => t.type === 'OUT')
      .reduce((s, t) => s + Math.abs(t.quantityChange), 0);
    const transferCount = currentTx.filter((t) => t.type === 'TRANSFER').length;
    const scannerRatio =
      currentTx.length > 0
        ? Math.round(
            (currentTx.filter((t) => t.scanMethod !== 'manual').length / currentTx.length) * 100
          )
        : 0;

    const prevOutbound = previousTx
      .filter((t) => t.type === 'OUT')
      .reduce((s, t) => s + Math.abs(t.quantityChange), 0);

    const outboundDeltaPct =
      prevOutbound > 0 ? Math.round(((outboundUnits - prevOutbound) / prevOutbound) * 100) : null;

    // Daily bar series for last 7 days
    const dailySeries: Array<{ label: string; iso: string; inbound: number; outbound: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      const dayTxs = transactions.filter(
        (tx) => tx.createdAt && tx.createdAt.toDate().toISOString().slice(0, 10) === iso
      );
      dailySeries.push({
        label,
        iso,
        inbound: dayTxs
          .filter((t) => t.type === 'IN')
          .reduce((s, t) => s + Math.abs(t.quantityChange), 0),
        outbound: dayTxs
          .filter((t) => t.type === 'OUT')
          .reduce((s, t) => s + Math.abs(t.quantityChange), 0),
      });
    }

    // Top consumed SKUs
    const consumptionMap: Record<
      string,
      { sku: string; name: string; unitsOut: number; txCount: number }
    > = {};
    for (const tx of currentTx) {
      if (tx.type !== 'OUT') continue;
      if (!consumptionMap[tx.materialId]) {
        consumptionMap[tx.materialId] = {
          sku: tx.materialSku,
          name: tx.materialName,
          unitsOut: 0,
          txCount: 0,
        };
      }
      consumptionMap[tx.materialId].unitsOut += Math.abs(tx.quantityChange);
      consumptionMap[tx.materialId].txCount += 1;
    }
    const topConsumed = Object.values(consumptionMap)
      .sort((a, b) => b.unitsOut - a.unitsOut)
      .slice(0, 5);

    // Location breakdown
    const locationStats = locations.map((loc) => {
      const locMaterials = materials.filter((m) => m.locationId === loc.id);
      const locTxs = currentTx.filter((t) => t.locationId === loc.id);
      const totalUnits = locMaterials.reduce((s, m) => s + m.quantity, 0);
      const valuation = locMaterials.reduce((s, m) => s + m.quantity * m.unitCost, 0);
      const lowStock = locMaterials.filter((m) => getStockStatus(m) !== 'in_stock').length;
      return {
        location: loc,
        skuCount: locMaterials.length,
        totalUnits,
        valuation,
        lowStock,
        movements: locTxs.length,
      };
    });

    const lowStockItems = materials.filter((m) => getStockStatus(m) !== 'in_stock');
    const totalValuation = materials.reduce((s, m) => s + m.quantity * m.unitCost, 0);

    return {
      currentTxCount: currentTx.length,
      inboundUnits,
      outboundUnits,
      transferCount,
      scannerRatio,
      outboundDeltaPct,
      dailySeries,
      topConsumed,
      locationStats,
      lowStockItems,
      totalValuation,
    };
  }, [materials, transactions, locations, windowDays]);

  const maxBarValue = Math.max(
    1,
    ...report.dailySeries.map((d) => Math.max(d.inbound, d.outbound))
  );

  const handleExportReport = () => {
    const rows = [
      { metric: 'Reporting Window', value: `Last ${windowDays} Days`, context: new Date().toISOString().slice(0, 10) },
      { metric: 'Total Catalog SKUs', value: materials.length, context: 'Active materials' },
      { metric: 'Total Inventory Valuation ($)', value: report.totalValuation.toFixed(2), context: 'All locations' },
      { metric: 'Total Movements Recorded', value: report.currentTxCount, context: `Last ${windowDays} days` },
      { metric: 'Inbound Units Restocked', value: report.inboundUnits, context: 'IN transactions' },
      { metric: 'Outbound Units Issued', value: report.outboundUnits, context: 'OUT transactions' },
      { metric: 'Inter-Office Transfers', value: report.transferCount, context: 'TRANSFER transactions' },
      { metric: 'Barcode Scanner Adoption (%)', value: `${report.scannerRatio}%`, context: 'Camera or USB HID scans' },
      { metric: 'Low/Out-of-Stock Alerts', value: report.lowStockItems.length, context: 'Immediate replenishment needed' },
    ];
    exportWeeklyReportCsv(`Last-${windowDays}-Days`, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Automated Management Performance Report
          </h2>
          <p className="text-xs text-slate-500">
            Real-time throughput, consumption velocity, and replenishment insights across all hubs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  windowDays === days
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Executive KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Outbound Issued ({windowDays}d)</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {report.outboundUnits.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {report.outboundDeltaPct === null
              ? 'Baseline period'
              : `${report.outboundDeltaPct >= 0 ? '+' : ''}${report.outboundDeltaPct}% vs prior ${windowDays}d`}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Inbound Restocked ({windowDays}d)</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            +{report.inboundUnits.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Net flow:{' '}
            <span className="font-mono">
              {report.inboundUnits - report.outboundUnits >= 0 ? '+' : ''}
              {report.inboundUnits - report.outboundUnits}
            </span>{' '}
            units
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Total Movements ({windowDays}d)</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {report.currentTxCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {report.transferCount} inter-office transfers
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Scanner Capture Rate</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-blue-700">
            {report.scannerRatio}%
          </p>
          <p className="mt-1 text-xs text-slate-500">USB HID or camera barcode scans</p>
        </div>
      </div>

      {/* 7-Day Daily Throughput Chart + Actionable Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                7-Day Inbound vs. Outbound Units
              </h3>
              <p className="text-xs text-slate-500">Daily material movement velocity</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-blue-700 rounded-xs inline-block" />
                Inbound
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-slate-400 rounded-xs inline-block" />
                Outbound
              </span>
            </div>
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-4 border-b border-slate-200 pb-2">
            {report.dailySeries.map((day) => {
              const inHeight = Math.round((day.inbound / maxBarValue) * 140);
              const outHeight = Math.round((day.outbound / maxBarValue) * 140);
              return (
                <div key={day.iso} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center gap-1.5 h-36">
                    <div
                      className="w-3.5 sm:w-4 bg-blue-700 rounded-t-xs transition-all"
                      style={{ height: `${Math.max(inHeight, day.inbound > 0 ? 4 : 0)}px` }}
                      title={`${day.iso} Inbound: ${day.inbound}`}
                    />
                    <div
                      className="w-3.5 sm:w-4 bg-slate-400 rounded-t-xs transition-all"
                      style={{ height: `${Math.max(outHeight, day.outbound > 0 ? 4 : 0)}px` }}
                      title={`${day.iso} Outbound: ${day.outbound}`}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Actionable Management Insights</h3>
          <div className="divide-y divide-slate-200 text-sm">
            <div className="py-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">
                  {report.lowStockItems.length} Replenishment Actions Needed
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {report.lowStockItems.length > 0
                    ? `Priority item: ${report.lowStockItems[0].name} (${report.lowStockItems[0].quantity} ${report.lowStockItems[0].unit} remaining).`
                    : 'All SKUs currently meet minimum safety thresholds.'}
                </p>
              </div>
            </div>
            <div className="py-3 flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">High-Velocity Consumption</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {report.topConsumed.length > 0
                    ? `${report.topConsumed[0].name} leads demand with ${report.topConsumed[0].unitsOut} units issued.`
                    : 'Record outbound movements to calculate SKU consumption velocity.'}
                </p>
              </div>
            </div>
            <div className="py-3 flex items-start gap-3">
              <PackageCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Catalog Valuation Summary</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total tracked warehouse capital stands at{' '}
                  <span className="font-mono font-medium text-slate-800">
                    ${report.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>{' '}
                  across {locations.length} synchronized locations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Location Breakdown & Top Consumed Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">
              Multi-Office Location Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Location</th>
                  <th className="py-2.5 px-4 text-right">SKUs</th>
                  <th className="py-2.5 px-4 text-right">Units</th>
                  <th className="py-2.5 px-4 text-right">Alerts</th>
                  <th className="py-2.5 px-4 text-right">{windowDays}d Moves</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {report.locationStats.map((row) => (
                  <tr key={row.location.id}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{row.location.name}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {locationsById[row.location.id]?.code} · {row.location.city}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{row.skuCount}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {row.totalUnits.toLocaleString()}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums ${
                        row.lowStock > 0 ? 'text-amber-700 font-semibold' : 'text-slate-500'
                      }`}
                    >
                      {row.lowStock}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{row.movements}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">
              Top Consumed Materials ({windowDays} Days)
            </h3>
          </div>
          {report.topConsumed.length === 0 ? (
            <div className="py-10 px-5 text-center text-xs text-slate-500">
              No outbound withdrawals recorded in this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Material</th>
                    <th className="py-2.5 px-4 text-right">Checkouts</th>
                    <th className="py-2.5 px-4 text-right">Units Issued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.topConsumed.map((item) => (
                    <tr key={item.sku}>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-xs font-mono text-slate-500">{item.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {item.txCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {item.unitsOut.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
