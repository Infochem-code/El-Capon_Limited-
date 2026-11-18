import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Menu, ScanBarcode, ArrowLeftRight, CheckCircle2, X } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  deleteMaterial,
  ensureDefaultLocation,
  ensureUserProfile,
  seedInitialWarehouseCatalog,
} from './lib/warehouseService';
import {
  BackupPolicy,
  EncryptedBackupRecord,
  getStockStatus,
  InventoryTransaction,
  Material,
  ScanMethod,
  TransactionType,
  UserProfile,
  WarehouseLocation,
} from './types/inventory';
import { useHardwareBarcodeScanner } from './hooks/useBarcodeScanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { NavSection, Sidebar } from './components/Sidebar';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { MovementModal } from './components/MovementModal';
import { MaterialModal } from './components/MaterialModal';
import { DashboardInventoryView } from './views/DashboardInventoryView';
import { TransactionsView } from './views/TransactionsView';
import { AlertsView } from './views/AlertsView';
import { ReportsView } from './views/ReportsView';
import { BackupsView } from './views/BackupsView';
import { TeamLocationsView } from './views/TeamLocationsView';

function WarehouseWorkspace() {
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [backups, setBackups] = useState<EncryptedBackupRecord[]>([]);
  const [backupPolicy, setBackupPolicy] = useState<BackupPolicy | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [activeSection, setActiveSection] = useState<NavSection>('inventory');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals & action states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [scannedMethod, setScannedMethod] = useState<ScanMethod>('manual');

  const [movementOpen, setMovementOpen] = useState(false);
  const [movementMaterial, setMovementMaterial] = useState<Material | null>(null);
  const [movementType, setMovementType] = useState<TransactionType>('OUT');
  const [movementScanMethod, setMovementScanMethod] = useState<ScanMethod>('manual');

  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [prefillBarcode, setPrefillBarcode] = useState<string | undefined>(undefined);

  const [deleteCandidate, setDeleteCandidate] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Auth state & profile provisioning
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      if (!firebaseUser) {
        setUserProfile(null);
        setAuthLoading(false);
        setDataLoading(false);
        return;
      }

      try {
        const profile = await ensureUserProfile(firebaseUser);
        if (profile.role === 'admin') {
          await ensureDefaultLocation(profile.uid);
        }
        setUserProfile(profile);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to initialize user profile.');
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Real-time Firestore subscriptions (only when authenticated & active)
  useEffect(() => {
    if (!userProfile || userProfile.status !== 'active') return;

    setDataLoading(true);

    // Subscribe to current user profile updates so role changes apply live
    const unsubSelf = onSnapshot(
      doc(db, 'users', userProfile.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${userProfile.uid}`)
    );

    const unsubLocations = onSnapshot(
      query(collection(db, 'locations'), orderBy('code', 'asc')),
      (snap) => {
        setLocations(snap.docs.map((d) => d.data() as WarehouseLocation));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'locations')
    );

    const unsubMaterials = onSnapshot(
      query(collection(db, 'materials'), orderBy('name', 'asc')),
      (snap) => {
        setMaterials(snap.docs.map((d) => d.data() as Material));
        setDataLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'materials')
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, 'transactions'), orderBy('createdAt', 'desc')),
      (snap) => {
        setTransactions(snap.docs.map((d) => d.data() as InventoryTransaction));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const unsubPolicy = onSnapshot(
      doc(db, 'settings', 'backupPolicy'),
      (snap) => {
        if (snap.exists()) {
          setBackupPolicy(snap.data() as BackupPolicy);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/backupPolicy')
    );

    let unsubBackups: (() => void) | undefined;
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      unsubBackups = onSnapshot(
        query(collection(db, 'backups'), orderBy('createdAt', 'desc')),
        (snap) => {
          setBackups(snap.docs.map((d) => d.data() as EncryptedBackupRecord));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'backups')
      );
    }

    let unsubUsers: (() => void) | undefined;
    if (userProfile.role === 'admin') {
      unsubUsers = onSnapshot(
        query(collection(db, 'users'), orderBy('displayName', 'asc')),
        (snap) => {
          setUsers(snap.docs.map((d) => d.data() as UserProfile));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'users')
      );
    }

    return () => {
      unsubSelf();
      unsubLocations();
      unsubMaterials();
      unsubTransactions();
      unsubPolicy();
      unsubBackups?.();
      unsubUsers?.();
    };
  }, [userProfile?.uid, userProfile?.role, userProfile?.status]);

  // Global USB/Bluetooth HID keyboard-wedge barcode scanner listener
  useHardwareBarcodeScanner({
    enabled: Boolean(
      userProfile &&
        userProfile.status === 'active' &&
        !scannerOpen &&
        !movementOpen &&
        !materialModalOpen
    ),
    onScan: (code) => {
      setScannedBarcode(code);
      setScannedMethod('usb_scanner');
      setScannerOpen(true);
    },
  });

  const locationsById = useMemo(() => {
    const map: Record<string, WarehouseLocation> = {};
    for (const loc of locations) {
      map[loc.id] = loc;
    }
    return map;
  }, [locations]);

  const lowStockCount = useMemo(
    () => materials.filter((m) => getStockStatus(m) !== 'in_stock').length,
    [materials]
  );

  if (authLoading || !userProfile || userProfile.status !== 'active') {
    return (
      <AuthGate
        loading={authLoading}
        userProfile={userProfile}
        authError={authError}
      />
    );
  }

  const canOperate =
    userProfile.role === 'admin' ||
    userProfile.role === 'manager' ||
    userProfile.role === 'operator';
  const canManageCatalog =
    userProfile.role === 'admin' || userProfile.role === 'manager';

  const sectionTitle: Record<NavSection, string> = {
    inventory: 'Warehouse Inventory',
    transactions: 'Movement Ledger',
    alerts: 'Low Stock Alerts',
    reports: 'Weekly Performance Reports',
    backups: 'Encrypted Daily Backups',
    team: 'Locations & Stakeholder Access',
  };

  const handleStartMovement = (
    mat: Material,
    type: TransactionType,
    method: ScanMethod = 'manual'
  ) => {
    setMovementMaterial(mat);
    setMovementType(type);
    setMovementScanMethod(method);
    setMovementOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleting(true);
    try {
      await deleteMaterial(deleteCandidate.id);
      showToast(`Removed ${deleteCandidate.sku} from warehouse catalog.`);
      setDeleteCandidate(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        userProfile={userProfile}
        lowStockCount={lowStockCount}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSignOut={() => void signOut(auth)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 no-print">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="hidden sm:inline">Operations</span>
                  <span className="hidden sm:inline" aria-hidden="true">
                    /
                  </span>
                  <span className="truncate font-medium text-slate-900">
                    {sectionTitle[activeSection]}
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                  {sectionTitle[activeSection]}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScannedBarcode(null);
                  setScannedMethod('manual');
                  setScannerOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ScanBarcode className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">Scan Barcode</span>
              </button>

              {canOperate && materials.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleStartMovement(materials[0], 'OUT', 'manual')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Record Movement</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto">
          {toast && (
            <div className="mb-5 flex items-center justify-between gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-900 no-print">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{toast}</span>
              </span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                aria-label="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeSection === 'inventory' && (
            <DashboardInventoryView
              materials={materials}
              transactions={transactions}
              locations={locations}
              locationsById={locationsById}
              loading={dataLoading}
              userRole={userProfile.role}
              onAddMaterial={() => {
                setEditingMaterial(null);
                setPrefillBarcode(undefined);
                setMaterialModalOpen(true);
              }}
              onEditMaterial={(mat) => {
                setEditingMaterial(mat);
                setPrefillBarcode(undefined);
                setMaterialModalOpen(true);
              }}
              onDeleteMaterial={(mat) => setDeleteCandidate(mat)}
              onStartMovement={(mat, type) => handleStartMovement(mat, type, 'manual')}
              onSeedSampleCatalog={async () => {
                await seedInitialWarehouseCatalog(userProfile.uid, locations);
                showToast('Initialized multi-location warehouse sample catalog.');
              }}
              onNavigateAlerts={() => setActiveSection('alerts')}
            />
          )}

          {activeSection === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              locations={locations}
              locationsById={locationsById}
              loading={dataLoading}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertsView
              materials={materials}
              locationsById={locationsById}
              userRole={userProfile.role}
              onQuickRestock={(mat) => handleStartMovement(mat, 'IN', 'manual')}
            />
          )}

          {activeSection === 'reports' && (
            <ReportsView
              materials={materials}
              transactions={transactions}
              locations={locations}
              locationsById={locationsById}
            />
          )}

          {activeSection === 'backups' && (
            <BackupsView
              locations={locations}
              materials={materials}
              transactions={transactions}
              backups={backups}
              backupPolicy={backupPolicy}
              currentUser={userProfile}
              onNotify={showToast}
            />
          )}

          {activeSection === 'team' && (
            <TeamLocationsView
              locations={locations}
              users={users}
              currentUser={userProfile}
              onNotify={showToast}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        materials={materials}
        locationsById={locationsById}
        canOperate={canOperate}
        canManageCatalog={canManageCatalog}
        initialScannedCode={scannedBarcode}
        initialScanMethod={scannedMethod}
        onStartMovement={(mat, type, method) => handleStartMovement(mat, type, method)}
        onCreateWithBarcode={(code) => {
          setEditingMaterial(null);
          setPrefillBarcode(code);
          setMaterialModalOpen(true);
        }}
      />

      <MovementModal
        isOpen={movementOpen}
        onClose={() => setMovementOpen(false)}
        material={movementMaterial}
        materials={materials}
        locations={locations}
        locationsById={locationsById}
        initialType={movementType}
        initialScanMethod={movementScanMethod}
        currentUser={userProfile}
        onSuccess={showToast}
      />

      <MaterialModal
        isOpen={materialModalOpen}
        onClose={() => setMaterialModalOpen(false)}
        editingMaterial={editingMaterial}
        initialBarcode={prefillBarcode}
        locations={locations}
        currentUserId={userProfile.uid}
        onSuccess={showToast}
      />

      {/* Delete Confirmation Dialog */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-semibold text-slate-900">Remove Material Record</h3>
            <p className="text-sm text-slate-600">
              Delete <span className="font-semibold text-slate-900">{deleteCandidate.name}</span> (
              <span className="font-mono">{deleteCandidate.sku}</span>)? Existing historical
              movement records remain intact in the audit ledger.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WarehouseWorkspace />
    </ErrorBoundary>
  );
}
