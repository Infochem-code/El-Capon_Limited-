import React from 'react';
import {
  Boxes,
  ArrowLeftRight,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
  Building2,
  LogOut,
  X,
} from 'lucide-react';
import { UserProfile } from '../types/inventory';

export type NavSection =
  | 'inventory'
  | 'transactions'
  | 'alerts'
  | 'reports'
  | 'backups'
  | 'team';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  userProfile: UserProfile;
  lowStockCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  userProfile,
  lowStockCount,
  isOpenMobile,
  onCloseMobile,
  onSignOut,
}) => {
  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'transactions', label: 'Movement Log', icon: ArrowLeftRight },
    {
      id: 'alerts',
      label: 'Low Stock Alerts',
      icon: AlertTriangle,
      count: lowStockCount > 0 ? lowStockCount : undefined,
    },
    { id: 'reports', label: 'Weekly Reports', icon: BarChart3 },
    { id: 'backups', label: 'Encrypted Backups', icon: ShieldAlert },
    { id: 'team', label: 'Locations & Team', icon: Building2 },
  ];

  const roleLabels: Record<UserProfile['role'], string> = {
    admin: 'Administrator',
    manager: 'Manager',
    operator: 'Operator',
    viewer: 'Viewer',
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
          StockLedger
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-500'}`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.count !== undefined && (
                <span className="font-mono text-xs font-semibold tabular-nums text-amber-700">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{userProfile.displayName}</p>
          <p className="text-xs text-slate-500 truncate">
            {roleLabels[userProfile.role]} · {userProfile.email}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 no-print">{navContent}</aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
};
