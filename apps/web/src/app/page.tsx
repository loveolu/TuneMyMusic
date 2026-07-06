'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Check, Zap, RefreshCw, GitMerge, Scissors, Shield, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLATFORM_CONFIG, TIER_1_PLATFORMS, TIER_2_PLATFORMS } from '@/lib/constants';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

function PlatformCard({ id }: { id: string }) {
  const cfg = PLATFORM_CONFIG[id];
  if (!cfg) return null;
  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface border border-border hover:border-accent/30 transition-all duration-300 group"
      style={{ boxShadow: `0 0 0 0 ${cfg.color}` }}
      whileHover={{ boxShadow: `0 0 24px ${cfg.color}22`, y: -2 }}
    >
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
        style={{ backgroundColor: `${cfg.color}22`, border: `1px solid ${cfg.color}44` }}
      >
        {cfg.emoji}
      </div>
      <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors text-center leading-tight">
        {cfg.name}
      </span>
    </motion.div>
  );
}

const features = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Lightning Fast Transfers',
    desc: 'Move thousands of tracks in minutes, not hours. Our parallel matching engine handles scale.',
    color: '#E8FF47',
  },
  {
    icon: <RefreshCw className="h-5 w-5" />,
    title: 'Scheduled Sync',
    desc: 'Keep playlists in sync across platforms automatically. Set it once and forget it.',
    color: '#4ADE80',
  },
  {
    icon: <GitMerge className="h-5 w-5" />,
    title: 'Playlist Merge & Split',
    desc: 'Combine multiple playlists or split one into many. Deduplicate across platforms.',
    color: '#60A5FA',
  },
  {
    icon: <Scissors className="h-5 w-5" />,
    title: 'Smart Matching',
    desc: 'ISRC codes, fuzzy matching, confidence scoring — we find the right track even when names differ.',
    color: '#F472B6',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Secure & Private',
    desc: 'OAuth2 with encrypted token storage. We never store your passwords. GDPR compliant.',
    color: '#A78BFA',
  },
  {
    icon: <Music2 className="h-5 w-5" />,
    title: '13 Platforms',
    desc: 'Spotify, Apple Music, YouTube Music, Amazon, Tidal, Deezer, SoundCloud, and more.',
    color: '#FB923C',
  },
];

const PLAN_FEATURES = {
  FREE: ['3 transfers / month', 'Up to 100 tracks/playlist', '2 connected platforms', 'Basic matching'],
  PRO: ['50 transfers / month', 'Up to 1,000 tracks/playlist', '5 connected platforms', 'Smart matching + ISRC', 'Scheduled sync (1 playlist)', 'Priority support'],
  UNLIMITED: ['Unlimited transfers', 'Unlimited tracks', 'All 13 platforms', 'Smart matching + ISRC', 'Unlimited scheduled sync', 'Playlist merge & split', 'Health scanner', 'API access'],
};

