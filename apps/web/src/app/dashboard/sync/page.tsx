'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Clock, CheckCircle, Pause, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { Dialog } from '@/components/ui/dialog';

// Placeholder data — real implementation would use the API when sync endpoints exist
const MOCK_SYNCS = [
  {
    id: '1',
    sourcePlatform: 'SPOTIFY',
    destPlatform: 'YOUTUBE_MUSIC',
    playlistName: 'My Favorites',
    schedule: 'Daily at 2:00 AM',
    lastRun: '2026-04-07T02:00:00Z',
    nextRun: '2026-04-08T02:00:00Z',
    enabled: true,
    status: 'success',
  },
  {
    id: '2',
    sourcePlatform: 'APPLE_MUSIC',
    destPlatform: 'SPOTIFY',
    playlistName: 'Chill Vibes',
    schedule: 'Weekly on Monday',
    lastRun: '2026-04-07T09:00:00Z',
    nextRun: '2026-04-14T09:00:00Z',
    enabled: false,
    status: 'paused',
  },
];

export default function SyncPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [syncs, setSyncs] = useState(MOCK_SYNCS);

  function toggleSync(id: string) {
    setSyncs((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled, status: s.enabled ? 'paused' : 'success' } : s,
      ),
    );
  }

  function deleteSync(id: string) {
    setSyncs((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1">Scheduled Sync</h1>
          <p className="text-text-secondary">Keep playlists in sync across platforms automatically</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          New Sync
        </Button>
      </div>

      {/* Info banner */}
      <div className="mb-6 p-4 rounded-2xl bg-accent/5 border border-accent/20">
        <p className="text-sm text-accent font-medium mb-1">Pro feature</p>
        <p className="text-xs text-text-secondary">
          Scheduled sync automatically keeps your playlists updated across platforms.
          Upgrade to Pro for 1 scheduled sync, or Unlimited for unlimited syncs.
        </p>
      </div>

      {syncs.length === 0 ? (
        <div className="text-center py-16">
          <RefreshCw className="h-12 w-12 text-text-secondary mx-auto mb-4" />
          <p className="text-text-secondary mb-4">No syncs configured</p>
          <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
            Create your first sync
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {syncs.map((sync, i) => (
            <motion.div
              key={sync.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="p-5">
                <div className="flex items-center gap-4">
                  {/* Platform flow */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <PlatformIcon platform={sync.sourcePlatform} size="md" />
                    <RefreshCw className="h-4 w-4 text-accent" />
                    <PlatformIcon platform={sync.destPlatform} size="md" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary">{sync.playlistName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {sync.schedule}
                      </span>
                      {sync.lastRun && (
                        <span className="text-xs text-text-secondary">
                          Last: {new Date(sync.lastRun).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status + controls */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {sync.status === 'success' && sync.enabled && <Badge variant="success">Active</Badge>}
                    {sync.status === 'paused' && <Badge variant="default">Paused</Badge>}

                    <button
                      onClick={() => toggleSync(sync.id)}
                      className="p-2 rounded-lg hover:bg-elevated transition-colors text-text-secondary hover:text-text-primary"
                      title={sync.enabled ? 'Pause' : 'Resume'}
                    >
                      {sync.enabled ? <Pause className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => deleteSync(sync.id)}
                      className="p-2 rounded-lg hover:bg-error/10 transition-colors text-text-secondary hover:text-error"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} title="Create scheduled sync">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Scheduled sync is available on Pro and Unlimited plans.
            Connect your platforms first, then configure sync schedules here.
          </p>
          <p className="text-xs text-text-secondary p-3 rounded-xl bg-elevated border border-border">
            Full sync creation requires Pro plan. This feature uses the transfer engine to
            automatically sync playlists on a schedule you define.
          </p>
          <Button variant="primary" size="md" className="w-full" onClick={() => setShowCreateDialog(false)}>
            Upgrade to Pro
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
