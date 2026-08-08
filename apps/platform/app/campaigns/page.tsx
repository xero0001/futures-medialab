import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownUp,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  CircleUserRound,
  ClipboardCheck,
  Gamepad2,
  Globe2,
  Grid2X2,
  HandCoins,
  Headphones,
  LayoutDashboard,
  List,
  MapPin,
  Megaphone,
  MonitorSmartphone,
  Palette,
  Plane,
  Search,
  Settings2,
  Sparkles,
  Users2,
  WalletCards,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Campaign Marketplace | Futures Medialab",
  description:
    "Discover creator campaigns across gaming, entertainment, technology, and lifestyle.",
};

type Campaign = {
  name: string;
  brand: string;
  deadline: string;
  region: string;
  followers: string;
  categories: string[];
  payout: string;
  icon: LucideIcon;
  artwork: string;
  priority?: boolean;
};

const campaigns: Campaign[] = [
  {
    name: "Etheria: Restart Global Creator Quest",
    brand: "XD Entertainment",
    deadline: "Aug 31, 2026",
    region: "KR / JP / SEA",
    followers: "1K+",
    categories: ["Gaming", "Entertainment"],
    payout: "$2,500",
    icon: Sparkles,
    artwork: "campaign-art-aurora",
    priority: true,
  },
  {
    name: "Project Mugen First Look",
    brand: "Naked Rain",
    deadline: "Sep 04, 2026",
    region: "Global",
    followers: "10K+",
    categories: ["Gaming", "Anime"],
    payout: "$1,800",
    icon: Gamepad2,
    artwork: "campaign-art-neon",
    priority: true,
  },
  {
    name: "Ragnarok: The New World",
    brand: "Gravity Interactive",
    deadline: "Aug 16, 2026",
    region: "SEA",
    followers: "1K – 10M",
    categories: ["Gaming", "UGC"],
    payout: "$2,000",
    icon: Gamepad2,
    artwork: "campaign-art-sky",
    priority: true,
  },
  {
    name: "Tripmate: Stories That Move",
    brand: "Tripmate",
    deadline: "Aug 31, 2026",
    region: "US / CA / MX",
    followers: "100K+",
    categories: ["Travel", "Lifestyle"],
    payout: "$1,250",
    icon: Plane,
    artwork: "campaign-art-travel",
  },
  {
    name: "Creator Lab: Dream Desk Setup",
    brand: "Creator Lab",
    deadline: "Sep 01, 2026",
    region: "US / CA",
    followers: "10K+",
    categories: ["Technology", "Lifestyle"],
    payout: "$750",
    icon: MonitorSmartphone,
    artwork: "campaign-art-tech",
  },
  {
    name: "Maison Art: Everyday Creativity",
    brand: "Maison Art",
    deadline: "Aug 31, 2026",
    region: "US",
    followers: "10K+",
    categories: ["Art", "Daily Life"],
    payout: "$600",
    icon: Palette,
    artwork: "campaign-art-studio",
  },
  {
    name: "Blockees Collector Challenge",
    brand: "Blockees",
    deadline: "Aug 21, 2026",
    region: "PH / MY / ID",
    followers: "100K+",
    categories: ["Entertainment", "Collectibles"],
    payout: "$950",
    icon: BriefcaseBusiness,
    artwork: "campaign-art-blocks",
  },
  {
    name: "Duet: Better Together",
    brand: "Duet Social",
    deadline: "Sep 30, 2026",
    region: "US / UK",
    followers: "1K+",
    categories: ["Entertainment", "Social"],
    payout: "$500",
    icon: Users2,
    artwork: "campaign-art-duet",
  },
];

const sidebarGroups: Array<{
  label?: string;
  items: Array<{ label: string; icon: LucideIcon; active?: boolean }>;
}> = [
  {
    items: [{ label: "Campaign Browser", icon: LayoutDashboard, active: true }],
  },
  {
    label: "COLLABORATION",
    items: [
      { label: "My applications", icon: ClipboardCheck },
      { label: "Active projects", icon: BriefcaseBusiness },
    ],
  },
  {
    label: "CREATOR NETWORK",
    items: [
      { label: "My creators", icon: Users2 },
      { label: "Invitations", icon: Megaphone },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { label: "Payments", icon: WalletCards },
      { label: "Earnings", icon: CircleDollarSign },
    ],
  },
];

const filters = [
  "Platform",
  "Country / Region",
  "Category",
  "Followers",
  "Budget",
];

function BrandMark() {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span className="text-[17px] font-extrabold tracking-[-0.04em] text-slate-950">
        Futures Medialab
      </span>
    </span>
  );
}

