'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ListMusic,
  ArrowLeftRight,
  History,
  RefreshCw,
  Wrench,
  BarChart2,
  Settings,
  Heart,
  Search,
  Music2,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/playlists', label: 'Playlists', icon: ListMusic },
  { href: '/dashboard/transfer/new', label: 'Transfer', icon: ArrowLeftRight },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/sync', label: 'Sync', icon: RefreshCw },
  { href: '/dashboard/liked-songs', label: 'Liked Songs', icon: Heart },
  { href: '/dashboard/search', label: 'Search', icon: Search },
  { separator: true } as const,
  { href: '/dashboard/tools/merge', label: 'Merge', icon: Wrench },
  { href: '/dashboard/tools/split', label: 'Split', icon: Wrench },
  { href: '/dashboard/tools/health', label: 'Health Check', icon: Wrench },
  { href: '/dashboard/tools/duplicates', label: 'Duplicates', icon: Wrench },
  { separator: true } as const,
  { href: '/dashboard/stats', label: 'Stats', icon: BarChart2 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <Music2 className="h-4 w-4 text-base" />
          </div>
          <span className="font-display font-bold text-base tracking-tight">TuneMyMusic</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navItems.map((item, i) => {
          if ('separator' in item) {
            return <div key={i} className="my-2 border-t border-border/50 mx-2" />;
          }
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group mb-0.5',
                isActive
                  ? 'bg-accent text-base font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface',
              )}
            >
              <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-base' : '')} />
              {item.label}
              {isActive && <ChevronRight className="h-3 w-3 ml-auto text-base/70" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {isAuthenticated && user && (
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-accent">
                {(user.name || user.email)[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{user.name || user.email}</p>
              <Badge variant={user.plan === 'FREE' ? 'default' : user.plan === 'PRO' ? 'accent' : 'success'} className="text-xs">
                {user.plan}
              </Badge>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-error hover:bg-error/5 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loadFromStorage } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, [loadFromStorage]);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-border flex-shrink-0 bg-surface/50">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 bottom-0 z-50 w-56 bg-surface border-r border-border lg:hidden flex flex-col"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface/80 backdrop-blur">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-text-secondary hover:text-text-primary">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
              <Music2 className="h-3.5 w-3.5 text-base" />
            </div>
            <span className="font-display font-bold text-sm">TuneMyMusic</span>
          </div>
          <div className="w-9" />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
