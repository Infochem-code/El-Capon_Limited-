import { InventoryTransaction, Material, WarehouseLocation } from '../types/inventory';

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTransactionsCsv(
  transactions: InventoryTransaction[],
  locationsById: Record<string, WarehouseLocation>
): void {
  const headers = [
    'Transaction ID',
    'Timestamp (ISO)',
    'Type',
    'SKU',
    'Material Name',
    'Quantity Delta',
    'Previous Stock',
    'New Stock',
    'Source Location',
    'Target Location',
    'Reference Code',
    'Scan Method',
    'Operator',
    'Reason / Notes',
  ];

  const rows = transactions.map((tx) => {
    const loc = locationsById[tx.locationId]?.code || tx.locationId;
    const targetLoc = tx.targetLocationId
      ? locationsById[tx.targetLocationId]?.code || tx.targetLocationId
      : '';
    return [
      tx.id,
      tx.createdAt ? tx.createdAt.toDate().toISOString() : '',
      tx.type,
      tx.materialSku,
      tx.materialName,
      tx.quantityChange,
      tx.previousQuantity,
      tx.newQuantity,
      loc,
      targetLoc,
      tx.referenceCode,
      tx.scanMethod,
      tx.operatorName,
      tx.reason,
    ];
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`stockledger-movements-${dateTag}.csv`, headers, rows);
}

export function exportInventoryCsv(
  materials: Material[],
  locationsById: Record<string, WarehouseLocation>
): void {
  const headers = [
    'SKU',
    'Barcode',
    'Material Name',
    'Category',
    'Location',
    'Bin Code',
    'Quantity On Hand',
    'Unit',
    'Min Stock Level',
    'Unit Cost',
    'Total Value',
    'Supplier',
    'Notes',
  ];

  const rows = materials.map((mat) => [
    mat.sku,
    mat.barcode,
    mat.name,
    mat.category,
    locationsById[mat.locationId]?.name || mat.locationId,
    mat.binCode,
    mat.quantity,
    mat.unit,
    mat.minStockLevel,
    mat.unitCost.toFixed(2),
    (mat.quantity * mat.unitCost).toFixed(2),
    mat.supplier,
    mat.notes,
  ]);

  const dateTag = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`stockledger-inventory-${dateTag}.csv`, headers, rows);
}

export function exportWeeklyReportCsv(
  periodLabel: string,
  summaryRows: Array<{ metric: string; value: string | number; context: string }>
): void {
  const headers = ['Metric', 'Value', 'Context'];
  const rows = summaryRows.map((item) => [item.metric, item.value, item.context]);
  const dateTag = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`stockledger-weekly-report-${dateTag}.csv`, headers, rows);
  void periodLabel;
}
