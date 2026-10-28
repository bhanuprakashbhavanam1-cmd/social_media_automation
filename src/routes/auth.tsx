import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

function AuthPage() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, redirect to home page
  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        window.location.href = "/";
      }
    }
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data?.user && !data?.session) {
          toast.success("Registration initiated!", {
            description: "Please check your email to verify your account.",
          });
        } else {
          toast.success("Welcome aboard!", {
            description: "Your account has been created successfully. Please log in.",
          });
        }
        setIsSignUp(false);
        setPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast.success("Welcome back!", {
          description: "Successfully signed into your workspace.",
        });
        window.location.href = "/";
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      toast.error(isSignUp ? "Sign Up Failed" : "Sign In Failed", {
        description: err.message || "An unexpected error occurred during authentication.",
      });
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
        
        {/* Left Side: Auth Card Form with Light Orange aesthetic */}
        <div className="flex flex-col justify-between p-8 md:p-12 lg:p-16 bg-white/75 backdrop-blur-xl border-r border-orange-200/70 shadow-xl shadow-orange-950/5">
          
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
          <div className="my-auto py-12 max-w-sm w-full mx-auto space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                {isSignUp ? "Create your workspace" : "Welcome back"}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {isSignUp
                  ? "Enter your credentials below to initialize your growth engine."
                  : "Sign in to deploy campaigns and monitor social intelligence."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Password
                </Label>
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
              </div>

              {/* Vibrant Light Orange / Coral CTA Button */}
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
                    <span>{isSignUp ? "Initialize Strategy" : "Enter Platform"}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-orange-200/80"></div>
              <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                or
              </span>
              <div className="flex-grow border-t border-orange-200/80"></div>
            </div>

            <div className="text-center text-sm">
              <span className="text-slate-600">
                {isSignUp ? "Already have a profile? " : "New to the platform? "}
              </span>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-4 transition-colors cursor-pointer"
                disabled={isLoading}
              >
                {isSignUp ? "Log In" : "Register Workspace"}
              </button>
            </div>
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
                    <span className="font-bold text-slate-800">
                      Campaign: Summer Brew Launch
                    </span>
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
                  <span className="text-xs text-slate-600">
                    Publish to IG, FB, X, and YouTube.
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 border border-orange-200/60">
                <CheckCircle size={18} className="text-orange-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-bold text-slate-900 block">Automated Dispatch</span>
                  <span className="text-xs text-slate-600">
                    Queue post buffers for peak reach.
                  </span>
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
