'use client';
import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ChevronLeft, ListMusic, Music2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Connection { platform: string; platformUsername: string; }
interface Playlist { id: string; name: string; trackCount: number; imageUrl?: string; }
interface CreateTransferResp { transfer: { id: string } }

const steps = ['Source', 'Destination', 'Review'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              active && 'bg-accent text-base',
              done && 'bg-success/10 text-success',
              !active && !done && 'text-text-secondary',
            )}>
              <div className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold',
                active && 'bg-base/30',
                done && 'bg-success/20',
              )}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              {label}
            </div>
            {i < steps.length - 1 && (
              <div className={cn('h-px w-8 mx-1 transition-colors', done ? 'bg-success/40' : 'bg-border')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlatformSelector({
  connections,
  value,
  onChange,
  exclude,
  label,
}: {
  connections: Connection[];
  value: string;
  onChange: (p: string) => void;
  exclude?: string;
  label: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-text-secondary mb-3">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {connections
          .filter((c) => c.platform !== exclude)
          .map((c) => {
            const cfg = PLATFORM_CONFIG[c.platform];
            const selected = value === c.platform;
            return (
              <button
                key={c.platform}
                onClick={() => onChange(c.platform)}
                className={cn(
                  'p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-200',
                  selected ? 'border-accent bg-accent/5' : 'border-border bg-surface hover:border-border/80',
                )}
                style={selected ? { boxShadow: `0 0 20px ${cfg?.color ?? '#E8FF47'}20` } : {}}
              >
                {selected && <Check className="absolute top-2 right-2 h-4 w-4 text-accent" />}
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${cfg?.color ?? '#888'}22`, border: `1px solid ${cfg?.color ?? '#888'}44` }}
                >
                  {cfg?.emoji}
                </div>
                <span className="text-xs font-medium text-text-primary">{cfg?.name ?? c.platform}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

export default function NewTransferPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);

  // Step 1 state
  const [sourcePlatform, setSourcePlatform] = useState(searchParams.get('source') ?? '');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  // Step 2 state
  const [destPlatform, setDestPlatform] = useState('');
  const [createNew, setCreateNew] = useState(true);
  const [keepOrder, setKeepOrder] = useState(true);
  const [confidence, setConfidence] = useState(70);
  const [copyDescription, setCopyDescription] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const { data: connData, isLoading: loadingConn } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  const { data: playlistData, isLoading: loadingPlaylists } = useQuery({
    queryKey: ['playlists', sourcePlatform],
    queryFn: () => api.get<{ playlists: Playlist[] }>(`/api/playlists?platform=${sourcePlatform}`),
    enabled: !!sourcePlatform,
  });

  const createTransfer = useMutation({
    mutationFn: (body: unknown) => api.post<CreateTransferResp>('/api/transfers', body),
    onSuccess: (data) => router.push(`/dashboard/transfer/${data.transfer.id}`),
  });

  const connections = connData?.connections ?? [];
  const playlists = playlistData?.playlists ?? [];

  const initialPlaylistId = searchParams.get('playlist');
  const initialPlaylistName = searchParams.get('name');

  // Pre-select from query params
  useState(() => {
    if (initialPlaylistId && initialPlaylistName && sourcePlatform) {
      setSelectedPlaylist({ id: initialPlaylistId, name: decodeURIComponent(initialPlaylistName), trackCount: 0 });
      setStep(1);
    }
  });

  function handleStart() {
    if (!sourcePlatform || !selectedPlaylist || !destPlatform) return;
    createTransfer.mutate({
      sourcePlatform,
      destinationPlatform: destPlatform,
      sourcePlaylistId: selectedPlaylist.id,
      sourcePlaylistName: selectedPlaylist.name,
      options: {
        createNew,
        addToExisting: !createNew,
        keepOrder,
        makePublic: true,
        copyDescription,
        skipDuplicates,
        confidenceThreshold: confidence,
        transferLiked: false,
      },
    });
  }

  const srcCfg = PLATFORM_CONFIG[sourcePlatform];
  const dstCfg = PLATFORM_CONFIG[destPlatform];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl mb-1">New Transfer</h1>
        <p className="text-text-secondary">Transfer a playlist between platforms in 3 steps</p>
      </div>

      <StepIndicator current={step} />

      <AnimatePresence mode="wait">
        {/* Step 0: Select source */}
        {step === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <div className="p-6 rounded-2xl bg-surface border border-border mb-4">
              {loadingConn ? (
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                </div>
              ) : (
                <PlatformSelector
                  connections={connections}
                  value={sourcePlatform}
                  onChange={(p) => { setSourcePlatform(p); setSelectedPlaylist(null); }}
                  label="Select source platform"
                />
              )}
            </div>

            {/* Playlist selector */}
            {sourcePlatform && (
              <div className="p-6 rounded-2xl bg-surface border border-border mb-6">
                <p className="text-sm font-medium text-text-secondary mb-3">Select playlist</p>
                {loadingPlaylists ? (
                  <div className="space-y-2">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                  </div>
                ) : playlists.length === 0 ? (
                  <p className="text-text-secondary text-sm text-center py-6">No playlists found</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => setSelectedPlaylist(pl)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                          selectedPlaylist?.id === pl.id
                            ? 'bg-accent/10 border border-accent/30'
                            : 'hover:bg-elevated',
                        )}
                      >
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${srcCfg?.color ?? '#888'}15` }}
                        >
                          <Music2 className="h-4 w-4 text-text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{pl.name}</p>
                          <p className="text-xs text-text-secondary">{pl.trackCount} tracks</p>
                        </div>
                        {selectedPlaylist?.id === pl.id && <Check className="h-4 w-4 text-accent flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="md"
                disabled={!sourcePlatform || !selectedPlaylist}
                onClick={() => setStep(1)}
                className="font-semibold"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 1: Destination + options */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <div className="p-6 rounded-2xl bg-surface border border-border mb-4">
              {loadingConn ? (
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                </div>
              ) : (
                <PlatformSelector
                  connections={connections}
                  value={destPlatform}
                  onChange={setDestPlatform}
                  exclude={sourcePlatform}
                  label="Select destination platform"
                />
              )}
            </div>

            {/* Options */}
            <div className="p-6 rounded-2xl bg-surface border border-border mb-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Create new playlist</p>
                  <p className="text-xs text-text-secondary">Create a fresh playlist at the destination</p>
                </div>
                <button
                  onClick={() => setCreateNew(!createNew)}
                  className={cn('h-6 w-11 rounded-full transition-colors relative', createNew ? 'bg-accent' : 'bg-border')}
                >
                  <div className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', createNew ? 'left-5.5 translate-x-0.5' : 'left-0.5')} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Keep track order</p>
                  <p className="text-xs text-text-secondary">Preserve the original playlist ordering</p>
                </div>
                <button
                  onClick={() => setKeepOrder(!keepOrder)}
                  className={cn('h-6 w-11 rounded-full transition-colors relative', keepOrder ? 'bg-accent' : 'bg-border')}
                >
                  <div className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', keepOrder ? 'left-5.5 translate-x-0.5' : 'left-0.5')} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Skip duplicates</p>
                  <p className="text-xs text-text-secondary">Don&apos;t add tracks already in the playlist</p>
                </div>
                <button
                  onClick={() => setSkipDuplicates(!skipDuplicates)}
                  className={cn('h-6 w-11 rounded-full transition-colors relative', skipDuplicates ? 'bg-accent' : 'bg-border')}
                >
                  <div className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', skipDuplicates ? 'left-5.5 translate-x-0.5' : 'left-0.5')} />
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Confidence threshold</p>
                    <p className="text-xs text-text-secondary">Minimum match quality to accept a track</p>
                  </div>
                  <span className="text-sm font-mono text-accent">{confidence}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full accent-[#E8FF47]"
                />
                <div className="flex justify-between text-xs text-text-secondary mt-1">
                  <span>Permissive</span>
                  <span>Strict</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" size="md" onClick={() => setStep(0)}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!destPlatform}
                onClick={() => setStep(2)}
                className="font-semibold"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <div className="p-6 rounded-2xl bg-surface border border-border mb-4">
              <h3 className="font-display font-bold text-lg mb-6">Transfer Summary</h3>

              {/* Source → Destination */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 p-4 rounded-xl bg-elevated border border-border">
                  <p className="text-xs text-text-secondary mb-2">From</p>
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={sourcePlatform} size="md" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{srcCfg?.name}</p>
                      <p className="text-xs text-text-secondary">{selectedPlaylist?.name}</p>
                    </div>
                  </div>
                </div>

                <div className="h-10 w-10 rounded-full bg-elevated border border-border flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="h-4 w-4 text-text-secondary" />
                </div>

                <div className="flex-1 p-4 rounded-xl bg-elevated border border-border">
                  <p className="text-xs text-text-secondary mb-2">To</p>
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={destPlatform} size="md" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{dstCfg?.name}</p>
                      <p className="text-xs text-text-secondary">{createNew ? 'New playlist' : 'Existing playlist'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Settings summary */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Tracks', value: selectedPlaylist?.trackCount ? `~${selectedPlaylist.trackCount}` : 'Unknown' },
                  { label: 'Confidence', value: `${confidence}%+` },
                  { label: 'Order', value: keepOrder ? 'Preserved' : 'Random' },
                  { label: 'Duplicates', value: skipDuplicates ? 'Skipped' : 'Allowed' },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-elevated">
                    <p className="text-xs text-text-secondary">{item.label}</p>
                    <p className="text-sm font-medium text-text-primary">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {createTransfer.error && (
              <div className="mb-4 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
                {(createTransfer.error as Error).message}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" size="md" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                variant="primary"
                size="lg"
                loading={createTransfer.isPending}
                onClick={handleStart}
                className="font-bold shadow-lg shadow-accent/20"
              >
                Start Transfer
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
