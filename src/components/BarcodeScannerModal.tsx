import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Camera, Keyboard, Search, X, ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react';
import { Material, ScanMethod, WarehouseLocation } from '../types/inventory';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
  locationsById: Record<string, WarehouseLocation>;
  canOperate: boolean;
  canManageCatalog: boolean;
  initialScannedCode?: string | null;
  initialScanMethod?: ScanMethod;
  onStartMovement: (material: Material, type: 'IN' | 'OUT', scanMethod: ScanMethod) => void;
  onCreateWithBarcode: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  materials,
  locationsById,
  canOperate,
  canManageCatalog,
  initialScannedCode,
  initialScanMethod = 'manual',
  onStartMovement,
  onCreateWithBarcode,
}) => {
  const [mode, setMode] = useState<'wedge' | 'camera'>('wedge');
  const [codeInput, setCodeInput] = useState('');
  const [scanMethod, setScanMethod] = useState<ScanMethod>(initialScanMethod);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialScannedCode) {
        setCodeInput(initialScannedCode);
        setScanMethod(initialScanMethod);
      } else {
        setCodeInput('');
        setScanMethod('manual');
      }
      setCameraError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
    } else {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCameraActive(false);
    }
  }, [isOpen, initialScannedCode, initialScanMethod]);

  useEffect(() => {
    if (!isOpen || mode !== 'camera') {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCameraActive(false);
      return;
    }

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    const startCamera = async () => {
      setCameraError(null);
      try {
        if (!videoRef.current) return;
        setCameraActive(true);
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText().trim();
              if (text) {
                setCodeInput(text);
                setScanMethod('camera_scanner');
                controls.stop();
                setCameraActive(false);
                setMode('wedge');
              }
            }
          }
        );
        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      } catch (err) {
        if (!cancelled) {
          setCameraActive(false);
          setCameraError(
            err instanceof Error
              ? err.message
              : 'Camera access unavailable. Ensure camera permission is granted or use USB scanner.'
          );
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCameraActive(false);
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const trimmed = codeInput.trim().toLowerCase();
  const matchedMaterial = trimmed
    ? materials.find(
        (m) => m.barcode.toLowerCase() === trimmed || m.sku.toLowerCase() === trimmed
      )
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-modal-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="scanner-modal-title" className="text-lg font-semibold text-slate-900">
              Barcode &amp; SKU Scanner
            </h2>
            <p className="text-xs text-slate-500">
              Scan via USB/Bluetooth HID scanner, device camera, or manual lookup
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('wedge')}
              className={`inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mode === 'wedge'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>Hardware / Manual</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('camera')}
              className={`inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mode === 'camera'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Camera Scanner</span>
            </button>
          </div>

          {mode === 'camera' ? (
            <div className="space-y-3">
              <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                {!cameraActive && !cameraError && (
                  <span className="text-xs text-slate-300">Initializing camera viewfinder...</span>
                )}
              </div>
              {cameraError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {cameraError}
                </div>
              )}
              <p className="text-xs text-slate-500">
                Point camera at a Code-128, EAN-13, UPC, or QR warehouse label.
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="barcode-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Barcode or SKU (ready for USB / Bluetooth scanner input)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  id="barcode-input"
                  type="text"
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    setScanMethod('usb_scanner');
                  }}
                  placeholder="Scan barcode or enter SKU (e.g. 890123400101)"
                  className="w-full pl-9 pr-4 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>
          )}

          {trimmed && matchedMaterial && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-slate-500">
                    {matchedMaterial.sku} · Barcode {matchedMaterial.barcode}
                  </p>
                  <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                    {matchedMaterial.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Location: {locationsById[matchedMaterial.locationId]?.name || matchedMaterial.locationId}{' '}
                    · Bin {matchedMaterial.binCode}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {matchedMaterial.quantity}
                  </p>
                  <p className="text-xs text-slate-500">{matchedMaterial.unit}</p>
                </div>
              </div>

              {canOperate ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={matchedMaterial.quantity <= 0}
                    onClick={() => {
                      onClose();
                      onStartMovement(matchedMaterial, 'OUT', scanMethod);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Check Out (OUT)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartMovement(matchedMaterial, 'IN', scanMethod);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    <span>Restock (IN)</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Your current role (Viewer) has read-only access. Contact an Admin to enable stock
                  movements.
                </p>
              )}
            </div>
          )}

          {trimmed && !matchedMaterial && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">No matching material found</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Code: {codeInput.trim()}</p>
              </div>
              {canManageCatalog && (
                <button
                  type="button"
                  onClick={() => {
                    const code = codeInput.trim();
                    onClose();
                    onCreateWithBarcode(code);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Material</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
