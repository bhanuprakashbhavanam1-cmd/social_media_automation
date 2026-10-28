import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Shield,
  Lock,
  Trash2,
  Mail,
  CheckCircle,
  ExternalLink,
  Flame,
  FileText,
  Clock,
  Eye,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy & Data Deletion — OmniMarket AI" },
      {
        name: "description",
        content:
          "Learn how OmniMarket AI handles your data, respects your privacy, and how you can request data deletion for Facebook and Instagram integrations.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const lastUpdated = "June 19, 2026";

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#0a0a0f] text-foreground font-sans relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-5%] h-[600px] w-[600px] rounded-full bg-indigo-500/5 blur-[150px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/auth"
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 shadow-lg shadow-primary/20">
              <Flame size={18} className="text-white animate-pulse" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                OmniMarket <span className="text-primary font-extrabold">AI</span>
              </span>
            </div>
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Platform
          </Link>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative border-b border-white/5 py-16 text-center">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="container relative mx-auto max-w-3xl px-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary font-mono mb-4">
            <Shield size={12} className="animate-pulse" />
            <span>Platform Security & Trust</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400 sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-muted-foreground max-w-xl mx-auto">
            This Privacy Policy explains how OmniMarket AI collects, uses, protects, and manages
            your personal information and data when integrating with social channels.
          </p>
          <div className="mt-6 flex justify-center gap-6 text-xs text-muted-foreground/60 font-mono">
            <span className="flex items-center gap-1">
              <Clock size={12} /> Last Updated: {lastUpdated}
            </span>
            <span className="flex items-center gap-1">
              <Globe size={12} /> Version: 1.0.0
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main Legal Content */}
          <div className="space-y-10 rounded-2xl border border-white/5 bg-white/[0.01] backdrop-blur-md p-6 sm:p-10">
            {/* Section 1: Introduction */}
            <section id="introduction" className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h2 className="text-xl font-bold text-white">1. Introduction</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Welcome to <strong>OmniMarket AI</strong> ("we", "our", "us"). We are committed to
                protecting your personal data and your privacy. This Privacy Policy describes how we
                collect, use, and share information when you use our social media scheduling,
                automation, and analytics suite (the "Platform"), including our integrations with
                third-party platforms like Meta (Facebook and Instagram).
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                By connecting your social media accounts, registering a workspace, or using any of
                our services, you consent to the data practices described in this policy.
              </p>
            </section>

            {/* Section 2: Data Collection */}
            <section id="data-collection" className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h2 className="text-xl font-bold text-white">2. Information We Collect</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To provide our automation services, we collect information that is either provided
                directly by you or retrieved from social channels with your explicit authorization:
              </p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2.5 items-start">
                  <CheckCircle size={14} className="text-primary shrink-0 mt-1" />
                  <span>
                    <strong className="text-white">Account Credentials & Profiles:</strong> When you
                    register, we collect your email address and basic profile information via our
                    authentication system.
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <CheckCircle size={14} className="text-primary shrink-0 mt-1" />
                  <span>
                    <strong className="text-white">
                      Meta Integration Data (Facebook & Instagram):
                    </strong>{" "}
                    When you link your Meta assets, we request OAuth tokens and access permissions.
                    This includes page metadata, page tokens, connected Instagram Business Account
                    IDs, and channel names to display in your dashboard and publish your posts.
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <CheckCircle size={14} className="text-primary shrink-0 mt-1" />
                  <span>
                    <strong className="text-white">Content & Scheduling Data:</strong> We store the
                    post drafts, schedules, images, video URLs, and captions you input into our
                    Campaign Creator or Content Queue so we can publish them on your behalf.
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <CheckCircle size={14} className="text-primary shrink-0 mt-1" />
                  <span>
                    <strong className="text-white">Reach & Performance Analytics:</strong> We fetch
                    aggregated insights (such as views, engagement, clicks, and impressions) from
                    connected social channels to display analytics reports inside your workspace.
                  </span>
                </li>
              </ul>
            </section>

            {/* Section 3: Meta & Third-Party API Integrations */}
            <section id="third-party-apis" className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h2 className="text-xl font-bold text-white">
                  3. Third-Party API Usage (Meta API)
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                OmniMarket AI interacts with Facebook and Instagram using official Meta Graph APIs.
                We strictly adhere to Meta Developer Policies:
              </p>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4.5 space-y-3">
                <div className="flex gap-2 text-xs font-mono text-primary items-center">
                  <Lock size={12} />
                  <span>Token Encryption</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your access tokens are stored securely in encrypted fields within our database
                  (hosted on Supabase) and are only read when our background queues execute a
                  scheduled publish command on your behalf. We do not sell, rent, or trade your
                  access tokens or your audience metrics to any third parties.
                </p>
              </div>
            </section>

            {/* Section 4: Data Retention & Security */}
            <section id="data-retention" className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h2 className="text-xl font-bold text-white">4. Data Retention & Security</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We store your data for as long as your workspace is active or as needed to provide
                you with the Platform's services. We implement industry-standard 256-bit SSL
                encryption, database level row-security policies (RLS), and secure token handling
                protocols to safeguard your credentials and content.
              </p>
            </section>

            {/* Section 5: Data Deletion Instructions (Meta Compliant) */}
            <section id="data-deletion" className="space-y-5 border-t border-white/5 pt-8">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                  <Trash2 size={13} />
                </div>
                <h2 className="text-xl font-bold text-white">5. Data Deletion Instructions</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                According to Meta Platform Policies, we must provide instructions on how users can
                request or initiate the deletion of their personal information and data imported
                from Facebook or Instagram.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you wish to delete your activities or account data associated with OmniMarket AI,
                you have two options:
              </p>

              {/* Instructions steps */}
              <div className="space-y-4">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary block">
                    Option A: Revoke Access via Meta Settings (Self-Service)
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You can remove our application's access to your Facebook account at any time
                    through your Facebook Profile:
                  </p>
                  <ol className="list-decimal pl-4 text-xs text-muted-foreground space-y-1.5">
                    <li>
                      Go to your Facebook Account's{" "}
                      <strong>Settings & Privacy &gt; Settings</strong>.
                    </li>
                    <li>
                      In the left sidebar, navigate to <strong>Apps and Websites</strong> or{" "}
                      <strong>Business Integrations</strong>.
                    </li>
                    <li>
                      Locate <strong>OmniMarket AI</strong> in the active list.
                    </li>
                    <li>
                      Click the <strong>Remove</strong> button next to the app.
                    </li>
                    <li>
                      (Optional) Check the box to allow Facebook to request that we delete your
                      associated activity logs.
                    </li>
                  </ol>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary block">
                    Option B: Direct Deletion Request (Email support)
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    To request that we permanently purge all your workspace data, credentials, and
                    social media caches from our servers:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <a
                      href="mailto:support@omnimarket.ai?subject=OmniMarket AI Data Deletion Request"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 px-4 text-xs font-semibold text-white border border-white/5 transition-colors"
                    >
                      <Mail size={12} />
                      Email support@omnimarket.ai
                    </a>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-1.5">
                    * Please specify your registered email address and the social accounts
                    connected. Deletion requests are processed within 48 to 72 business hours, after
                    which you will receive a confirmation email.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 6: Contact Info */}
            <section id="contact" className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h2 className="text-xl font-bold text-white">6. Contact Us</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you have any questions, concerns, or requests regarding this Privacy Policy or
                your data, please contact us at:
              </p>
              <div className="text-sm text-muted-foreground pl-1">
                <span className="block font-semibold text-white">OmniMarket AI Team</span>
                <span className="block">Email: support@omnimarket.ai</span>
                <span className="block">URL: https://omnimarket.ai</span>
              </div>
            </section>
          </div>

          {/* Sticky Sidebar Links */}
          <div className="space-y-6">
            <div className="sticky top-24 rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block">
                Quick Navigation
              </span>
              <nav className="flex flex-col gap-2">
                <a
                  href="#introduction"
                  className="text-xs text-muted-foreground hover:text-white transition-colors py-1 flex items-center gap-1.5"
                >
                  <FileText size={12} /> 1. Introduction
                </a>
                <a
                  href="#data-collection"
                  className="text-xs text-muted-foreground hover:text-white transition-colors py-1 flex items-center gap-1.5"
                >
                  <Eye size={12} /> 2. Data Collected
                </a>
                <a
                  href="#third-party-apis"
                  className="text-xs text-muted-foreground hover:text-white transition-colors py-1 flex items-center gap-1.5"
                >
                  <ExternalLink size={12} /> 3. Third-Party APIs
                </a>
                <a
                  href="#data-retention"
                  className="text-xs text-muted-foreground hover:text-white transition-colors py-1 flex items-center gap-1.5"
                >
                  <Lock size={12} /> 4. Security & Retention
                </a>
                <a
                  href="#data-deletion"
                  className="text-xs text-primary font-semibold hover:underline py-1 flex items-center gap-1.5"
                >
                  <Trash2 size={12} /> 5. Data Deletion
                </a>
                <a
                  href="#contact"
                  className="text-xs text-muted-foreground hover:text-white transition-colors py-1 flex items-center gap-1.5"
                >
                  <Mail size={12} /> 6. Contact Us
                </a>
              </nav>

              <div className="border-t border-white/5 pt-4">
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3.5 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-500 font-bold block">
                    Meta Status
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This Privacy Policy page contains standard provisions required for Meta app
                    submission and validation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 bg-[#08080c] py-8 text-center text-xs text-muted-foreground/60">
        <div className="container mx-auto px-4">
          <p>© {new Date().getFullYear()} OmniMarket AI. All rights reserved.</p>
          <div className="mt-3 flex justify-center gap-4">
            <Link to="/privacy" className="hover:text-white hover:underline transition-all">
              Privacy Policy
            </Link>
            <span className="text-white/10">•</span>
            <Link to="/auth" className="hover:text-white hover:underline transition-all">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
