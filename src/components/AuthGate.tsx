import React, { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { Boxes, ShieldCheck, ScanBarcode, Lock, ArrowRight, LogOut } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile } from '../types/inventory';

interface AuthGateProps {
  loading: boolean;
  userProfile: UserProfile | null;
  authError: string | null;
}

export const AuthGate: React.FC<AuthGateProps> = ({ loading, userProfile, authError }) => {
  const [signingIn, setSigningIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setLocalError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      setLocalError(msg);
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-4">
          <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
          <div className="h-11 w-full bg-slate-100 rounded-lg animate-pulse mt-4" />
        </div>
      </div>
    );
  }

  if (userProfile && userProfile.status === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Account Suspended</h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Access for <span className="font-mono text-slate-800">{userProfile.email}</span> has been
            suspended by a warehouse administrator. Contact your operations lead to restore access.
          </p>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="w-full border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            StockLedger
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Multi-Location Warehouse Operations
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-xs font-medium tracking-wide text-blue-700">
              Warehouse Inventory &amp; Movement Control
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Real-time material tracking across every warehouse hub.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Record inbound deliveries, material withdrawals, and inter-office transfers with
              atomic inventory updates, hardware or camera barcode scanning, low-stock alerts, and
              AES-256 encrypted daily backups.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2.5 text-slate-900 font-medium text-sm mb-1">
                  <Boxes className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Atomic Movement Ledger</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Every withdrawal or restock updates stock quantities simultaneously with CSV export.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2.5 text-slate-900 font-medium text-sm mb-1">
                  <ScanBarcode className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Barcode Scanner Ready</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Works with USB/Bluetooth keyboard-wedge scanners and mobile device cameras.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2.5 text-slate-900 font-medium text-sm mb-1">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Role-Based Access Control</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Granular Admin, Manager, Operator, and Viewer permissions enforced on the server.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2.5 text-slate-900 font-medium text-sm mb-1">
                  <Lock className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Daily Encrypted Backups</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Client-side AES-256-GCM encrypted snapshots with SHA-256 integrity verification.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-xl p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Sign in to workspace</h2>
              <p className="text-sm text-slate-500 mb-6">
                Authenticate with your organization Google account to access synchronized inventory
                across all warehouse offices.
              </p>

              {displayError && (
                <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {displayError}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                <span>{signingIn ? 'Connecting...' : 'Continue with Google'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="mt-5 text-xs text-slate-500 leading-relaxed">
                New accounts are provisioned as Viewer by default and can be promoted by an
                administrator in Team &amp; Access.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>StockLedger Warehouse Operations</span>
          <span>Static GitHub Pages &amp; Cloud Firestore Sync</span>
        </div>
      </footer>
    </div>
  );
};
