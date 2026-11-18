import React, { useState } from 'react';
import { Building2, Plus, Shield, Check } from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  UserProfile,
  UserRole,
  UserStatus,
  WarehouseLocation,
} from '../types/inventory';
import { saveLocation, updateUserAccess } from '../lib/warehouseService';

interface TeamLocationsViewProps {
  locations: WarehouseLocation[];
  users: UserProfile[];
  currentUser: UserProfile;
  onNotify: (msg: string) => void;
}

export const TeamLocationsView: React.FC<TeamLocationsViewProps> = ({
  locations,
  users,
  currentUser,
  onNotify,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [showLocForm, setShowLocForm] = useState(false);
  const [locCode, setLocCode] = useState('');
  const [locName, setLocName] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locRegion, setLocRegion] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocError(null);
    const upperCode = locCode.trim().toUpperCase();
    if (!BLUEPRINT_LIMITS.CODE_PATTERN.test(upperCode)) {
      setLocError('Location code must use uppercase letters, numbers, underscores, or hyphens.');
      return;
    }

    setSavingLoc(true);
    try {
      await saveLocation(
        {
          code: upperCode,
          name: locName.trim(),
          city: locCity.trim(),
          region: locRegion.trim(),
          isActive: true,
        },
        currentUser.uid
      );
      setLocCode('');
      setLocName('');
      setLocCity('');
      setLocRegion('');
      setShowLocForm(false);
      onNotify(`Added warehouse location ${upperCode}.`);
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Unable to save location.');
    } finally {
      setSavingLoc(false);
    }
  };

  const handleToggleLocationActive = async (loc: WarehouseLocation) => {
    if (!isAdmin) return;
    await saveLocation(
      {
        id: loc.id,
        code: loc.code,
        name: loc.name,
        city: loc.city,
        region: loc.region,
        isActive: !loc.isActive,
      },
      currentUser.uid
    );
    onNotify(`${loc.code} marked ${!loc.isActive ? 'active' : 'inactive'}.`);
  };

  const handleRoleChange = async (
    target: UserProfile,
    role: UserRole,
    assignedLocationId: string,
    status: UserStatus
  ) => {
    if (!isAdmin) return;
    setSavingUserId(target.uid);
    try {
      await updateUserAccess(target.uid, { role, assignedLocationId, status });
      onNotify(`Updated access permissions for ${target.displayName}.`);
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Multi-Office Warehouse Locations */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Synchronized Office &amp; Warehouse Locations
            </h2>
            <p className="text-xs text-slate-500">
              All hubs synchronize real-time stock quantities and inter-office transfers
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowLocForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Location</span>
            </button>
          )}
        </div>

        {showLocForm && isAdmin && (
          <form
            onSubmit={handleCreateLocation}
            className="p-5 bg-slate-50 border-b border-slate-200 space-y-4"
          >
            {locError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {locError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                minLength={2}
                maxLength={BLUEPRINT_LIMITS.LOCATION_CODE_MAX}
                value={locCode}
                onChange={(e) => setLocCode(e.target.value)}
                placeholder="Code (e.g. WH-SOUTH)"
                className="px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                minLength={2}
                maxLength={BLUEPRINT_LIMITS.LOCATION_NAME_MAX}
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
                placeholder="Facility Name"
                className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                minLength={2}
                maxLength={BLUEPRINT_LIMITS.CITY_MAX}
                value={locCity}
                onChange={(e) => setLocCity(e.target.value)}
                placeholder="City"
                className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                minLength={2}
                maxLength={BLUEPRINT_LIMITS.REGION_MAX}
                value={locRegion}
                onChange={(e) => setLocRegion(e.target.value)}
                placeholder="Region (e.g. US-South)"
                className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLocForm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingLoc}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
              >
                {savingLoc ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-200">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {loc.name}{' '}
                    <span className="font-mono text-xs font-normal text-slate-500">
                      · {loc.code}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {loc.city} · {loc.region} · {loc.isActive ? 'Active Sync' : 'Inactive'}
                  </p>
                </div>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => void handleToggleLocationActive(loc)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg self-start sm:self-auto cursor-pointer"
                >
                  {loc.isActive ? 'Deactivate' : 'Activate'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Stakeholder RBAC Management */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-700" />
            <h2 className="text-lg font-semibold text-slate-900">
              Internal Stakeholders &amp; Role-Based Access
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Admin: full system &amp; user control · Manager: catalog, movements &amp; backups ·
            Operator: barcode scanning &amp; stock movements · Viewer: read-only reporting
          </p>
        </div>

        {!isAdmin ? (
          <div className="p-5 space-y-2">
            <p className="text-sm font-medium text-slate-900">Your Access Profile</p>
            <p className="text-xs text-slate-600">
              Signed in as <span className="font-medium">{currentUser.displayName}</span> (
              <span className="font-mono">{currentUser.email}</span>) · Role:{' '}
              <span className="font-semibold capitalize">{currentUser.role}</span> · Status:{' '}
              <span className="capitalize">{currentUser.status}</span>
            </p>
            <p className="text-xs text-slate-500">
              Only Administrators can view and modify stakeholder directory permissions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Stakeholder</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Assigned Office</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((u) => {
                  const isSelf = u.uid === currentUser.uid;
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {u.displayName} {isSelf ? '(You)' : ''}
                        </div>
                        <div className="text-xs font-mono text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          disabled={isSelf || savingUserId === u.uid}
                          onChange={(e) =>
                            void handleRoleChange(
                              u,
                              e.target.value as UserRole,
                              u.assignedLocationId,
                              u.status
                            )
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md disabled:opacity-60"
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="operator">Operator</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.assignedLocationId}
                          disabled={savingUserId === u.uid}
                          onChange={(e) =>
                            void handleRoleChange(u, u.role, e.target.value, u.status)
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        >
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.code} — {loc.city}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.status}
                          disabled={isSelf || savingUserId === u.uid}
                          onChange={(e) =>
                            void handleRoleChange(
                              u,
                              u.role,
                              u.assignedLocationId,
                              e.target.value as UserStatus
                            )
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md disabled:opacity-60"
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-emerald-700">
                        {savingUserId === u.uid ? (
                          <span className="text-slate-500">Saving...</span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Saved
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
