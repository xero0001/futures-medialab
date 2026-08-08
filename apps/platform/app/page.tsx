import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Gamepad2,
  Globe2,
  Handshake,
  Languages,
  Layers3,
  MapPin,
  Megaphone,
  Play,
  ShieldCheck,
  Sparkles,
  Users2,
  Video,
} from "lucide-react";

const solutions: Array<{
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    eyebrow: "For creators",
    title: "Find campaigns that fit your audience.",
    description:
      "Discover clear briefs, transparent requirements, and opportunities built around your channel and region.",
    cta: "Explore opportunities",
    icon: Video,
    tone: "solution-card-blue",
  },
  {
    eyebrow: "For agencies",
    title: "Run every creator from one workspace.",
    description:
      "Coordinate applications, submissions, approvals, and earnings across your entire creator roster.",
    cta: "Manage your network",
    icon: Users2,
    tone: "solution-card-indigo",
  },
  {
    eyebrow: "For brands",
    title: "Turn a brief into content that performs.",
    description:
      "Launch creator campaigns with structured review, verified delivery, and a settlement flow you can trust.",
    cta: "Launch a campaign",
    icon: Megaphone,
    tone: "solution-card-violet",
  },
];

const process = [
  {
    number: "01",
    title: "Build the brief",
    description:
      "Set target regions, platforms, creator criteria, deliverables, and payout rules.",
  },
  {
    number: "02",
    title: "Match the right creators",
    description:
      "Creators and agencies apply to qualified offers with verified channel profiles.",
  },
  {
    number: "03",
    title: "Create and approve",
    description:
      "Keep drafts, revisions, publishing dates, and final links in one shared workflow.",
  },
  {
    number: "04",
    title: "Verify and settle",
    description:
      "Confirm results, calculate earnings, and move approved work into payout.",
  },
];

const advantages: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Creator-first network",
    description:
      "Built on direct relationships with Korean creators, streamers, studios, and MCNs.",
    icon: Handshake,
  },
  {
    title: "Glocal campaign operations",
    description:
      "One operating layer for global brands and locally relevant creator execution.",
    icon: Globe2,
  },
  {
    title: "Structured verification",
    description:
      "Clear checkpoints from application and draft review to published-content validation.",
    icon: BadgeCheck,
  },
  {
    title: "Transparent settlement",
    description:
      "Assignment-level payout terms and auditable approval history for every collaboration.",
    icon: CircleDollarSign,
  },
];

const collaborationFeatures: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Frozen assignment terms",
    description:
      "Every selected creator keeps a clear snapshot of scope, timing, and payout rules.",
    icon: ShieldCheck,
  },
  {
    title: "Structured content review",
    description:
      "Collect drafts, revision notes, final URLs, and verification in the same timeline.",
    icon: Layers3,
  },
  {
    title: "Auditable settlements",
    description:
      "Track approved earnings and payout status without ambiguous balance changes.",
    icon: Banknote,
  },
];

const platformRows = [
  {
    name: "Riftbound: Global Launch",
    region: "KR / JP",
    reward: "$1,800",
    tone: "from-blue-500 to-indigo-500",
  },
  {
    name: "Neon Circuit Season 3",
    region: "SEA",
    reward: "$950",
    tone: "from-violet-500 to-fuchsia-500",
  },
  {
    name: "Pocket Kingdom Creator Quest",
    region: "Global",
    reward: "$2,400",
    tone: "from-cyan-500 to-blue-600",
  },
];

function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span
        className={`text-[17px] font-extrabold tracking-[-0.04em] ${inverted ? "text-white" : "text-slate-950"}`}
      >
        Futures Medialab
      </span>
    </span>
  );
}

function ArrowLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700"
      href="#contact"
    >
      {children}
      <ArrowRight
        className="size-4 transition-transform group-hover:translate-x-1"
        aria-hidden="true"
      />
    </a>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <header className="absolute inset-x-0 top-0 z-50">
        <nav
          className="page-shell flex h-24 items-center justify-between"
          aria-label="Main navigation"
        >
          <a href="#top" aria-label="Futures Medialab home">
            <BrandMark />
          </a>
          <div className="hidden items-center gap-9 text-sm font-semibold text-slate-700 lg:flex">
            <a className="nav-link" href="#solutions">
              Solutions
            </a>
            <a className="nav-link" href="#platform">
              Platform
            </a>
            <a className="nav-link" href="#how-it-works">
              How it works
            </a>
            <a className="nav-link" href="#why-us">
              Why us
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="hidden items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 sm:inline-flex"
              type="button"
              aria-label="Language: English"
            >
              <Globe2 className="size-4" aria-hidden="true" />
              EN
            </button>
            <a
              className="button button-secondary hidden sm:inline-flex"
              href="#contact"
            >
              Sign in
            </a>
            <a className="button button-primary" href="#contact">
              Get started
            </a>
          </div>
        </nav>
      </header>

      <section id="top" className="hero-wrap px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="hero-panel relative mx-auto min-h-[820px] max-w-[1880px] overflow-hidden rounded-[28px] border border-indigo-100/80 sm:rounded-[40px]">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-glow hero-glow-one" aria-hidden="true" />
          <div className="hero-glow hero-glow-two" aria-hidden="true" />
          <div className="page-shell relative grid min-h-[820px] items-center gap-16 pb-20 pt-36 lg:grid-cols-[0.92fr_1.08fr] lg:pt-28">
            <div className="relative z-10 max-w-3xl">
              <div className="eyebrow">
                <Sparkles className="size-4" aria-hidden="true" />
                Creators × Agencies × Brands
              </div>
              <h1 className="mt-7 text-[clamp(3.6rem,7vw,7.4rem)] font-black leading-[0.9] tracking-[-0.075em] text-slate-950">
                Campaigns move
                <span className="hero-gradient-text block">
                  better together.
                </span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl sm:leading-9">
                Futures Medialab connects trusted creators, ambitious agencies,
                and global brands through one clear campaign workflow.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  className="button button-primary button-large"
                  href="#solutions"
                >
                  Explore the platform
                  <ArrowRight className="size-5" aria-hidden="true" />
                </a>
                <a
                  className="button button-secondary button-large"
                  href="#how-it-works"
                >
                  <Play className="size-4 fill-current" aria-hidden="true" />
                  See how it works
                </a>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-500">
                {[
                  "Clear campaign terms",
                  "Verified delivery",
                  "Transparent earnings",
                ].map((item) => (
                  <span className="flex items-center gap-2" key={item}>
                    <Check
                      className="size-4 text-indigo-600"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="relative hidden min-h-[610px] lg:block"
              aria-label="Campaign platform preview"
            >
              <div className="orbit orbit-one" aria-hidden="true" />
              <div className="orbit orbit-two" aria-hidden="true" />
              <div className="dashboard-card">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-500">
                      Offer browser
                    </p>
                    <p className="mt-1 text-lg font-extrabold tracking-tight">
                      Recommended for you
                    </p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <Layers3 className="size-5" aria-hidden="true" />
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  {platformRows.map((campaign) => (
                    <article className="campaign-row" key={campaign.name}>
                      <div
                        className={`campaign-thumbnail bg-gradient-to-br ${campaign.tone}`}
                      >
                        <Gamepad2
                          className="size-7 text-white/90"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-extrabold text-slate-900">
                          {campaign.name}
                        </h2>
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                            <MapPin className="size-3" aria-hidden="true" />
                            {campaign.region}
                          </span>
                          <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-600">
                            Gaming
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Up to
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {campaign.reward}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <div className="floating-card floating-card-top">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <BadgeCheck className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    Submission status
                  </p>
                  <p className="mt-1 text-sm font-extrabold">
                    Content approved
                  </p>
                </div>
              </div>
              <div className="floating-card floating-card-bottom">
                <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Banknote className="size-5" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-8">
                    <p className="text-xs font-semibold text-slate-500">
                      Available earnings
                    </p>
                    <span className="text-[10px] font-bold text-emerald-600">
                      +12.8%
                    </span>
                  </div>
                  <p className="mt-1 text-xl font-black">$4,280.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-white">
        <div className="page-shell grid gap-5 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["3", "partner types, one workflow"],
            ["3", "launch languages"],
            ["14-day", "performance verification"],
            ["Global", "campaign-ready operations"],
          ].map(([value, label]) => (
            <div
              className="flex items-center gap-4 border-slate-200 py-3 lg:border-r lg:last:border-r-0"
              key={label}
            >
              <strong className="text-2xl font-black tracking-tight text-indigo-700">
                {value}
              </strong>
              <span className="max-w-40 text-sm font-medium leading-5 text-slate-500">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section id="solutions" className="section-space bg-white">
        <div className="page-shell">
          <div className="section-heading mx-auto max-w-3xl text-center">
            <span className="section-kicker">One connected network</span>
            <h2>Everything each side needs to move a campaign forward.</h2>
            <p>
              Purpose-built workspaces keep opportunity discovery,
              collaboration, and settlement connected from start to finish.
            </p>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {solutions.map((solution) => {
              const Icon = solution.icon;
              return (
                <article
                  className={`solution-card group ${solution.tone}`}
                  key={solution.title}
                >
                  <div className="solution-icon">
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <p className="mt-12 text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                    {solution.eyebrow}
                  </p>
                  <h3 className="mt-4 text-3xl font-black leading-tight tracking-[-0.045em]">
                    {solution.title}
                  </h3>
                  <p className="mt-5 text-base leading-7 text-slate-600">
                    {solution.description}
                  </p>
                  <div className="mt-10">
                    <ArrowLink>{solution.cta}</ArrowLink>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="platform" className="section-space bg-slate-50/70">
        <div className="page-shell grid items-center gap-16 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="platform-visual">
            <div className="platform-window">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <span className="size-2.5 rounded-full bg-indigo-300" />
                <span className="size-2.5 rounded-full bg-blue-300" />
                <span className="size-2.5 rounded-full bg-slate-200" />
                <span className="ml-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Campaign workspace
                </span>
              </div>
              <div className="grid min-h-[470px] grid-cols-[92px_1fr]">
                <aside className="border-r border-slate-100 bg-slate-50 p-4">
                  <div className="mx-auto size-9 rounded-xl bg-indigo-600" />
                  <div className="mt-8 space-y-4">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div
                        className={`mx-auto h-2 rounded-full ${item === 2 ? "w-10 bg-indigo-300" : "w-8 bg-slate-200"}`}
                        key={item}
                      />
                    ))}
                  </div>
                </aside>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">
                        Campaign
                      </p>
                      <p className="mt-1 font-extrabold">Project Aurora</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">
                      Recruiting
                    </span>
                  </div>
                  <div className="mt-7 grid grid-cols-3 gap-3">
                    {[
                      ["Applications", "84"],
                      ["Selected", "16"],
                      ["Budget", "$24K"],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                        key={label}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {label}
                        </p>
                        <p className="mt-2 text-xl font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-extrabold">
                        Campaign progress
                      </p>
                      <p className="text-xs font-bold text-indigo-600">68%</p>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-indigo-600 to-blue-500" />
                    </div>
                    <div className="mt-6 grid grid-cols-4 gap-3">
                      {["Brief", "Matching", "Content", "Settlement"].map(
                        (stage, index) => (
                          <div key={stage}>
                            <div
                              className={`flex size-8 items-center justify-center rounded-full text-xs font-black ${index < 3 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}
                            >
                              {index + 1}
                            </div>
                            <p className="mt-2 text-[10px] font-semibold text-slate-500">
                              {stage}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-[1fr_0.8fr] gap-3">
                    <div className="rounded-2xl bg-indigo-950 p-5 text-white">
                      <BarChart3
                        className="size-5 text-indigo-300"
                        aria-hidden="true"
                      />
                      <p className="mt-6 text-2xl font-black">2.4M</p>
                      <p className="mt-1 text-xs text-indigo-200">
                        Verified reach
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                      <Clock3
                        className="size-5 text-indigo-600"
                        aria-hidden="true"
                      />
                      <p className="mt-6 text-lg font-black">12 days</p>
                      <p className="mt-1 text-xs text-slate-400">to publish</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="section-heading max-w-xl">
            <span className="section-kicker">A clearer way to collaborate</span>
            <h2>One source of truth from brief to payout.</h2>
            <p>
              Replace scattered chats, spreadsheets, and manual status checks
              with a campaign workspace everyone can understand.
            </p>
            <div className="mt-9 space-y-5">
              {collaborationFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div className="flex gap-4" key={feature.title}>
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-extrabold">{feature.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <a
              className="button button-primary button-large mt-10"
              href="#contact"
            >
              Discover the workflow
              <ChevronRight className="size-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-3 py-3 sm:px-5 sm:py-5">
        <div className="relative mx-auto max-w-[1880px] overflow-hidden rounded-[28px] bg-indigo-950 text-white sm:rounded-[40px]">
          <div className="dark-grid" aria-hidden="true" />
          <div className="page-shell relative py-24 sm:py-32">
            <div className="section-heading max-w-3xl">
              <span className="section-kicker section-kicker-dark">
                A campaign flow that stays moving
              </span>
              <h2 className="text-white">Four steps. No black boxes.</h2>
              <p className="text-indigo-200">
                Every participant sees what is expected, what comes next, and
                what has been approved.
              </p>
            </div>
            <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
              {process.map((step) => (
                <article className="process-card" key={step.number}>
                  <span className="text-xs font-black tracking-[0.18em] text-indigo-300">
                    {step.number}
                  </span>
                  <h3 className="mt-16 text-xl font-extrabold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-indigo-200">
                    {step.description}
                  </p>
                  <div className="mt-8 flex size-9 items-center justify-center rounded-full border border-white/15 text-indigo-300">
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="why-us" className="section-space bg-white">
        <div className="page-shell">
          <div className="section-heading max-w-3xl">
            <span className="section-kicker">
              Built for real campaign operations
            </span>
            <h2>Local relationships. Global ambition. Operational clarity.</h2>
          </div>
          <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((advantage) => {
              const Icon = advantage.icon;
              return (
                <article className="advantage-card" key={advantage.title}>
                  <div className="advantage-icon">
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="mt-7 text-lg font-extrabold tracking-tight">
                    {advantage.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {advantage.description}
                  </p>
                </article>
              );
            })}
          </div>
          <div className="mt-24 border-y border-slate-100 py-10">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">
              Campaign-ready across the categories creators know best
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-lg font-black tracking-tight text-slate-300 sm:text-xl">
              {[
                "GAMING",
                "ENTERTAINMENT",
                "TECHNOLOGY",
                "LIFESTYLE",
                "COMMERCE",
                "MOBILE",
              ].map((category) => (
                <span key={category}>{category}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="cta-panel relative mx-auto max-w-[1880px] overflow-hidden rounded-[28px] sm:rounded-[40px]">
          <div className="cta-orb" aria-hidden="true" />
          <div className="page-shell relative flex flex-col items-start justify-between gap-10 py-20 sm:py-24 lg:flex-row lg:items-end">
            <div className="max-w-4xl">
              <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-200">
                <Languages className="size-4" aria-hidden="true" />
                English · 한국어 · 中文
              </span>
              <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-0.055em] text-white sm:text-6xl">
                Ready to move your next campaign forward?
              </h2>
            </div>
            <a
              className="button button-white button-large shrink-0"
              href="mailto:hello@futuresmedialab.com"
            >
              Talk to our team
              <ArrowRight className="size-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 text-white">
        <div className="page-shell grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <BrandMark inverted />
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
              The creator campaign platform connecting talent, agencies, and
              brands through one trusted workflow.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
              Platform
            </h3>
            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <a className="block hover:text-white" href="#solutions">
                For creators
              </a>
              <a className="block hover:text-white" href="#solutions">
                For agencies
              </a>
              <a className="block hover:text-white" href="#solutions">
                For brands
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
              Contact
            </h3>
            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <a
                className="block hover:text-white"
                href="mailto:hello@futuresmedialab.com"
              >
                hello@futuresmedialab.com
              </a>
              <p>Seoul, Republic of Korea</p>
            </div>
          </div>
        </div>
        <div className="page-shell flex flex-col gap-3 border-t border-white/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Futures Medialab. All rights reserved.</p>
          <div className="flex gap-5">
            <a className="hover:text-white" href="#">
              Terms
            </a>
            <a className="hover:text-white" href="#">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