function FilterSelect({ label }: { label: string }) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">Filter by {label}</span>
      <select
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-9 text-sm font-semibold text-slate-500 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        defaultValue=""
      >
        <option value="">{label}</option>
        <option>All</option>
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-3.5 size-4 text-slate-400"
        aria-hidden="true"
      />
    </label>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const Icon = campaign.icon;

  return (
    <article className="campaign-market-card group">
      <div className={`campaign-art ${campaign.artwork}`}>
        <div className="campaign-art-grid" aria-hidden="true" />
        <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/70 px-2.5 py-1.5 text-[11px] font-extrabold text-white backdrop-blur-md">
          <CalendarDays
            className="size-3.5 text-indigo-200"
            aria-hidden="true"
          />
          {campaign.deadline}
        </div>
        {campaign.priority ? (
          <span className="campaign-priority">Priority</span>
        ) : null}
        <div className="campaign-art-icon">
          <Icon className="size-9" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <div className="relative z-[1] mt-auto">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/65">
            Creator campaign
          </p>
          <p className="mt-1 text-xl font-black tracking-[-0.04em] text-white">
            {campaign.brand}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-bold text-indigo-600">
          {campaign.brand}
        </p>
        <h2 className="mt-1.5 line-clamp-2 min-h-12 text-[16px] font-extrabold leading-6 tracking-[-0.025em] text-slate-950">
          {campaign.name}
        </h2>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="campaign-meta-pill">
            <Users2 className="size-3" aria-hidden="true" />
            {campaign.followers}
          </span>
          <span className="campaign-meta-pill">
            <MapPin className="size-3" aria-hidden="true" />
            {campaign.region}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {campaign.categories.map((category) => (
            <span
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500"
              key={category}
            >
              {category}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Earn up to
            </p>
            <p className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-slate-950">
              {campaign.payout}
            </p>
          </div>
          <button
            className="flex size-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition group-hover:-translate-y-1 group-hover:bg-indigo-700"
            type="button"
            aria-label={`View ${campaign.name}`}
          >
            <HandCoins className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function CampaignsPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="sticky top-0 z-50 flex h-[72px] items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex w-full items-center justify-between gap-6">
          <Link href="/" aria-label="Futures Medialab home">
            <BrandMark />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <label className="relative hidden lg:block">
              <span className="sr-only">Search campaigns</span>
              <Search
                className="absolute left-3.5 top-3 size-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                placeholder="Search campaigns"
              />
            </label>
            <button
              className="relative flex size-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700"
              type="button"
              aria-label="Notifications"
            >
              <Bell className="size-[18px]" aria-hidden="true" />
              <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-indigo-500" />
            </button>
            <button
              className="hidden h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 sm:flex"
              type="button"
            >
              <Globe2 className="size-4" aria-hidden="true" />
              English
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </button>
            <button
              className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700 ring-4 ring-white"
              type="button"
              aria-label="Account menu"
            >
              <CircleUserRound className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="campaign-app-layout">
        <aside className="campaign-sidebar">
          <nav className="flex h-full flex-col" aria-label="Campaign workspace">
            <div className="space-y-7">
              {sidebarGroups.map((group, groupIndex) => (
                <div key={group.label ?? groupIndex}>
                  {group.label ? (
                    <p className="px-3 text-[10px] font-extrabold tracking-[0.16em] text-slate-400">
                      {group.label}
                    </p>
                  ) : null}
                  <div className={group.label ? "mt-2 space-y-1" : "space-y-1"}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          className={`campaign-sidebar-item ${item.active ? "campaign-sidebar-item-active" : ""}`}
                          type="button"
                          key={item.label}
                        >
                          <Icon className="size-[18px]" aria-hidden="true" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto border-t border-slate-100 pt-4">
              <button className="campaign-sidebar-item" type="button">
                <Building2 className="size-[18px]" aria-hidden="true" />
                <span>Organization</span>
              </button>
              <button className="campaign-sidebar-item" type="button">
                <Headphones className="size-[18px]" aria-hidden="true" />
                <span>Help center</span>
              </button>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1560px]">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600">
                  <Sparkles className="size-4" aria-hidden="true" />
                  Opportunity marketplace
                </div>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                  Campaign Browser
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Discover verified campaigns matched to your audience.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
                  type="button"
                >
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                  Track submissions
                </button>
                <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  <button
                    className="flex size-8 items-center justify-center rounded-lg text-slate-400"
                    type="button"
                    aria-label="List view"
                  >
                    <List className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"
                    type="button"
                    aria-label="Board view"
                  >
                    <Grid2X2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            <section
              className="mt-7 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm"
              aria-label="Campaign filters"
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-[150px_repeat(5,minmax(130px,1fr))_180px]">
                <button
                  className="inline-flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-500 transition hover:border-indigo-300"
                  type="button"
                >
                  Newest
                  <ArrowDownUp className="size-4" aria-hidden="true" />
                </button>
                {filters.map((filter) => (
                  <FilterSelect label={filter} key={filter} />
                ))}
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-indigo-700"
                  type="button"
                >
                  <CalendarDays className="size-4" aria-hidden="true" />
                  Any deadline
                </button>
              </div>
            </section>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-500">
                <span className="font-black text-slate-950">128</span> active
                campaigns
              </p>
              <button
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 lg:hidden"
                type="button"
              >
                <Settings2 className="size-4" aria-hidden="true" />
                More filters
              </button>
            </div>

            <section className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {campaigns.map((campaign) => (
                <CampaignCard campaign={campaign} key={campaign.name} />
              ))}
            </section>

            <div className="mt-10 flex justify-center">
              <button
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
                type="button"
              >
                Load more campaigns
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
