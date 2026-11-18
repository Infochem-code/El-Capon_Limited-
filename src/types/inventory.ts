import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';
export type UserStatus = 'active' | 'suspended';
export type TransactionType = 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';
export type ScanMethod = 'manual' | 'usb_scanner' | 'camera_scanner';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export const BLUEPRINT_LIMITS = {
  ID_MAX: 64,
  UID_MAX: 128,
  EMAIL_MAX: 254,
  DISPLAY_NAME_MAX: 100,
  LOCATION_CODE_MAX: 24,
  LOCATION_NAME_MAX: 100,
  CITY_MAX: 100,
  REGION_MAX: 64,
  SKU_MAX: 48,
  BARCODE_MAX: 64,
  MATERIAL_NAME_MAX: 140,
  CATEGORY_MAX: 64,
  BIN_CODE_MAX: 32,
  UNIT_MAX: 24,
  SUPPLIER_MAX: 120,
  NOTES_MAX: 500,
  REFERENCE_MAX: 64,
  REASON_MAX: 300,
  PAYLOAD_MAX: 600000,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  CODE_PATTERN: /^[A-Z0-9_-]+$/,
  SKU_BARCODE_PATTERN: /^[A-Za-z0-9_.-]+$/,
} as const;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  assignedLocationId: string;
  status: UserStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface WarehouseLocation {
  id: string;
  code: string;
  name: string;
  city: string;
  region: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Material {
  id: string;
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
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface InventoryTransaction {
  id: string;
  materialId: string;
  materialSku: string;
  materialName: string;
  type: TransactionType;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  locationId: string;
  targetLocationId: string;
  referenceCode: string;
  reason: string;
  scanMethod: ScanMethod;
  operatorId: string;
  operatorName: string;
  createdAt: Timestamp | null;
}

export interface EncryptedBackupRecord {
  id: string;
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
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

export interface BackupPolicy {
  dailyAutoEnabled: boolean;
  lastBackupDate: string;
  retentionDays: number;
  updatedBy: string;
  updatedAt: Timestamp | null;
}

export function getStockStatus(material: Pick<Material, 'quantity' | 'minStockLevel'>): StockStatus {
  if (material.quantity <= 0) return 'out_of_stock';
  if (material.quantity <= material.minStockLevel) return 'low_stock';
  return 'in_stock';
}

export function sanitizeIdSegment(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

export function generateRecordId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}
