"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, PhoneCall, ShieldCheck, User } from "lucide-react";
import { useAuth, homeForRole } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button, Input, useToast } from "@/components/ui";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, verifyTwoFactor, user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  // When set, the password step passed and we're awaiting a 2FA code.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  // Already signed in -> bounce to the right home.
  useEffect(() => {
    if (!loading && user) {
      router.replace(homeForRole(user.role));
    }
  }, [user, loading, router]);

  const errMessage = (err: unknown, fallback: string): string =>
    err instanceof ApiError && err.status === 401
      ? fallback
      : err instanceof Error
        ? err.message
        : fallback;

  const onSubmit = async (values: LoginForm) => {
    try {
      const outcome = await login(values.username, values.password);
      if (outcome.status === "2fa") {
        setMfaToken(outcome.mfaToken);
        return;
      }
      router.replace(homeForRole(outcome.user.role));
    } catch (err) {
      toast({
        variant: "error",
        title: "Sign in failed",
        description: errMessage(err, "Invalid username or password."),
      });
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken || code.length !== 6) return;
    setVerifying(true);
    try {
      const signedIn = await verifyTwoFactor(mfaToken, code);
      router.replace(homeForRole(signedIn.role));
    } catch (err) {
      toast({
        variant: "error",
        title: "Verification failed",
        description: errMessage(err, "Invalid or expired code. Try again."),
      });
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel (hidden on small screens) */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-grad-from to-grad-to p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <PhoneCall size={18} />
          </span>
          <span className="text-lg font-semibold">PBX Console</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-bold leading-tight">
            Run your contact center with clarity.
          </h2>
          <p className="mt-4 max-w-md text-white/75">
            Live queues, agent presence, call recordings and analytics — all in
            one calm, focused console.
          </p>
        </div>
        <p className="text-xs text-white/60">
          © {new Date().getFullYear()} PBX Console
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center bg-canvas px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-ink">
                <PhoneCall size={18} />
              </span>
              <span className="text-lg font-semibold text-ink">PBX Console</span>
            </span>
          </div>

          {mfaToken ? (
            <>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink">
                <ShieldCheck size={22} className="text-accent" />
                Two-factor auth
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                Enter the 6-digit code from your authenticator app.
              </p>

              <form onSubmit={onVerify} className="mt-8 flex flex-col gap-4">
                <Input
                  label="Authentication code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                <Button
                  type="submit"
                  size="lg"
                  loading={verifying}
                  disabled={code.length !== 6}
                  className="mt-2 w-full"
                >
                  Verify &amp; sign in
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaToken(null);
                    setCode("");
                  }}
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  ← Back to sign in
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-ink">Welcome back</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Sign in to your account to continue.
              </p>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="mt-8 flex flex-col gap-4"
                noValidate
              >
                <Input
                  label="Username"
                  autoComplete="username"
                  placeholder="you@company"
                  leftIcon={<User size={16} />}
                  error={errors.username?.message}
                  {...register("username")}
                />
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  leftIcon={<Lock size={16} />}
                  error={errors.password?.message}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="rounded p-1 text-ink-subtle transition-colors hover:text-ink"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  {...register("password")}
                />

                <Button
                  type="submit"
                  size="lg"
                  loading={isSubmitting}
                  className="mt-2 w-full"
                >
                  Sign in
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
