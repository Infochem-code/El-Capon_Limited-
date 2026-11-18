import { InventoryTransaction, Material, WarehouseLocation } from '../types/inventory';

export interface BackupSnapshotPayload {
  version: string;
  exportedAtIso: string;
  backupDate: string;
  locations: Array<Omit<WarehouseLocation, 'createdAt' | 'updatedAt'> & { createdAtIso: string; updatedAtIso: string }>;
  materials: Array<Omit<Material, 'createdAt' | 'updatedAt'> & { createdAtIso: string; updatedAtIso: string }>;
  transactions: Array<Omit<InventoryTransaction, 'createdAt'> & { createdAtIso: string }>;
}

export interface EncryptedArchiveFile {
  format: 'stockledger-encrypted-backup-v1';
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  backupDate: string;
  checksumSha256: string;
  saltBase64: string;
  ivBase64: string;
  encryptedPayload: string;
  counts: {
    locations: number;
    materials: number;
    transactions: number;
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 120000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function buildSnapshotPayload(
  locations: WarehouseLocation[],
  materials: Material[],
  transactions: InventoryTransaction[],
  backupDate: string
): BackupSnapshotPayload {
  return {
    version: '1.0',
    exportedAtIso: new Date().toISOString(),
    backupDate,
    locations: locations.map((loc) => ({
      id: loc.id,
      code: loc.code,
      name: loc.name,
      city: loc.city,
      region: loc.region,
      isActive: loc.isActive,
      createdBy: loc.createdBy,
      createdAtIso: loc.createdAt ? loc.createdAt.toDate().toISOString() : '',
      updatedAtIso: loc.updatedAt ? loc.updatedAt.toDate().toISOString() : '',
    })),
    materials: materials.map((mat) => ({
      id: mat.id,
      sku: mat.sku,
      barcode: mat.barcode,
      name: mat.name,
      category: mat.category,
      locationId: mat.locationId,
      binCode: mat.binCode,
      quantity: mat.quantity,
      unit: mat.unit,
      minStockLevel: mat.minStockLevel,
      unitCost: mat.unitCost,
      supplier: mat.supplier,
      notes: mat.notes,
      createdBy: mat.createdBy,
      updatedBy: mat.updatedBy,
      createdAtIso: mat.createdAt ? mat.createdAt.toDate().toISOString() : '',
      updatedAtIso: mat.updatedAt ? mat.updatedAt.toDate().toISOString() : '',
    })),
    transactions: transactions.map((tx) => ({
      id: tx.id,
      materialId: tx.materialId,
      materialSku: tx.materialSku,
      materialName: tx.materialName,
      type: tx.type,
      quantityChange: tx.quantityChange,
      previousQuantity: tx.previousQuantity,
      newQuantity: tx.newQuantity,
      locationId: tx.locationId,
      targetLocationId: tx.targetLocationId,
      referenceCode: tx.referenceCode,
      reason: tx.reason,
      scanMethod: tx.scanMethod,
      operatorId: tx.operatorId,
      operatorName: tx.operatorName,
      createdAtIso: tx.createdAt ? tx.createdAt.toDate().toISOString() : '',
    })),
  };
}

export async function encryptBackupArchive(
  snapshot: BackupSnapshotPayload,
  passphrase: string
): Promise<EncryptedArchiveFile> {
  const plaintext = JSON.stringify(snapshot);
  const checksumSha256 = await sha256Hex(plaintext);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    format: 'stockledger-encrypted-backup-v1',
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 120000,
    backupDate: snapshot.backupDate,
    checksumSha256,
    saltBase64: bytesToBase64(salt),
    ivBase64: bytesToBase64(iv),
    encryptedPayload: bytesToBase64(new Uint8Array(cipherBuffer)),
    counts: {
      locations: snapshot.locations.length,
      materials: snapshot.materials.length,
      transactions: snapshot.transactions.length,
    },
  };
}

export async function decryptBackupArchive(
  encryptedPayload: string,
  ivBase64: string,
  saltBase64: string,
  expectedChecksumSha256: string,
  passphrase: string
): Promise<{ snapshot: BackupSnapshotPayload; checksumValid: boolean }> {
  const salt = base64ToBytes(saltBase64);
  const iv = base64ToBytes(ivBase64);
  const ciphertext = base64ToBytes(encryptedPayload);
  const key = await deriveAesKey(passphrase, salt);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );

  const plaintext = new TextDecoder().decode(plainBuffer);
  const actualHash = await sha256Hex(plaintext);
  const snapshot = JSON.parse(plaintext) as BackupSnapshotPayload;
  return {
    snapshot,
    checksumValid: actualHash === expectedChecksumSha256,
  };
}

export function downloadEncryptedArchive(archive: EncryptedArchiveFile): void {
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stockledger-backup-${archive.backupDate}.enc.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
