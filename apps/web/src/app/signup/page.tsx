'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Music2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface RegisterResponse {
  token: string;
  user: { id: string; email: string; name: string | null; plan: string };
}

export default function SignupPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email address';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});

    setLoading(true);
    try {
      const data = await api.post<RegisterResponse>('/api/auth/register', { email, password, name });
      login(data.token, data.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      setErrors({ form: err instanceof Error ? err.message : 'Registration failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, #E8FF4706 0%, transparent 70%)' }} />
      </div>

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
              <Music2 className="h-5 w-5 text-base" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">TuneMyMusic</span>
          </Link>
          <h1 className="font-display font-bold text-2xl text-text-primary">Create your account</h1>
          <p className="text-text-secondary text-sm mt-1">Free forever. No credit card required.</p>
        </div>

        <div className="p-8 rounded-2xl bg-surface border border-border">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Your name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Smith"
              autoComplete="name"
              error={errors.name}
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              error={errors.email}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                error={errors.password}
                hint="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-9 text-text-secondary hover:text-text-primary transition-colors"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {errors.form && (
              <motion.p
                className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-4 py-2.5"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {errors.form}
              </motion.p>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} className="font-bold mt-1">
              Create account — it&apos;s free
            </Button>

            <p className="text-xs text-center text-text-secondary">
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:text-accent-dim font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
