import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  BLUEPRINT_LIMITS,
  generateRecordId,
  Material,
  ScanMethod,
  TransactionType,
  UserProfile,
  UserRole,
  UserStatus,
  WarehouseLocation,
} from '../types/inventory';

function clampStr(val: string, max: number): string {
  return val.trim().slice(0, max);
}

export async function ensureUserProfile(firebaseUser: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const isBootstrapAdmin =
      firebaseUser.email === 'rma27660@gmail.com' && firebaseUser.emailVerified;

    const newProfile = {
      uid: firebaseUser.uid,
      email: clampStr(firebaseUser.email || 'unknown@warehouse.local', BLUEPRINT_LIMITS.EMAIL_MAX),
      displayName: clampStr(
        firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Warehouse User',
        BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
      ),
      role: (isBootstrapAdmin ? 'admin' : 'viewer') as UserRole,
      assignedLocationId: 'loc_main',
      status: 'active' as UserStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    const createdSnap = await getDoc(userRef);
    return createdSnap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
  }
}

export async function ensureDefaultLocation(adminUid: string): Promise<void> {
  const locRef = doc(db, 'locations', 'loc_main');
  try {
    const snap = await getDoc(locRef);
    if (!snap.exists()) {
      await setDoc(locRef, {
        id: 'loc_main',
        code: 'WH-MAIN',
        name: 'Central Distribution Hub',
        city: 'Seattle',
        region: 'US-West',
        isActive: true,
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'locations/loc_main');
  }
}

export async function seedInitialWarehouseCatalog(
  userId: string,
  existingLocations: WarehouseLocation[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const locationsToSeed = [
      {
        id: 'loc_main',
        code: 'WH-MAIN',
        name: 'Central Distribution Hub',
        city: 'Seattle',
        region: 'US-West',
      },
      {
        id: 'loc_east',
        code: 'WH-EAST',
        name: 'Atlantic Fulfillment Center',
        city: 'Newark',
        region: 'US-East',
      },
      {
        id: 'loc_eu',
        code: 'WH-EU01',
        name: 'Thames Logistics Depot',
        city: 'London',
        region: 'EU-West',
      },
    ];

    const existingLocIds = new Set(existingLocations.map((l) => l.id));
    for (const loc of locationsToSeed) {
      if (!existingLocIds.has(loc.id)) {
        batch.set(doc(db, 'locations', loc.id), {
          ...loc,
          isActive: true,
          createdBy: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const sampleMaterials = [
      {
        id: 'mat_steel_fastener_m8',
        sku: 'FST-M8-SS316',
        barcode: '890123400101',
        name: 'M8 Stainless Hex Bolt Assembly (316 Marine)',
        category: 'Fasteners',
        locationId: 'loc_main',
        binCode: 'A-04-02',
        quantity: 420,
        unit: 'boxes',
        minStockLevel: 100,
        unitCost: 18.5,
        supplier: 'Nordic Precision Hardware',
        notes: 'Corrosion-resistant structural fasteners for assembly line B.',
      },
      {
        id: 'mat_aluminum_extrusion',
        sku: 'ALU-4040-2M',
        barcode: '890123400102',
        name: '40x40mm Anodized Aluminum T-Slot Profile (2m)',
        category: 'Structural Metals',
        locationId: 'loc_main',
        binCode: 'B-11-01',
        quantity: 28,
        unit: 'lengths',
        minStockLevel: 40,
        unitCost: 34.0,
        supplier: 'Cascade Extrusions Ltd',
        notes: 'Low stock alert: pending Q4 framing build.',
      },
      {
        id: 'mat_thermal_sensor',
        sku: 'ELC-PT100-IND',
        barcode: '890123400103',
        name: 'PT100 Industrial RTD Temperature Probe',
        category: 'Electronics',
        locationId: 'loc_east',
        binCode: 'E-02-07',
        quantity: 85,
        unit: 'units',
        minStockLevel: 25,
        unitCost: 42.75,
        supplier: 'Yokohama Controls Corp',
        notes: 'Calibrated +/-0.1C stainless probe with 3m shielded lead.',
      },
      {
        id: 'mat_corrugated_carton',
        sku: 'PKG-BOX-1814',
        barcode: '890123400104',
        name: 'Heavy-Duty Double-Wall Shipping Carton (18x14x12)',
        category: 'Packaging',
        locationId: 'loc_east',
        binCode: 'P-01-04',
        quantity: 0,
        unit: 'bundles',
        minStockLevel: 50,
        unitCost: 29.9,
        supplier: 'Apex Corrugated Co',
        notes: 'Out of stock — urgent replenishment PO submitted.',
      },
      {
        id: 'mat_nitrile_gloves',
        sku: 'SAF-NIT-LG',
        barcode: '890123400105',
        name: 'Industrial 8-mil Nitrile Grip Gloves (Large)',
        category: 'Safety PPE',
        locationId: 'loc_eu',
        binCode: 'S-03-01',
        quantity: 14,
        unit: 'cases',
        minStockLevel: 20,
        unitCost: 64.0,
        supplier: 'Vanguard Safety Group',
        notes: 'Below minimum safety threshold for London depot.',
      },
      {
        id: 'mat_hydraulic_seal',
        sku: 'HYD-VIT-042',
        barcode: '890123400106',
        name: 'Viton High-Temp Hydraulic O-Ring Kit',
        category: 'Hydraulics',
        locationId: 'loc_main',
        binCode: 'H-06-03',
        quantity: 112,
        unit: 'kits',
        minStockLevel: 30,
        unitCost: 27.4,
        supplier: 'FluidSeal Systems',
        notes: 'Rated up to 200C continuous operation.',
      },
    ];

    for (const mat of sampleMaterials) {
      batch.set(doc(db, 'materials', mat.id), {
        ...mat,
        createdBy: userId,
        updatedBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'materials');
  }
}

export interface SaveMaterialInput {
  id?: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  locationId: string;
  binCode: string;
  quantity: number;
  unit: string;
  minStockLevel: number;
  unitCost: number;
  supplier: string;
  notes: string;
}

export async function saveMaterial(
  input: SaveMaterialInput,
  userId: string
): Promise<string> {
  const isEdit = Boolean(input.id);
  const materialId = input.id || generateRecordId('mat');
  const matRef = doc(db, 'materials', materialId);

  const payload = {
    sku: clampStr(input.sku, BLUEPRINT_LIMITS.SKU_MAX),
    barcode: clampStr(input.barcode, BLUEPRINT_LIMITS.BARCODE_MAX),
    name: clampStr(input.name, BLUEPRINT_LIMITS.MATERIAL_NAME_MAX),
    category: clampStr(input.category, BLUEPRINT_LIMITS.CATEGORY_MAX),
    locationId: clampStr(input.locationId, BLUEPRINT_LIMITS.ID_MAX),
    binCode: clampStr(input.binCode, BLUEPRINT_LIMITS.BIN_CODE_MAX),
    quantity: Math.max(0, Number(input.quantity) || 0),
    unit: clampStr(input.unit, BLUEPRINT_LIMITS.UNIT_MAX),
    minStockLevel: Math.max(0, Number(input.minStockLevel) || 0),
    unitCost: Math.max(0, Number(input.unitCost) || 0),
    supplier: clampStr(input.supplier, BLUEPRINT_LIMITS.SUPPLIER_MAX),
    notes: clampStr(input.notes, BLUEPRINT_LIMITS.NOTES_MAX),
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  };

  try {
    if (isEdit) {
      await updateDoc(matRef, payload);
    } else {
      await setDoc(matRef, {
        id: materialId,
        ...payload,
        createdBy: userId,
        createdAt: serverTimestamp(),
      });
    }
    return materialId;
  } catch (error) {
    handleFirestoreError(
      error,
      isEdit ? OperationType.UPDATE : OperationType.CREATE,
      `materials/${materialId}`
    );
  }
}

export async function deleteMaterial(materialId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'materials', materialId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `materials/${materialId}`);
  }
}

export interface RecordMovementInput {
  materialId: string;
  type: TransactionType;
  amount: number; // for IN/OUT/TRANSFER: positive delta magnitude; for ADJUST: target new quantity
  targetLocationId?: string;
  targetMaterialId?: string;
  referenceCode: string;
  reason: string;
  scanMethod: ScanMethod;
}

export async function recordMaterialMovement(
  input: RecordMovementInput,
  operator: UserProfile
): Promise<void> {
  const matRef = doc(db, 'materials', input.materialId);
  const txId = generateRecordId('tx');
  const txRef = doc(db, 'transactions', txId);

  try {
    await runTransaction(db, async (tx) => {
      const matSnap = await tx.get(matRef);
      if (!matSnap.exists()) {
        throw new Error('Material record no longer exists.');
      }
      const mat = matSnap.data() as Material;
      const previousQuantity = mat.quantity;

      let quantityChange = 0;
      let newQuantity = previousQuantity;
      let updatedLocationId = mat.locationId;
      let destMatSnapData: Material | null = null;
      let destMatRef: ReturnType<typeof doc> | null = null;

      if (input.type === 'IN') {
        if (input.amount <= 0) throw new Error('Restock quantity must be greater than zero.');
        quantityChange = input.amount;
        newQuantity = previousQuantity + input.amount;
      } else if (input.type === 'OUT') {
        if (input.amount <= 0) throw new Error('Withdrawal quantity must be greater than zero.');
        if (input.amount > previousQuantity) {
          throw new Error(
            `Insufficient stock: requested ${input.amount} ${mat.unit}, only ${previousQuantity} available.`
          );
        }
        quantityChange = -input.amount;
        newQuantity = previousQuantity - input.amount;
      } else if (input.type === 'ADJUST') {
        if (input.amount < 0) throw new Error('Adjusted stock level cannot be negative.');
        if (input.amount === previousQuantity) {
          throw new Error('Adjusted quantity matches current quantity.');
        }
        newQuantity = input.amount;
        quantityChange = newQuantity - previousQuantity;
      } else if (input.type === 'TRANSFER') {
        if (!input.targetLocationId) {
          throw new Error('Destination warehouse location is required for transfer.');
        }
        if (input.targetLocationId === mat.locationId) {
          throw new Error('Destination location must differ from current location.');
        }

        if (input.targetMaterialId) {
          destMatRef = doc(db, 'materials', input.targetMaterialId);
          const destSnap = await tx.get(destMatRef);
          if (!destSnap.exists()) {
            throw new Error('Destination material record not found.');
          }
          destMatSnapData = destSnap.data() as Material;
          if (input.amount <= 0 || input.amount > previousQuantity) {
            throw new Error(`Transfer quantity must be between 1 and ${previousQuantity}.`);
          }
          quantityChange = -input.amount;
          newQuantity = previousQuantity - input.amount;
        } else {
          // Full batch relocation to destination location
          updatedLocationId = input.targetLocationId;
          quantityChange = 0;
          newQuantity = previousQuantity;
        }
      }

      tx.update(matRef, {
        quantity: newQuantity,
        locationId: updatedLocationId,
        updatedBy: operator.uid,
        updatedAt: serverTimestamp(),
      });

      tx.set(txRef, {
        id: txId,
        materialId: mat.id,
        materialSku: clampStr(mat.sku, BLUEPRINT_LIMITS.SKU_MAX),
        materialName: clampStr(mat.name, BLUEPRINT_LIMITS.MATERIAL_NAME_MAX),
        type: input.type,
        quantityChange,
        previousQuantity,
        newQuantity,
        locationId: mat.locationId,
        targetLocationId: clampStr(input.targetLocationId || '', BLUEPRINT_LIMITS.ID_MAX),
        referenceCode: clampStr(input.referenceCode, BLUEPRINT_LIMITS.REFERENCE_MAX),
        reason: clampStr(input.reason, BLUEPRINT_LIMITS.REASON_MAX),
        scanMethod: input.scanMethod,
        operatorId: operator.uid,
        operatorName: clampStr(operator.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
        createdAt: serverTimestamp(),
      });

      // If transferring partial units to an existing material record at destination location, credit destination atomically
      if (input.type === 'TRANSFER' && destMatRef && destMatSnapData) {
        const destPrev = destMatSnapData.quantity;
        const destNew = destPrev + input.amount;
        const destTxId = generateRecordId('tx');
        tx.update(destMatRef, {
          quantity: destNew,
          updatedBy: operator.uid,
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, 'transactions', destTxId), {
          id: destTxId,
          materialId: destMatSnapData.id,
          materialSku: clampStr(destMatSnapData.sku, BLUEPRINT_LIMITS.SKU_MAX),
          materialName: clampStr(destMatSnapData.name, BLUEPRINT_LIMITS.MATERIAL_NAME_MAX),
          type: 'IN',
          quantityChange: input.amount,
          previousQuantity: destPrev,
          newQuantity: destNew,
          locationId: destMatSnapData.locationId,
          targetLocationId: mat.locationId,
          referenceCode: clampStr(input.referenceCode, BLUEPRINT_LIMITS.REFERENCE_MAX),
          reason: clampStr(
            `Transfer received from ${mat.locationId}: ${input.reason}`.trim(),
            BLUEPRINT_LIMITS.REASON_MAX
          ),
          scanMethod: input.scanMethod,
          operatorId: operator.uid,
          operatorName: clampStr(operator.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
          createdAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Insufficient stock') ||
        error.message.includes('must be') ||
        error.message.includes('matches current') ||
        error.message.includes('Destination') ||
        error.message.includes('no longer exists'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `transactions/${txId}`);
  }
}

export async function saveLocation(
  input: { id?: string; code: string; name: string; city: string; region: string; isActive: boolean },
  adminUid: string
): Promise<void> {
  const isEdit = Boolean(input.id);
  const locationId = input.id || generateRecordId('loc');
  const locRef = doc(db, 'locations', locationId);

  try {
    if (isEdit) {
      await updateDoc(locRef, {
        code: clampStr(input.code.toUpperCase(), BLUEPRINT_LIMITS.LOCATION_CODE_MAX),
        name: clampStr(input.name, BLUEPRINT_LIMITS.LOCATION_NAME_MAX),
        city: clampStr(input.city, BLUEPRINT_LIMITS.CITY_MAX),
        region: clampStr(input.region, BLUEPRINT_LIMITS.REGION_MAX),
        isActive: input.isActive,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(locRef, {
        id: locationId,
        code: clampStr(input.code.toUpperCase(), BLUEPRINT_LIMITS.LOCATION_CODE_MAX),
        name: clampStr(input.name, BLUEPRINT_LIMITS.LOCATION_NAME_MAX),
        city: clampStr(input.city, BLUEPRINT_LIMITS.CITY_MAX),
        region: clampStr(input.region, BLUEPRINT_LIMITS.REGION_MAX),
        isActive: input.isActive,
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isEdit ? OperationType.UPDATE : OperationType.CREATE,
      `locations/${locationId}`
    );
  }
}

export async function updateUserAccess(
  targetUid: string,
  updates: { role: UserRole; assignedLocationId: string; status: UserStatus }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role: updates.role,
      assignedLocationId: updates.assignedLocationId,
      status: updates.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function saveEncryptedBackupRecord(
  record: {
    backupDate: string;
    type: 'daily_auto' | 'manual_encrypted';
    algorithm: string;
    checksumSha256: string;
    materialCount: number;
    transactionCount: number;
    locationCount: number;
    encryptedPayload: string;
    ivBase64: string;
    saltBase64: string;
  },
  operator: UserProfile
): Promise<string> {
  const backupId = generateRecordId('bkp');
  const payload =
    record.encryptedPayload.length <= BLUEPRINT_LIMITS.PAYLOAD_MAX
      ? record.encryptedPayload
      : 'LOCAL_ARCHIVE_ONLY';

  try {
    await setDoc(doc(db, 'backups', backupId), {
      id: backupId,
      backupDate: record.backupDate,
      type: record.type,
      algorithm: record.algorithm,
      checksumSha256: record.checksumSha256,
      materialCount: record.materialCount,
      transactionCount: record.transactionCount,
      locationCount: record.locationCount,
      encryptedPayload: payload,
      ivBase64: record.ivBase64,
      saltBase64: record.saltBase64,
      createdBy: operator.uid,
      createdByName: clampStr(operator.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      createdAt: serverTimestamp(),
    });

    // Update backup policy lastBackupDate
    await setDoc(
      doc(db, 'settings', 'backupPolicy'),
      {
        dailyAutoEnabled: true,
        lastBackupDate: record.backupDate,
        retentionDays: 30,
        updatedBy: operator.uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return backupId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `backups/${backupId}`);
  }
}

export async function updateBackupPolicy(
  policy: { dailyAutoEnabled: boolean; lastBackupDate: string; retentionDays: number },
  operatorUid: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'backupPolicy'), {
      dailyAutoEnabled: policy.dailyAutoEnabled,
      lastBackupDate: policy.lastBackupDate,
      retentionDays: policy.retentionDays,
      updatedBy: operatorUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/backupPolicy');
  }
}