export default function LandingPage() {
  const tier1 = TIER_1_PLATFORMS;
  const tier2 = TIER_2_PLATFORMS;

  return (
    <div className="min-h-screen bg-base text-text-primary overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-base/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <Music2 className="h-4 w-4 text-base" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">TuneMyMusic</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-text-secondary">
            <Link href="/pricing" className="hover:text-text-primary transition-colors">Pricing</Link>
            <Link href="#features" className="hover:text-text-primary transition-colors">Features</Link>
            <Link href="#platforms" className="hover:text-text-primary transition-colors">Platforms</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, #E8FF4708 0%, transparent 70%)' }}
          />
        </div>

        <div className="max-w-5xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-mono text-accent mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Now supporting 13 platforms
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-black text-5xl md:text-7xl lg:text-8xl tracking-tighter leading-none mb-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Your music.{' '}
            <span className="text-accent relative">
              Every platform.
              <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 100 8" preserveAspectRatio="none">
                <path d="M0 6 Q25 0 50 6 Q75 12 100 6" stroke="#E8FF47" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            Transfer playlists between Spotify, Apple Music, YouTube Music, and 10 more services.
            Smart track matching. Zero manual work.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            <Link href="/signup">
              <Button variant="primary" size="xl" className="w-full sm:w-auto font-bold shadow-lg shadow-accent/20">
                Start free — no credit card
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                View pricing
              </Button>
            </Link>
          </motion.div>

          <motion.p
            className="mt-4 text-xs text-text-secondary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Free plan includes 3 transfers/month · No account needed for quick transfer
          </motion.p>
        </div>
      </section>

      {/* Platforms */}
      <section id="platforms" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-12" {...fadeUp}>
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-3">
              Works with all your services
            </h2>
            <p className="text-text-secondary">Connect once, transfer everywhere.</p>
          </motion.div>

          <div className="mb-8">
            <p className="text-xs text-text-secondary uppercase tracking-widest mb-4 text-center font-mono">
              Tier 1 — Full Support
            </p>
            <motion.div
              className="grid grid-cols-5 gap-3"
              variants={stagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
            >
              {tier1.map((id) => <PlatformCard key={id} id={id} />)}
            </motion.div>
          </div>

          <div>
            <p className="text-xs text-text-secondary uppercase tracking-widest mb-4 text-center font-mono">
              Tier 2 — Standard Support
            </p>
            <motion.div
              className="grid grid-cols-5 gap-3"
              variants={stagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
            >
              {tier2.map((id) => <PlatformCard key={id} id={id} />)}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeUp}>
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-3">
              Everything you need
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Not just a simple copy-paste. A complete music management platform.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="p-6 rounded-2xl bg-surface border border-border hover:border-border/80 transition-all group"
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${f.color}15`, color: f.color }}
                >
                  {f.icon}
                </div>
                <h3 className="font-display font-bold text-lg mb-2 text-text-primary">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-12" {...fadeUp}>
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-3">
              Simple, honest pricing
            </h2>
            <p className="text-text-secondary">Start free. Upgrade when you need more.</p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {/* Free */}
            <motion.div variants={fadeUp} className="p-6 rounded-2xl bg-surface border border-border">
              <p className="text-text-secondary text-sm font-medium mb-2">Free</p>
              <p className="font-display font-black text-4xl mb-6">$0</p>
              <ul className="space-y-3 mb-8">
                {PLAN_FEATURES.FREE.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-text-secondary flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="secondary" size="md" className="w-full">Get started free</Button>
              </Link>
            </motion.div>

            {/* Pro */}
            <motion.div
              variants={fadeUp}
              className="p-6 rounded-2xl bg-surface border-2 border-accent relative"
              style={{ boxShadow: '0 0 32px #E8FF4715' }}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-accent text-base text-xs font-bold px-3 py-1 rounded-full">POPULAR</span>
              </div>
              <p className="text-accent text-sm font-medium mb-2">Pro</p>
              <div className="flex items-end gap-1 mb-6">
                <p className="font-display font-black text-4xl">$4.99</p>
                <span className="text-text-secondary text-sm mb-1">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {PLAN_FEATURES.PRO.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-primary">
                    <Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="primary" size="md" className="w-full font-bold">Get Pro</Button>
              </Link>
            </motion.div>

            {/* Unlimited */}
            <motion.div variants={fadeUp} className="p-6 rounded-2xl bg-surface border border-border">
              <p className="text-success text-sm font-medium mb-2">Unlimited</p>
              <div className="flex items-end gap-1 mb-6">
                <p className="font-display font-black text-4xl">$9.99</p>
                <span className="text-text-secondary text-sm mb-1">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {PLAN_FEATURES.UNLIMITED.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="secondary" size="md" className="w-full">Get Unlimited</Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-12 rounded-3xl bg-surface border border-border relative overflow-hidden"
          >
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, #E8FF4708, transparent 60%)' }} />
            <h2 className="font-display font-black text-4xl md:text-5xl mb-4 relative">
              Ready to move<br />
              <span className="text-accent">your music?</span>
            </h2>
            <p className="text-text-secondary mb-8 relative">
              Join thousands of music lovers who&apos;ve already transferred their playlists.
            </p>
            <Link href="/signup" className="relative">
              <Button variant="primary" size="xl" className="font-bold shadow-xl shadow-accent/20">
                Create free account
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-accent flex items-center justify-center">
              <Music2 className="h-3 w-3 text-base" />
            </div>
            <span className="font-display font-bold text-sm">TuneMyMusic</span>
          </div>
          <p className="text-xs text-text-secondary">
            © 2026 TuneMyMusic. Transfer your playlists with confidence.
          </p>
          <div className="flex gap-4 text-xs text-text-secondary">
            <Link href="/pricing" className="hover:text-text-primary">Pricing</Link>
            <Link href="/login" className="hover:text-text-primary">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
