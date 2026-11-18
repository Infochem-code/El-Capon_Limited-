import React, { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  Material,
  ScanMethod,
  TransactionType,
  UserProfile,
  WarehouseLocation,
} from '../types/inventory';
import { recordMaterialMovement } from '../lib/warehouseService';

interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  materials: Material[];
  locations: WarehouseLocation[];
  locationsById: Record<string, WarehouseLocation>;
  initialType: TransactionType;
  initialScanMethod?: ScanMethod;
  currentUser: UserProfile;
  onSuccess: (message: string) => void;
}

export const MovementModal: React.FC<MovementModalProps> = ({
  isOpen,
  onClose,
  material,
  materials,
  locations,
  locationsById,
  initialType,
  initialScanMethod = 'manual',
  currentUser,
  onSuccess,
}) => {
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [type, setType] = useState<TransactionType>(initialType);
  const [amountInput, setAmountInput] = useState('1');
  const [targetLocationId, setTargetLocationId] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedMaterialId(material?.id || materials[0]?.id || '');
      setType(initialType);
      setAmountInput(initialType === 'ADJUST' && material ? String(material.quantity) : '1');
      setTargetLocationId('');
      setReferenceCode('');
      setReason('');
      setError(null);
    }
  }, [isOpen, material, materials, initialType]);

  if (!isOpen) return null;

  const activeMaterial = materials.find((m) => m.id === selectedMaterialId) || material;
  if (!activeMaterial) return null;

  const otherLocations = locations.filter((l) => l.isActive && l.id !== activeMaterial.locationId);
  const matchingDestMaterial =
    type === 'TRANSFER' && targetLocationId
      ? materials.find(
          (m) => m.sku === activeMaterial.sku && m.locationId === targetLocationId && m.id !== activeMaterial.id
        )
      : undefined;

  const numericAmount = Number(amountInput);
  let projectedQty = activeMaterial.quantity;
  if (!Number.isNaN(numericAmount)) {
    if (type === 'IN') projectedQty = activeMaterial.quantity + Math.max(0, numericAmount);
    else if (type === 'OUT') projectedQty = activeMaterial.quantity - Math.max(0, numericAmount);
    else if (type === 'ADJUST') projectedQty = Math.max(0, numericAmount);
    else if (type === 'TRANSFER') {
      projectedQty = matchingDestMaterial
        ? activeMaterial.quantity - Math.max(0, numericAmount)
        : activeMaterial.quantity;
    }
  }

  const willTriggerLowStock =
    projectedQty >= 0 && projectedQty <= activeMaterial.minStockLevel;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (Number.isNaN(numericAmount)) {
      setError('Enter a valid quantity.');
      return;
    }
    if (type === 'TRANSFER' && !targetLocationId) {
      setError('Select a destination warehouse location.');
      return;
    }

    setSubmitting(true);
    try {
      await recordMaterialMovement(
        {
          materialId: activeMaterial.id,
          type,
          amount: numericAmount,
          targetLocationId: type === 'TRANSFER' ? targetLocationId : '',
          targetMaterialId: matchingDestMaterial?.id,
          referenceCode,
          reason,
          scanMethod: initialScanMethod,
        },
        currentUser
      );
      onSuccess(
        `Recorded ${type} movement for ${activeMaterial.sku} (New stock: ${projectedQty} ${activeMaterial.unit}).`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record inventory movement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-modal-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="movement-modal-title" className="text-lg font-semibold text-slate-900">
              Record Material Movement
            </h2>
            <p className="text-xs text-slate-500">
              Atomic ledger update — inventory levels sync automatically across all offices
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Material</label>
            <select
              value={activeMaterial.id}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.sku} — {m.name} ({m.quantity} {m.unit} @{' '}
                  {locationsById[m.locationId]?.code || m.locationId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Movement Type
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg">
              {(['OUT', 'IN', 'TRANSFER', 'ADJUST'] as TransactionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    if (t === 'ADJUST') setAmountInput(String(activeMaterial.quantity));
                    else setAmountInput('1');
                  }}
                  className={`py-2 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    type === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'OUT'
                    ? 'Take Out'
                    : t === 'IN'
                      ? 'Restock'
                      : t === 'TRANSFER'
                        ? 'Transfer'
                        : 'Adjust'}
                </button>
              ))}
            </div>
          </div>

          {type === 'TRANSFER' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Destination Warehouse Location
              </label>
              <select
                value={targetLocationId}
                onChange={(e) => setTargetLocationId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select destination office/warehouse...</option>
                {otherLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} — {loc.name} ({loc.city})
                  </option>
                ))}
              </select>
              {targetLocationId && !matchingDestMaterial && (
                <p className="mt-1.5 text-xs text-slate-500">
                  No matching SKU bin at destination yet — this will relocate the full batch ({activeMaterial.quantity}{' '}
                  {activeMaterial.unit}) to {locationsById[targetLocationId]?.name}.
                </p>
              )}
              {targetLocationId && matchingDestMaterial && (
                <p className="mt-1.5 text-xs text-blue-700">
                  Matching SKU found at {locationsById[targetLocationId]?.code} (current:{' '}
                  {matchingDestMaterial.quantity} {matchingDestMaterial.unit}). Units will transfer
                  atomically between both hubs.
                </p>
              )}
            </div>
          )}

          {(type !== 'TRANSFER' || matchingDestMaterial) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {type === 'ADJUST'
                    ? `New Physical Count (${activeMaterial.unit})`
                    : `Quantity (${activeMaterial.unit})`}
                </label>
                <input
                  type="number"
                  min={type === 'ADJUST' ? 0 : 1}
                  step="any"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex flex-col justify-center">
                <span className="text-[11px] text-slate-500">Current → Projected</span>
                <span className="text-sm font-mono font-semibold tabular-nums text-slate-900">
                  {activeMaterial.quantity} → {projectedQty} {activeMaterial.unit}
                </span>
              </div>
            </div>
          )}

          {willTriggerLowStock && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Resulting stock ({projectedQty} {activeMaterial.unit}) is at or below minimum
                threshold ({activeMaterial.minStockLevel}). A low-stock alert will be active.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Reference / PO / Work Order #
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.REFERENCE_MAX}
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="e.g. WO-4821 or PO-904"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Entry Method
              </label>
              <input
                type="text"
                readOnly
                value={
                  initialScanMethod === 'camera_scanner'
                    ? 'Camera Barcode Scan'
                    : initialScanMethod === 'usb_scanner'
                      ? 'Hardware Scanner'
                      : 'Manual Entry'
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 text-slate-600 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Notes / Reason
            </label>
            <textarea
              rows={2}
              maxLength={BLUEPRINT_LIMITS.REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Issued to assembly bay 3, supplier receipt, or cycle-count audit..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || projectedQty < 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Confirm Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
