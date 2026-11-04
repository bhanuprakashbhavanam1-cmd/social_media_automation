import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Flame,
  Send,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Authenticate — OmniMarket AI" },
      {
        name: "description",
        content: "Sign in or register to access the social automation and AI engine.",
      },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "signin" | "signup" | "forgot_password" | "reset_password";

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured] = useState(() => isSupabaseConfigured());

  // Listen for sessions & password recovery events
  useEffect(() => {
    let isMounted = true;

    async function checkCurrentSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session && isMounted && mode !== "reset_password") {
          window.location.href = "/";
        }
      } catch (err) {
        console.error("Session check error:", err);
      }
    }
    checkCurrentSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY") {
        setMode("reset_password");
        toast.info("Password Recovery Active", {
          description: "Please enter your new password below.",
        });
      } else if (session && event === "SIGNED_IN" && mode !== "reset_password") {
        window.location.href = "/";
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [mode]);

  const validateInputs = () => {
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (mode !== "reset_password") {
      if (!trimmedEmail) {
        toast.error("Email required", {
          description: "Please enter your email address.",
        });
        return false;
      }
      if (!emailRegex.test(trimmedEmail)) {
        toast.error("Invalid email format", {
          description: "Please enter a valid email address.",
        });
        return false;
      }
    }

    if (mode === "signin" || mode === "signup" || mode === "reset_password") {
      if (!password) {
        toast.error("Password required", {
          description: "Please enter your password.",
        });
        return false;
      }
      if (password.length < 6) {
        toast.error("Password too short", {
          description: "Password must be at least 6 characters long.",
        });
        return false;
      }
    }

    if (mode === "signup" || mode === "reset_password") {
      if (confirmPassword && password !== confirmPassword) {
        toast.error("Passwords do not match", {
          description: "Please ensure both password fields match exactly.",
        });
        return false;
      }
    }

    return true;
  };

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        throw new Error("Invalid email or password. Please verify your credentials.");
      }
      if (error.message.toLowerCase().includes("email not confirmed")) {
        throw new Error("Please verify your email address before signing in.");
      }
      throw error;
    }

    toast.success("Welcome back!", {
      description: "Successfully signed into your workspace.",
    });
    window.location.href = "/";
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("user already registered")) {
        throw new Error("This email is already registered. Please sign in instead.");
      }
      throw error;
    }

    // If confirmation is disabled, session is returned immediately
    if (data?.session) {
      toast.success("Welcome aboard!", {
        description: "Your workspace has been created. Redirecting...",
      });
      window.location.href = "/";
    } else {
      // Email confirmation is required
      toast.success("Verification Email Dispatched!", {
        description: `We sent a confirmation link to ${trimmedEmail}. Please verify your email before logging in.`,
        duration: 9000,
      });
      setMode("signin");
      setPassword("");
      setConfirmPassword("");
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    const redirectUrl =
      typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: redirectUrl,
    });

    if (error) throw error;

    toast.success("Reset link sent!", {
      description: `If an account exists for ${trimmedEmail}, a password recovery link has been dispatched.`,
      duration: 8000,
    });
    setMode("signin");
  };

  const handleUpdatePassword = async () => {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) throw error;

    toast.success("Password Updated!", {
      description: "Your password has been successfully reset. Redirecting...",
    });
    window.location.href = "/";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConfigured) {
      toast.error("Database Configuration Required", {
        description:
          "Please configure your Supabase URL and Anon Key in .env before attempting authentication.",
      });
      return;
    }

    if (!validateInputs()) return;

    setIsLoading(true);

    try {
      if (mode === "signin") {
        await handleSignIn();
      } else if (mode === "signup") {
        await handleSignUp();
      } else if (mode === "forgot_password") {
        await handleForgotPassword();
      } else if (mode === "reset_password") {
        await handleUpdatePassword();
      }
    } catch (err: any) {
      console.error("Authentication action failed:", err);
      let title = "Authentication Failed";
      if (mode === "signup") title = "Registration Failed";
      if (mode === "signin") title = "Sign In Failed";
      if (mode === "forgot_password") title = "Reset Request Failed";
      if (mode === "reset_password") title = "Password Update Failed";

      const message = err?.message?.includes("Failed to fetch")
        ? "Cannot connect to authentication server. Please check your internet connection or Supabase settings."
        : err?.message || "An unexpected error occurred.";

      toast.error(title, { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FFF6ED] text-slate-900 font-sans overflow-hidden relative selection:bg-orange-500 selection:text-white">
      {/* Light Orange Ambient Background Orbs */}
      <div className="pointer-events-none absolute top-[-15%] left-[-10%] h-[650px] w-[650px] rounded-full bg-[#FFE4D6] blur-[140px] opacity-80" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-5%] h-[600px] w-[600px] rounded-full bg-[#FFEDD5] blur-[150px] opacity-90" />
      <div className="pointer-events-none absolute top-[30%] right-[25%] h-[350px] w-[350px] rounded-full bg-[#FED7AA]/50 blur-[120px]" />

      <div className="relative z-10 grid w-full grid-cols-1 lg:grid-cols-[550px_1fr]">
        {/* Left Side: Auth Card Form */}
        <div className="flex flex-col justify-between p-8 md:p-12 lg:p-16 bg-white/80 backdrop-blur-xl border-r border-orange-200/70 shadow-xl shadow-orange-950/5">
          {/* Logo / Header */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-md shadow-orange-500/25">
              <Flame size={20} className="text-white animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                OmniMarket <span className="text-orange-600 font-black">AI</span>
              </span>
            </div>
          </div>

          {/* Form Container */}
          <div className="my-auto py-8 max-w-sm w-full mx-auto space-y-6">
            {/* Warning banner if Supabase placeholder detected */}
            {!isConfigured && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-1.5 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                  <span>Supabase Credentials Required</span>
                </div>
                <p className="text-amber-700 leading-relaxed">
                  Placeholder values are present in your{" "}
                  <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">.env</code> file. Add
                  your live Supabase URL & Anon Key to enable user registrations and database
                  synchronization.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                {mode === "signup" && "Create your workspace"}
                {mode === "signin" && "Welcome back"}
                {mode === "forgot_password" && "Reset Password"}
                {mode === "reset_password" && "Set New Password"}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {mode === "signup" &&
                  "Enter your credentials below to initialize your growth engine."}
                {mode === "signin" &&
                  "Sign in to deploy campaigns and monitor social intelligence."}
                {mode === "forgot_password" &&
                  "Enter your registered email to receive password recovery instructions."}
                {mode === "reset_password" &&
                  "Enter your new password to restore access to your workspace."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input (hidden for reset_password mode) */}
              {mode !== "reset_password" && (
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 border-orange-200/90 bg-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:border-orange-500 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg shadow-sm transition-all"
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>
              )}

              {/* Password Input (hidden for forgot_password mode) */}
              {mode !== "forgot_password" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                    >
                      {mode === "reset_password" ? "New Password" : "Password"}
                    </Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot_password")}
                        className="text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 border-orange-200/90 bg-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:border-orange-500 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg shadow-sm transition-all"
                      required
                      disabled={isLoading}
                      minLength={6}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {(mode === "signup" || mode === "reset_password") && (
                    <p className="text-[11px] text-slate-500">
                      Must contain at least 6 characters.
                    </p>
                  )}
                </div>
              )}

              {/* Confirm Password (only for signup and reset_password) */}
              {(mode === "signup" || mode === "reset_password") && (
                <div className="space-y-2">
                  <Label
                    htmlFor="confirm-password"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <KeyRound
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 border-orange-200/90 bg-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:border-orange-500 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg shadow-sm transition-all"
                      required
                      disabled={isLoading}
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 mt-2 gap-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-orange-500/25 rounded-lg transition-all active:scale-[0.98] cursor-pointer border border-orange-400/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === "signin" && "Enter Platform"}
                      {mode === "signup" && "Initialize Strategy"}
                      {mode === "forgot_password" && "Send Reset Link"}
                      {mode === "reset_password" && "Save New Password"}
                    </span>
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </form>

            {/* Back button for Forgot Password mode */}
            {mode === "forgot_password" && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer"
                  disabled={isLoading}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign In</span>
                </button>
              </div>
            )}

            {/* Toggle between Login and Signup */}
            {(mode === "signin" || mode === "signup") && (
              <>
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-orange-200/80"></div>
                  <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    or
                  </span>
                  <div className="flex-grow border-t border-orange-200/80"></div>
                </div>

                <div className="text-center text-sm">
                  <span className="text-slate-600">
                    {mode === "signup" ? "Already have a profile? " : "New to the platform? "}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === "signup" ? "signin" : "signup");
                      setPassword("");
                      setConfirmPassword("");
                    }}
                    className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-4 transition-colors cursor-pointer"
                    disabled={isLoading}
                  >
                    {mode === "signup" ? "Log In" : "Register Workspace"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer Security Badge & Privacy Policy Link */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>Secure 256-bit SSL encrypted dashboard handshake</span>
            </div>
            <Link
              to="/privacy"
              className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-4 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>

        {/* Right Side: Gorgeous Showcase in Warm Light Orange Theme */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-[#FFF6ED] via-[#FFEDD5]/60 to-[#FFE4D6] relative overflow-hidden">
          {/* Decorative Subtle Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c0a_1px,transparent_1px),linear-gradient(to_bottom,#ea580c0a_1px,transparent_1px)] bg-[size:20px_20px]" />

          <div className="relative flex justify-end">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-orange-200 bg-white/80 backdrop-blur-md text-xs font-mono text-slate-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>DeepSeek AI Optimization Engine Active</span>
            </div>
          </div>

          <div className="relative max-w-lg space-y-8 my-auto">
            <div className="space-y-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 border border-orange-200 shadow-sm">
                <Sparkles size={18} className="animate-pulse text-orange-500" />
              </div>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight text-slate-900">
                Automate Social Reach with Generative AI
              </h2>
              <p className="text-base text-slate-600 leading-relaxed">
                Connect your brand channels, spark high-performance marketing copy via custom
                fine-tuned models, and schedule posts based on advanced audience metrics.
              </p>
            </div>

            {/* Mock Dashboard Widget with Light Orange Highlights */}
            <div className="rounded-2xl border border-orange-200/90 bg-white/80 backdrop-blur-md p-6 space-y-4 shadow-xl shadow-orange-950/5">
              <div className="flex items-center justify-between border-b border-orange-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                    Auto-publish Stream
                  </span>
                </div>
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-orange-50/80 border border-orange-200/60">
                  <div className="flex items-center gap-2.5">
                    <Send size={14} className="text-orange-600" />
                    <span className="font-bold text-slate-800">Campaign: Summer Brew Launch</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-mono">
                    Scheduled
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-orange-50/80 border border-orange-200/60">
                  <div className="flex items-center gap-2.5">
                    <Send size={14} className="text-orange-600" />
                    <span className="font-bold text-slate-800">Campaign: Automate SaaS 1.0</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 font-mono">
                    Completed
                  </span>
                </div>
              </div>
            </div>

            {/* Feature Bullets */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 border border-orange-200/60">
                <CheckCircle size={18} className="text-orange-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-bold text-slate-900 block">Multi-channel Sync</span>
                  <span className="text-xs text-slate-600">Publish to IG, FB, X, and YouTube.</span>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 border border-orange-200/60">
                <CheckCircle size={18} className="text-orange-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-bold text-slate-900 block">Automated Dispatch</span>
                  <span className="text-xs text-slate-600">Queue post buffers for peak reach.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative text-xs text-slate-500 font-mono">
            OmniMarket AI Version 1.4.2-alpha
          </div>
        </div>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}
