'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Lock, AlertTriangle, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { PLANS } from '@/lib/constants';

interface UserData { id: string; email: string; name: string | null; plan: string; createdAt: string; }

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: UserData }>('/api/auth/me'),
  });

  const fullUser = meData?.user;
  const plan = fullUser?.plan ?? user?.plan ?? 'FREE';
  const planConfig = PLANS[plan as keyof typeof PLANS] ?? PLANS.FREE;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-1">Settings</h1>
        <p className="text-text-secondary">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <motion.div
        className="p-6 rounded-2xl bg-surface border border-border mb-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-5">
          <User className="h-4 w-4 text-text-secondary" />
          <h2 className="font-display font-bold text-base">Profile</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            label="Email"
            value={fullUser?.email ?? user?.email ?? ''}
            disabled
            hint="Email cannot be changed"
          />
          <Button
            type="submit"
            variant="secondary"
            size="md"
            className={saved ? 'text-success border-success/30' : ''}
          >
            {saved ? (
              <>
                <Save className="h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save changes
              </>
            )}
          </Button>
        </form>
      </motion.div>

      {/* Plan */}
      <motion.div
        className="p-6 rounded-2xl bg-surface border border-border mb-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base">Plan</h2>
          <Badge variant={plan === 'FREE' ? 'default' : plan === 'PRO' ? 'accent' : 'success'}>
            {plan}
          </Badge>
        </div>
        <div className="p-4 rounded-xl bg-elevated border border-border mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">{planConfig.name} Plan</p>
              <p className="text-sm text-text-secondary">
                {planConfig.price === 0 ? 'Free forever' : `$${planConfig.price}/month`}
              </p>
            </div>
            {plan === 'FREE' && (
              <div>
                <p className="text-xs text-text-secondary">
                  {planConfig.transfers} transfers/month
                </p>
              </div>
            )}
          </div>
        </div>
        {plan === 'FREE' && (
          <Button variant="primary" size="md" onClick={() => window.location.href = '/pricing'}>
            Upgrade to Pro
          </Button>
        )}
        {plan !== 'FREE' && (
          <Button variant="secondary" size="md" onClick={() => window.location.href = '/dashboard/settings/billing'}>
            Manage billing
          </Button>
        )}
      </motion.div>

      {/* Account info */}
      {fullUser && (
        <motion.div
          className="p-6 rounded-2xl bg-surface border border-border mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h2 className="font-display font-bold text-base mb-4">Account Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">User ID</span>
              <span className="font-mono text-xs text-text-secondary">{fullUser.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Member since</span>
              <span className="text-text-primary">{new Date(fullUser.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Danger zone */}
      <motion.div
        className="p-6 rounded-2xl bg-surface border border-error/20"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="flex items-center gap-2 mb-4 text-error">
          <AlertTriangle className="h-4 w-4" />
          <h2 className="font-display font-bold text-base">Danger Zone</h2>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button variant="destructive" size="md" onClick={() => setShowDeleteDialog(true)}>
          <Trash2 className="h-4 w-4" />
          Delete account
        </Button>
      </motion.div>

      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete account"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-error/10 border border-error/20">
            <AlertTriangle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
            <div className="text-sm text-error">
              <p className="font-medium mb-1">This cannot be undone</p>
              <p>All your transfers, connected platforms, and account data will be permanently deleted.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => { logout(); }}>
              Delete my account
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
