import React, { useState } from 'react';
import { Lock, Download, ShieldCheck, Upload, CheckCircle2 } from 'lucide-react';
import {
  BackupPolicy,
  EncryptedBackupRecord,
  InventoryTransaction,
  Material,
  UserProfile,
  WarehouseLocation,
} from '../types/inventory';
import {
  buildSnapshotPayload,
  decryptBackupArchive,
  downloadEncryptedArchive,
  encryptBackupArchive,
  EncryptedArchiveFile,
} from '../lib/cryptoBackup';
import { saveEncryptedBackupRecord, updateBackupPolicy } from '../lib/warehouseService';

interface BackupsViewProps {
  locations: WarehouseLocation[];
  materials: Material[];
  transactions: InventoryTransaction[];
  backups: EncryptedBackupRecord[];
  backupPolicy: BackupPolicy | null;
  currentUser: UserProfile;
  onNotify: (msg: string) => void;
}

export const BackupsView: React.FC<BackupsViewProps> = ({
  locations,
  materials,
  transactions,
  backups,
  backupPolicy,
  currentUser,
  onNotify,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [verifyPassphrase, setVerifyPassphrase] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    backupDate: string;
    counts: { locations: number; materials: number; transactions: number };
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const canManageBackups = currentUser.role === 'admin' || currentUser.role === 'manager';
  const todayIso = new Date().toISOString().slice(0, 10);
  const dailyDoneToday =
    backupPolicy?.lastBackupDate === todayIso ||
    backups.some((b) => b.backupDate === todayIso);

  const handleRunEncryptedBackup = async (type: 'daily_auto' | 'manual_encrypted') => {
    setError(null);
    if (passphrase.trim().length < 8) {
      setError('Enter an encryption passphrase of at least 8 characters.');
      return;
    }

    setCreating(true);
    try {
      const snapshot = buildSnapshotPayload(locations, materials, transactions, todayIso);
      const archive = await encryptBackupArchive(snapshot, passphrase.trim());

      await saveEncryptedBackupRecord(
        {
          backupDate: archive.backupDate,
          type,
          algorithm: archive.algorithm,
          checksumSha256: archive.checksumSha256,
          materialCount: archive.counts.materials,
          transactionCount: archive.counts.transactions,
          locationCount: archive.counts.locations,
          encryptedPayload: archive.encryptedPayload,
          ivBase64: archive.ivBase64,
          saltBase64: archive.saltBase64,
        },
        currentUser
      );

      downloadEncryptedArchive(archive);
      onNotify(
        `AES-256-GCM encrypted backup saved (${archive.counts.materials} materials, ${archive.counts.transactions} movements).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup encryption failed.');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadStoredBackup = (rec: EncryptedBackupRecord) => {
    if (rec.encryptedPayload === 'LOCAL_ARCHIVE_ONLY') {
      setError('This backup exceeded cloud document limits and was archived locally upon creation.');
      return;
    }
    const archive: EncryptedArchiveFile = {
      format: 'stockledger-encrypted-backup-v1',
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: 120000,
      backupDate: rec.backupDate,
      checksumSha256: rec.checksumSha256,
      saltBase64: rec.saltBase64,
      ivBase64: rec.ivBase64,
      encryptedPayload: rec.encryptedPayload,
      counts: {
        locations: rec.locationCount,
        materials: rec.materialCount,
        transactions: rec.transactionCount,
      },
    };
    downloadEncryptedArchive(archive);
  };

  const handleToggleDailyPolicy = async () => {
    if (!canManageBackups) return;
    await updateBackupPolicy(
      {
        dailyAutoEnabled: !(backupPolicy?.dailyAutoEnabled ?? true),
        lastBackupDate: backupPolicy?.lastBackupDate || '',
        retentionDays: backupPolicy?.retentionDays || 30,
      },
      currentUser.uid
    );
    onNotify('Updated daily encrypted backup schedule.');
  };

  const handleVerifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setVerifyError(null);
    setVerifyResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!verifyPassphrase.trim()) {
      setVerifyError('Enter the backup decryption passphrase before selecting a file.');
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as EncryptedArchiveFile;
      const { snapshot, checksumValid } = await decryptBackupArchive(
        parsed.encryptedPayload,
        parsed.ivBase64,
        parsed.saltBase64,
        parsed.checksumSha256,
        verifyPassphrase.trim()
      );
      setVerifyResult({
        valid: checksumValid,
        backupDate: snapshot.backupDate,
        counts: {
          locations: snapshot.locations.length,
          materials: snapshot.materials.length,
          transactions: snapshot.transactions.length,
        },
      });
    } catch {
      setVerifyError('Decryption failed. Verify that the passphrase and .enc.json file are valid.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                AES-256-GCM Encrypted Daily Backups
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Client-side PBKDF2-SHA256 key derivation with authenticated encryption and SHA-256
                checksums
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                dailyDoneToday ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{dailyDoneToday ? 'Today Verified' : 'Daily Backup Due'}</span>
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-900">Daily Backup Policy</p>
              <p className="text-xs text-slate-500">
                Last recorded snapshot:{' '}
                <span className="font-mono text-slate-700">
                  {backupPolicy?.lastBackupDate || 'None yet'}
                </span>{' '}
                · Retention {backupPolicy?.retentionDays || 30} days
              </p>
            </div>
            {canManageBackups && (
              <button
                type="button"
                onClick={handleToggleDailyPolicy}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
              >
                {(backupPolicy?.dailyAutoEnabled ?? true) ? 'Daily Enabled' : 'Enable Daily'}
              </button>
            )}
          </div>

          {canManageBackups ? (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                Encryption Passphrase (never transmitted in plaintext)
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Minimum 8 characters..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void handleRunEncryptedBackup('daily_auto')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{creating ? 'Encrypting...' : "Run Today's Encrypted Backup"}</span>
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void handleRunEncryptedBackup('manual_encrypted')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Manual Archive (.enc.json)</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Manager or Administrator role is required to create or download encrypted database
              backups.
            </p>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
            <h3 className="text-base font-semibold">Decrypt &amp; Verify Archive</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Validate any exported <span className="font-mono">.enc.json</span> snapshot locally in
            your browser using its passphrase and SHA-256 digest.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Decryption Passphrase
            </label>
            <input
              type="password"
              value={verifyPassphrase}
              onChange={(e) => setVerifyPassphrase(e.target.value)}
              placeholder="Enter archive passphrase..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 border border-dashed border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span>Select .enc.json Backup File to Verify</span>
            <input type="file" accept=".json" onChange={handleVerifyFile} className="hidden" />
          </label>

          {verifyError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {verifyError}
            </div>
          )}

          {verifyResult && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <p className="font-semibold">
                {verifyResult.valid
                  ? 'Integrity Check Passed (SHA-256 Match)'
                  : 'Decrypted (Checksum Mismatch)'}
              </p>
              <p className="font-mono">
                Date {verifyResult.backupDate} · {verifyResult.counts.materials} materials ·{' '}
                {verifyResult.counts.transactions} movements · {verifyResult.counts.locations}{' '}
                locations
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Backup Audit Log */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Encrypted Backup History</h3>
          <p className="text-xs text-slate-500">
            Synchronized cloud-encrypted snapshots and SHA-256 verification hashes
          </p>
        </div>

        {backups.length === 0 ? (
          <div className="py-12 px-6 text-center text-xs text-slate-500">
            No encrypted backups recorded yet. Run your first AES-256-GCM snapshot above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Backup Date</th>
                  <th className="py-3 px-4">Type &amp; Cipher</th>
                  <th className="py-3 px-4">Records</th>
                  <th className="py-3 px-4">SHA-256 Digest</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4 text-right">Archive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900">
                      {b.backupDate}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {b.type === 'daily_auto' ? 'Daily Snapshot' : 'Manual Archive'} ·{' '}
                      <span className="font-mono">{b.algorithm}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">
                      {b.materialCount} mat · {b.transactionCount} tx
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      {b.checksumSha256.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{b.createdByName}</td>
                    <td className="py-3 px-4 text-right">
                      {canManageBackups && (
                        <button
                          type="button"
                          onClick={() => handleDownloadStoredBackup(b)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
