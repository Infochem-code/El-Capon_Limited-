import React, { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  Material,
  WarehouseLocation,
} from '../types/inventory';
import { saveMaterial } from '../lib/warehouseService';
import { BarcodeSvg } from './BarcodeSvg';

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMaterial: Material | null;
  initialBarcode?: string;
  locations: WarehouseLocation[];
  currentUserId: string;
  onSuccess: (message: string) => void;
}

const DEFAULT_CATEGORIES = [
  'Fasteners',
  'Structural Metals',
  'Electronics',
  'Packaging',
  'Safety PPE',
  'Hydraulics',
  'Consumables',
  'Raw Materials',
];

export const MaterialModal: React.FC<MaterialModalProps> = ({
  isOpen,
  onClose,
  editingMaterial,
  initialBarcode,
  locations,
  currentUserId,
  onSuccess,
}) => {
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Fasteners');
  const [locationId, setLocationId] = useState('');
  const [binCode, setBinCode] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [unit, setUnit] = useState('units');
  const [minStockLevel, setMinStockLevel] = useState('10');
  const [unitCost, setUnitCost] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingMaterial) {
        setSku(editingMaterial.sku);
        setBarcode(editingMaterial.barcode);
        setName(editingMaterial.name);
        setCategory(editingMaterial.category);
        setLocationId(editingMaterial.locationId);
        setBinCode(editingMaterial.binCode);
        setQuantity(String(editingMaterial.quantity));
        setUnit(editingMaterial.unit);
        setMinStockLevel(String(editingMaterial.minStockLevel));
        setUnitCost(String(editingMaterial.unitCost));
        setSupplier(editingMaterial.supplier);
        setNotes(editingMaterial.notes);
      } else {
        const autoSuffix = String(Math.floor(100000 + Math.random() * 899999));
        setSku(`MAT-${autoSuffix.slice(0, 4)}`);
        setBarcode(initialBarcode || `890123${autoSuffix}`);
        setName('');
        setCategory('Fasteners');
        setLocationId(locations[0]?.id || 'loc_main');
        setBinCode('A-01-01');
        setQuantity('0');
        setUnit('units');
        setMinStockLevel('15');
        setUnitCost('0');
        setSupplier('');
        setNotes('');
      }
      setError(null);
    }
  }, [isOpen, editingMaterial, initialBarcode, locations]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!BLUEPRINT_LIMITS.SKU_BARCODE_PATTERN.test(sku.trim())) {
      setError('SKU may only contain letters, numbers, dots, underscores, and hyphens.');
      return;
    }
    if (!BLUEPRINT_LIMITS.SKU_BARCODE_PATTERN.test(barcode.trim())) {
      setError('Barcode may only contain letters, numbers, dots, underscores, and hyphens.');
      return;
    }
    if (!locationId) {
      setError('Please select a warehouse location.');
      return;
    }

    setSubmitting(true);
    try {
      await saveMaterial(
        {
          id: editingMaterial?.id,
          sku,
          barcode,
          name,
          category,
          locationId,
          binCode,
          quantity: Number(quantity) || 0,
          unit,
          minStockLevel: Number(minStockLevel) || 0,
          unitCost: Number(unitCost) || 0,
          supplier,
          notes,
        },
        currentUserId
      );
      onSuccess(
        editingMaterial
          ? `Updated material ${sku.trim()}.`
          : `Added material ${sku.trim()} to warehouse catalog.`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save material record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl overflow-hidden max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-modal-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="material-modal-title" className="text-lg font-semibold text-slate-900">
              {editingMaterial ? 'Edit Material Record' : 'Register New Material'}
            </h2>
            <p className="text-xs text-slate-500">
              Synchronized across all warehouse locations with low-stock threshold alerts
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">SKU Code</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={BLUEPRINT_LIMITS.SKU_MAX}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="FST-M8-SS316"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Barcode</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={BLUEPRINT_LIMITS.BARCODE_MAX}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="890123400101"
                  className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() =>
                    setBarcode(`890123${Math.floor(100000 + Math.random() * 899999)}`)
                  }
                  className="px-2.5 py-2 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  title="Generate new barcode"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs text-slate-600">
              <p className="font-medium text-slate-800">Barcode Label Preview</p>
              <p>Printable linear label linked to this SKU</p>
            </div>
            <BarcodeSvg value={barcode} height={34} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Material Name</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={BLUEPRINT_LIMITS.MATERIAL_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="M8 Stainless Hex Bolt Assembly"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Warehouse Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} — {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Aisle / Bin Code
              </label>
              <input
                type="text"
                required
                minLength={1}
                maxLength={BLUEPRINT_LIMITS.BIN_CODE_MAX}
                value={binCode}
                onChange={(e) => setBinCode(e.target.value)}
                placeholder="A-04-02"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quantity On Hand
              </label>
              <input
                type="number"
                required
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
              <input
                type="text"
                required
                minLength={1}
                maxLength={BLUEPRINT_LIMITS.UNIT_MAX}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="boxes"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Min Stock Alert
              </label>
              <input
                type="number"
                required
                min={0}
                step="any"
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unit Cost ($)
              </label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Supplier</label>
            <input
              type="text"
              maxLength={BLUEPRINT_LIMITS.SUPPLIER_MAX}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Nordic Precision Hardware"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              maxLength={BLUEPRINT_LIMITS.NOTES_MAX}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Storage requirements, inspection tolerances, or reorder notes..."
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
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Saving...' : editingMaterial ? 'Save Changes' : 'Add Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
