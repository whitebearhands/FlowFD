"use client";

import Link from "next/link";
import { useState } from "react";
import AnalyticsTracker from "./components/AnalyticsTracker";
import { useAuth } from "@/lib/firebase/useAuth";
import { useTranslations } from "next-intl";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// ── Sample data (from /public/samples/*.json) ─────────────────────────────
const SAMPLE_CPS = {
  version: "1.5.0",
  context: {
    background:
      "RetailMax, mid-market e-commerce (2M MAU). Shopify storefront, custom PostgreSQL OMS (AWS RDS), Salesforce Sales Cloud Enterprise — all disconnected.",
    environment:
      "AWS RDS PostgreSQL 14 (~50M records), AWS ECS. Team: 3 backend engineers, no Kafka/K8s allowed.",
    stakeholders:
      "Sarah Kim (CTO), David Park (Head of Data), James Lee (DevOps), Monica Choi (Sales Ops), Alex (FDE)",
    constraints:
      "6-week delivery. Shopify read-only (vendor contract). RDS logical replication blocked until AWS account owner returns Apr 21.",
  },
  problem: {
    businessProblem:
      "Sales and marketing teams have no real-time B2B order data in Salesforce. CRM profiles are stale, forecasting is inaccurate, high-value accounts go unnoticed.",
    technicalProblem:
      "PostgreSQL RDS lacks logical replication (blocked by single AWS account owner). Salesforce Bulk API v2 rate limits constrain the 3M-record backfill.",
    impact:
      "Each day of delay = missed B2B revenue opportunities and continued stale data for the sales team during upcoming marketing pushes.",
    rootCause: {
      content:
        "Single-point-of-failure: AWS account owner approval required to enable logical replication. No IaC governance compounds the bottleneck.",
      confidence: "confirmed" as const,
    },
  },
  solution: {
    proposedByClient:
      "One-time 12-month historical backfill (~3M rows) on a Sunday maintenance window. Manual DLQ review with Slack alert after 5 consecutive failures per account.",
    proposedByFde:
      "Event-driven CDC: Debezium Standalone on ECS reads PostgreSQL WAL → AWS SQS → Order Sync Service (ECS) → Salesforce Bulk API v2. No Kafka, no K8s.",
    hypothesis: {
      content:
        "Decoupling CDC (Debezium) from ingestion (Sync Service) via SQS will achieve <5 min E2E latency within Salesforce's rate limits, provided backfill is throttled and RDS overhead stays below 10%.",
      confidence: "probable" as const,
    },
    successCriteria:
      "1. B2B_Order_Total__c + Last_Order_Date__c synced for all active accounts. 2. <5 min E2E latency. 3. 3M records backfilled in 3 hours. 4. Zero production DB outages.",
  },
};

const SAMPLE_PRD_FEATURES = [
  {
    id: "FR-CDC-001",
    priority: "Must" as const,
    title: "Real-time CDC via Debezium",
    desc: "Capture INSERT/UPDATE events from PostgreSQL WAL on ECS. Stream to AWS SQS. Replication overhead <10% of RDS capacity.",
  },
  {
    id: "FR-SYN-002",
    priority: "Must" as const,
    title: "Salesforce Metric Sync Service",
    desc: "ECS service consumes SQS events, updates B2B_Order_Total__c and Last_Order_Date__c in Salesforce. <5 min E2E latency.",
  },
  {
    id: "FR-BKF-004",
    priority: "Must" as const,
    title: "Historical Backfill Engine",
    desc: "Process 3M records in a 3-hour Sunday window via Salesforce Bulk API v2. Throttled to avoid 429 rate-limit errors.",
  },
  {
    id: "FR-ERR-006",
    priority: "Must" as const,
    title: "Dead Letter Queue (DLQ)",
    desc: "Route failed sync records to SQS DLQ with full error metadata for manual review by the lean Sales Ops team.",
  },
  {
    id: "FR-ALT-007",
    priority: "Should" as const,
    title: "Intelligent Slack Alerting",
    desc: "Trigger Slack notifications only after 5 consecutive failures for the same Salesforce Account ID. Minimize alert fatigue.",
  },
  {
    id: "FR-MON-008",
    priority: "Should" as const,
    title: "CloudWatch Monitoring",
    desc: "Dashboards tracking SQS Queue Depth and Debezium Replication Lag to ensure <5 min SLA compliance.",
  },
];

const SAMPLE_ARCH_FLOW = [
  { name: "PostgreSQL RDS", type: "Database", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { name: "Debezium CDC", type: "Worker · ECS", color: "bg-green-100 text-green-700 border-green-200" },
  { name: "Amazon SQS", type: "Message Queue", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { name: "Sync Service", type: "Microservice · ECS", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { name: "Salesforce CRM", type: "SaaS Target", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
];

const SAMPLE_ARCH_TECH = [
  { key: "Backend", val: "Java 17 + Spring Boot" },
  { key: "CDC Engine", val: "Debezium (ECS Fargate)" },
  { key: "Messaging", val: "Amazon SQS (FIFO)" },
  { key: "Cache", val: "ElastiCache (Redis)" },
  { key: "IaC", val: "Terraform" },
  { key: "Monitoring", val: "CloudWatch + Grafana" },
];

// ── Static content ────────────────────────────────────────────────────────
const painItems = [
  {
    stat: "40–60%",
    title: "of time lost to admin",
    desc: "Top FDEs spend nearly half their day on meeting notes, status reports, and documentation. Actual engineering gets what's left.",
  },
  {
    stat: "3–5 days",
    title: "from meeting to PRD",
    desc: "Gathering context, structuring findings, writing, reviewing — it takes days. By then, the client has already moved on.",
  },
  {
    stat: "N projects",
    title: "colliding in your head",
    desc: "More customers means more context switching. Was that architecture decision for customer A or B? Nobody remembers.",
  },
];

const steps = [
  {
    num: "01",
    title: "Paste your meeting notes",
    desc: "Rough transcripts, bullet points, voice-to-text output — FlowFD accepts any format. Add as many entries per session as you need.",
    tags: ["Markdown editor", "File upload", "Any format"],
  },
  {
    num: "02",
    title: "CPS is generated in minutes",
    desc: "A structured Context–Problem–Solution document appears in under 5 minutes. Every new meeting triggers a smart review — only changed fields are rewritten.",
    tags: ["23 AI agents", "Version history", "Decision log"],
  },
  {
    num: "03",
    title: "PRD and architecture follow",
    desc: "PRD is drafted from your CPS. System architecture, API specs, and dev planning are generated next. Everything stays consistent with your project.",
    tags: ["PRD", "System architecture", "API spec", "Data model"],
  },
  {
    num: "04",
    title: "Sync to GitHub when you're ready",
    desc: "All docs land in a structured GitHub repo. Review the diff, write a commit message, and push — you stay in control.",
    tags: ["Human-in-the-loop", "Diff preview", "One-click sync"],
  },
];

const features = [
  { title: "CPS Framework", desc: "The Context–Problem–Solution format used by the best FDE teams. Structured, versioned, and always current after every meeting." },
  { title: "Smart Auto-Update", desc: "Add a new meeting and only the relevant fields change. No full rewrites. No lost context from previous sessions." },
  { title: "Full Project Isolation", desc: "Every customer gets its own context. No bleed, no confusion — even when you're juggling 10 projects at once." },
  { title: "Any LLM, Same Output", desc: "Gemini, Claude, GPT — the pipeline enforces consistent structure regardless of which model runs the analysis." },
  { title: "Human-in-the-Loop", desc: "Critical decisions are yours. FlowFD automates the tedious parts, but you control every GitHub push and every CPS edit." },
  { title: "GitHub Integration", desc: "One-click sync to a structured repo. Review diffs before pushing — every time, no surprises." },
];

const creditItems = [
  { action: "Meeting + CPS (smart)", credits: "5" },
  { action: "Meeting + CPS (full re-analysis)", credits: "8" },
  { action: "PRD generation", credits: "10" },
  { action: "Architecture design", credits: "15" },
  { action: "Full pipeline", credits: "30" },
];

const faqs = [
  { q: "What is a Forward Deployed Engineer?", a: "An FDE (Forward Deployed Engineer) is an engineer embedded directly at a customer's site — responsible for building solutions tailored to that customer's needs. They handle the full cycle from understanding the problem to delivering working code." },
  { q: "What is CPS?", a: "CPS stands for Context–Problem–Solution — a structured document that captures the customer's environment, the problems they face, and proposed solutions. FlowFD generates and maintains CPS documents automatically from your meeting notes." },
  { q: "What are credits?", a: "Credits are consumed when running the AI pipeline. CPS analysis costs 5–8 credits, PRD generation 10 credits, architecture design 15 credits. The demo plan includes 100 free credits to get started." },
  { q: "Is my meeting data private?", a: "Meeting content is processed via the Gemini API for AI analysis. Each user's data is fully isolated in Firestore. We do not share or use your data for model training." },
];

// ── Confidence badge (mirrors real app) ──────────────────────────────────
const confidenceStyle = {
  suspected: "bg-yellow-100 text-yellow-700",
  probable: "bg-blue-100 text-blue-600",
  confirmed: "bg-green-100 text-green-700",
} as const;

function ConfidenceBadge({ confidence }: { confidence: "suspected" | "probable" | "confirmed" }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${confidenceStyle[confidence]}`}>
      {confidence}
    </span>
  );
}

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const t = useTranslations("landing.nav");
  const [activeTab, setActiveTab] = useState(0);

  if (isLoading) return null;

  return (
    <div className="bg-white text-gray-900 min-h-screen">
      <AnalyticsTracker />

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 lg:px-12 py-4 flex items-center justify-between">
          <div className="text-[22px] font-bold tracking-tight">
            Flow<span className="text-[#1D9E75]">FD</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-[14px] font-medium text-gray-600 hover:text-gray-900 transition-colors">How it works</a>
            <a href="#pricing" className="text-[14px] font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href={`${APP_URL}/dashboard`} className="px-5 py-2.5 rounded-lg bg-[#1D9E75] text-white text-[14px] font-semibold hover:bg-[#0F6E56] transition-colors">
                {t("dashboard")}
              </Link>
            ) : (
              <>
                <Link href={`${APP_URL}/login`} className="text-[14px] font-medium text-gray-700 hover:text-gray-900 px-4 py-2 transition-colors">{t("login")}</Link>
                <Link href={`${APP_URL}/register`} className="px-5 py-2.5 rounded-lg bg-[#1D9E75] text-white text-[14px] font-semibold hover:bg-[#0F6E56] transition-colors">{t("start")}</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-8 lg:px-12">        
        <div className="max-w-4xl mx-auto text-center mb-14">          
          <p>
          <img src="/ffd-transparent.png" alt="FlowFD Logo" className="inline-block mr-6" width={600} /> 
          </p>
          <div className="inline-flex mt-6 items-center gap-2 px-4 py-2 rounded-full border border-[#1D9E75]/30 bg-[#1D9E75]/[0.06] text-[13px] text-[#1D9E75] font-semibold mb-8">
            <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />
            Built for Forward Deployed Engineers
          </div>
          <h1 className="text-[58px] lg:text-[78px] font-bold leading-[1.0] tracking-[-3px] text-gray-900 mb-7">
            Meeting notes in.
            <br />
            <span className="text-[#1D9E75]">Dev-ready specs</span> out.
          </h1>
          <p className="text-[20px] text-gray-600 leading-relaxed mb-10 max-w-[560px] mx-auto">
            FlowFD turns your customer meeting notes into CPS, PRD, and architecture — automatically. Stop writing docs. Start building.
          </p>
          <div className="flex items-center justify-center gap-3 mb-16">
            {user ? (
              <Link href={`${APP_URL}/dashboard`} className="px-10 py-4 rounded-xl bg-[#1D9E75] text-white text-[16px] font-semibold hover:bg-[#0F6E56] transition-colors shadow-sm">
                {t("dashboard")}
              </Link>
            ) : (
              <>
                <Link href={`${APP_URL}/register`} className="px-10 py-4 rounded-xl bg-[#1D9E75] text-white text-[16px] font-semibold hover:bg-[#0F6E56] transition-colors shadow-sm">
                  Start free — no card needed
                </Link>
                <a href="#how-it-works" className="px-10 py-4 rounded-xl border border-gray-300 text-gray-700 text-[16px] font-medium hover:border-gray-400 transition-colors">
                  See how it works
                </a>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12 py-8 border-t border-b border-gray-100">
            <div className="text-center">
              <div className="text-[38px] font-bold text-gray-900 leading-none">5<span className="text-[18px] text-[#1D9E75] ml-1">min</span></div>
              <div className="text-[12px] text-gray-500 font-medium mt-2">Meeting → CPS</div>
            </div>
            <div className="hidden lg:block w-px h-10 bg-gray-200" />
            <div className="text-center">
              <div className="text-[38px] font-bold text-gray-900 leading-none">23</div>
              <div className="text-[12px] text-gray-500 font-medium mt-2">AI agents in pipeline</div>
            </div>
            <div className="hidden lg:block w-px h-10 bg-gray-200" />
            <div className="text-center">
              <div className="text-[38px] font-bold text-gray-900 leading-none">3</div>
              <div className="text-[12px] text-gray-500 font-medium mt-2">Docs auto-generated</div>
            </div>
            <div className="hidden lg:block w-px h-10 bg-gray-200" />
            <div className="text-center">
              <div className="text-[38px] font-bold text-gray-900 leading-none">800<span className="text-[#1D9E75]">%</span></div>
              <div className="text-[12px] text-gray-500 font-medium mt-2">FDE hiring growth (2025)</div>
            </div>
          </div>
        </div>

        {/* App mockup — real meeting data */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-gray-950 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800 bg-gray-900">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-[12px] text-gray-500 font-mono">FlowFD · RetailMax · B2B Order Sync</span>
            </div>
            <div className="grid md:grid-cols-2 min-h-[300px]">
              {/* Meeting notes */}
              <div className="p-6 border-r border-gray-800">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.12em] mb-1">Meeting Notes · 2026-04-01</div>
                <div className="text-[10px] text-gray-600 mb-3 font-mono">Alex (FDE), Sarah Kim (CTO), David Park (Head of Data)</div>
                <div className="font-mono text-[12px] leading-relaxed space-y-1.5">
                  <div className="text-gray-400">RetailMax: 2M MAU, 3 disconnected systems —</div>
                  <div className="text-gray-400">Shopify, PostgreSQL OMS, Salesforce CRM.</div>
                  <div className="text-yellow-400/90 mt-2">→ Marketing: zero visibility on B2B orders.</div>
                  <div className="text-gray-400">Manual CSV export, once a week. Always stale.</div>
                  <div className="text-red-400/80 mt-2">→ Previous Airflow ETL: collapsed on Black Friday.</div>
                  <div className="text-red-400/80">  Nobody trusts the output anymore.</div>
                  <div className="text-gray-300 mt-2">Ask: real-time OMS → Salesforce for B2B.</div>
                  <div className="text-gray-500">  Timeline: something working in 6 weeks.</div>
                </div>
              </div>
              {/* CPS output */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.12em]">CPS auto-generated</div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-[#1D9E75]/20 text-[#1D9E75] font-semibold">v1.0.0</span>
                </div>
                <div className="space-y-3.5 text-[12px]">
                  <div>
                    <div className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider mb-1">Context</div>
                    <div className="text-gray-300">Mid-market e-commerce (2M MAU) · Shopify + PostgreSQL OMS (AWS RDS) + Salesforce CRM — all disconnected</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Problem</div>
                    <div className="text-gray-300">No real-time B2B order data in Salesforce</div>
                    <div className="text-gray-500 text-[11px] mt-0.5">Root cause: no real-time integration, manual sync only <span className="text-orange-400/70">(suspected)</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Solution</div>
                    <div className="text-gray-300">PostgreSQL WAL → Debezium (ECS) → SQS → Sync Service → Salesforce Bulk API v2</div>
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">probable</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="text-[10px] text-gray-600 mb-2">Pipeline status:</div>
                  <div className="flex gap-1.5">
                    <span className="text-[11px] px-2 py-1 rounded bg-[#1D9E75]/20 text-[#1D9E75]">CPS ✓</span>
                    <span className="text-[11px] px-2 py-1 rounded bg-gray-800 text-gray-400">PRD →</span>
                    <span className="text-[11px] px-2 py-1 rounded bg-gray-800 text-gray-400">Design →</span>
                    <span className="text-[11px] px-2 py-1 rounded bg-gray-800 text-gray-400">GitHub →</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="h-px bg-gray-200" />

      {/* ── Problem ── */}
      <section className="py-24 px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="text-[13px] font-bold tracking-[0.1em] text-[#1D9E75] uppercase mb-4">The problem</div>
        <h2 className="text-[40px] lg:text-[52px] font-bold text-gray-900 leading-tight mb-4 tracking-tight">
          You became an engineer to build,<br />not to write meeting notes.
        </h2>
        <p className="text-[18px] text-gray-600 leading-relaxed max-w-[520px] mb-14">
          FDEs are the most capable engineers on the team. But the job buries them in admin.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {painItems.map((item, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-2xl p-8 hover:border-[#1D9E75]/30 transition-colors">
              <div className="text-[40px] font-bold text-[#1D9E75] leading-none">{item.stat}</div>
              <div className="text-[16px] font-bold text-gray-900 mt-4 mb-3">{item.title}</div>
              <div className="text-[14px] text-gray-600 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-gray-200" />

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="text-[13px] font-bold tracking-[0.1em] text-[#1D9E75] uppercase mb-4">How it works</div>
        <h2 className="text-[40px] lg:text-[52px] font-bold text-gray-900 leading-tight mb-4 tracking-tight">Paste notes. Done.</h2>
        <p className="text-[18px] text-gray-600 leading-relaxed max-w-[500px] mb-14">
          The entire pipeline from meeting to GitHub runs automatically. You only touch it when you want to.
        </p>
        <div className="space-y-5">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-6 items-start group">
              <div className="w-14 h-14 rounded-2xl border-2 border-[#1D9E75]/20 bg-white flex items-center justify-center text-[15px] font-bold text-[#1D9E75] flex-shrink-0 group-hover:border-[#1D9E75]/50 group-hover:bg-[#1D9E75]/[0.04] transition-colors">
                {step.num}
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-7 group-hover:border-[#1D9E75]/20 transition-colors">
                <div className="text-[19px] font-bold text-gray-900 mb-2">{step.title}</div>
                <div className="text-[15px] text-gray-600 leading-relaxed mb-4">{step.desc}</div>
                <div className="flex flex-wrap gap-2">
                  {step.tags.map((tag, j) => (
                    <span key={j} className="px-3 py-1 rounded-full text-[12px] bg-[#1D9E75]/[0.07] text-[#1D9E75] border border-[#1D9E75]/20 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-gray-200" />

      {/* ── Output showcase ── */}
      <section className="py-24 px-8 lg:px-12 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-[13px] font-bold tracking-[0.1em] text-[#1D9E75] uppercase mb-4">What FlowFD produces</div>
          <h2 className="text-[40px] lg:text-[52px] font-bold text-gray-900 leading-tight mb-4 tracking-tight">
            Real output, not summaries.
          </h2>
          <div>
            <p className="text-[18px] text-gray-600 leading-relaxed max-w-[500px] mb-12">
              Every document is structured, versioned, and ready to use. Not just a summary — a living spec.
            </p>
            <p className="text-[18px] text-gray-600 leading-relaxed mb-12">
              You can see sample project your dashboard after signing up, but here’s a sneak peek of the actual CPS document generated from a real customer meeting. This is the kind of output you get with FlowFD — not vague summaries, but structured, detailed specs ready for action.
            </p>
          </div>


          <div className="flex gap-2 mb-5">
            {["CPS Document", "PRD", "Architecture"].map((tab, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`px-5 py-2.5 rounded-lg text-[14px] font-semibold transition-colors ${
                  activeTab === i
                    ? "bg-[#1D9E75] text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-[#1D9E75]/40 hover:text-gray-900"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

            {/* ── CPS Tab ── mirrors CpsViewer */}
            {activeTab === 0 && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-[16px] font-bold text-gray-900">RetailMax · B2B Order Sync</h3>
                    <p className="text-[12px] text-gray-400 mt-0.5">Context–Problem–Solution · 3 meetings analyzed</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] bg-[#1D9E75]/[0.1] text-[#1D9E75] border border-[#1D9E75]/20 font-semibold">
                    v{SAMPLE_CPS.version} · auto
                  </span>
                </div>

                <div className="space-y-2">
                  {/* CONTEXT */}
                  <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-green-500 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700 shrink-0">CONTEXT</span>
                      <span className="text-sm font-medium text-zinc-700 flex-1">Project Context</span>
                      <svg className="w-4 h-4 text-zinc-400 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    <div className="px-4 pb-3 grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                      {[
                        { label: "Background", val: SAMPLE_CPS.context.background },
                        { label: "Environment", val: SAMPLE_CPS.context.environment },
                        { label: "Stakeholders", val: SAMPLE_CPS.context.stakeholders },
                        { label: "Constraints", val: SAMPLE_CPS.context.constraints },
                      ].map(({ label, val }) => (
                        <div key={label} className="py-2.5 border-b border-zinc-50 last:border-0">
                          <p className="text-xs font-medium text-zinc-400 mb-0.5">{label}</p>
                          <p className="text-sm text-zinc-700">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PROBLEM */}
                  <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-orange-500 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700 shrink-0">PROBLEM</span>
                      <span className="text-sm font-medium text-zinc-700 flex-1">Problem Definition</span>
                      <svg className="w-4 h-4 text-zinc-400 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    <div className="px-4 pb-3 grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                      <div className="py-2.5 border-b border-zinc-50">
                        <p className="text-xs font-medium text-zinc-400 mb-0.5">Business Problem</p>
                        <p className="text-sm text-zinc-700">{SAMPLE_CPS.problem.businessProblem}</p>
                      </div>
                      <div className="py-2.5 border-b border-zinc-50">
                        <p className="text-xs font-medium text-zinc-400 mb-0.5">Technical Problem</p>
                        <p className="text-sm text-zinc-700">{SAMPLE_CPS.problem.technicalProblem}</p>
                      </div>
                      <div className="py-2.5 border-b border-zinc-50">
                        <p className="text-xs font-medium text-zinc-400 mb-0.5">Impact</p>
                        <p className="text-sm text-zinc-700">{SAMPLE_CPS.problem.impact}</p>
                      </div>
                      <div className="py-2.5">
                        <p className="text-xs font-medium text-zinc-400 mb-0.5">Root Cause</p>
                        <div className="flex items-start gap-2">
                          <p className="text-sm text-zinc-700 flex-1">{SAMPLE_CPS.problem.rootCause.content}</p>
                          <ConfidenceBadge confidence={SAMPLE_CPS.problem.rootCause.confidence} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SOLUTION */}
                  <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-purple-500 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 shrink-0">SOLUTION</span>
                      <span className="text-sm font-medium text-zinc-700 flex-1">Proposed Solution</span>
                      <svg className="w-4 h-4 text-zinc-400 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    <div className="px-4 pb-3 grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                      <div className="py-2.5 border-b border-zinc-50">
                        <p className="text-xs font-medium text-zinc-400 mb-0.5">Proposed by Client</p>
                        <p className="text-sm text-zinc-700">{SAMPLE_CPS.solution.proposedByClient}</p>
                      </div>
                      <div className="py-2.5 border-b border-zinc-50">
                        <p className="text-xs font-medium text-zinc-400 mb-0.5">Proposed by FDE</p>
                        <p className="text-sm text-zinc-700">{SAMPLE_CPS.solution.proposedByFde}</p>
                      </div>
                      <div className="py-2.5 border-b border-zinc-50">
                        <p className="text-xs font-medium text-zinc-400 mb-0.5">Hypothesis</p>
                        <div className="flex items-start gap-2">
                          <p className="text-sm text-zinc-700 flex-1">{SAMPLE_CPS.solution.hypothesis.content}</p>
                          <ConfidenceBadge confidence={SAMPLE_CPS.solution.hypothesis.confidence} />
                        </div>
                      </div>
                      <div className="py-2.5">
                        <p className="text-xs font-medium text-zinc-400 mb-0.5">Success Criteria</p>
                        <p className="text-sm text-zinc-700">{SAMPLE_CPS.solution.successCriteria}</p>
                      </div>
                    </div>
                  </div>

                  {/* Collapsed sections hint */}
                  <div className="flex gap-2">
                    {[
                      { key: "ASSUMPTIONS", color: "border-l-blue-400", bg: "bg-blue-100", text: "text-blue-700", hint: "2 items" },
                      { key: "RISKS", color: "border-l-red-400", bg: "bg-red-100", text: "text-red-700", hint: "3 technical, 3 business" },
                      { key: "PENDING", color: "border-l-zinc-400", bg: "bg-zinc-100", text: "text-zinc-600", hint: "2 questions, 1 insight" },
                    ].map((s) => (
                      <div key={s.key} className={`flex-1 rounded-lg border border-gray-200 border-l-4 ${s.color} px-4 py-2.5 flex items-center gap-3 opacity-60`}>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${s.bg} ${s.text} shrink-0`}>{s.key}</span>
                        <span className="text-xs text-zinc-500">{s.hint}</span>
                        <svg className="w-3.5 h-3.5 text-zinc-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── PRD Tab ── mirrors PRD kanban */}
            {activeTab === 1 && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-[16px] font-bold text-gray-900">Product Requirements Document</h3>
                    <p className="text-[12px] text-gray-400 mt-0.5">Based on CPS v{SAMPLE_CPS.version} · {SAMPLE_PRD_FEATURES.length} features</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] bg-[#1D9E75]/[0.1] text-[#1D9E75] border border-[#1D9E75]/20 font-semibold">
                    v1.0.0 · auto
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Must */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                      <span className="text-xs font-bold text-red-700">Must</span>
                      <span className="text-[11px] text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full font-semibold">
                        {SAMPLE_PRD_FEATURES.filter((f) => f.priority === "Must").length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {SAMPLE_PRD_FEATURES.filter((f) => f.priority === "Must").map((fr) => (
                        <div key={fr.id} className="border border-gray-200 rounded-xl p-3.5 hover:border-red-200 transition-colors bg-white">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-mono text-gray-400">{fr.id}</span>
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Must</span>
                          </div>
                          <div className="text-[13px] font-semibold text-gray-900 mb-1">{fr.title}</div>
                          <div className="text-[11px] text-gray-500 leading-relaxed">{fr.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Should */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100">
                      <span className="text-xs font-bold text-orange-700">Should</span>
                      <span className="text-[11px] text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-full font-semibold">
                        {SAMPLE_PRD_FEATURES.filter((f) => f.priority === "Should").length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {SAMPLE_PRD_FEATURES.filter((f) => f.priority === "Should").map((fr) => (
                        <div key={fr.id} className="border border-gray-200 rounded-xl p-3.5 hover:border-orange-200 transition-colors bg-white">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-mono text-gray-400">{fr.id}</span>
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600">Should</span>
                          </div>
                          <div className="text-[13px] font-semibold text-gray-900 mb-1">{fr.title}</div>
                          <div className="text-[11px] text-gray-500 leading-relaxed">{fr.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Architecture Tab ── mirrors design viewer */}
            {activeTab === 2 && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-[16px] font-bold text-gray-900">System Architecture</h3>
                    <p className="text-[12px] text-gray-400 mt-0.5">AWS ECS · PostgreSQL WAL → Debezium → SQS → Salesforce</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] bg-[#1D9E75]/[0.1] text-[#1D9E75] border border-[#1D9E75]/20 font-semibold">
                    v1.0.0 · auto
                  </span>
                </div>

                {/* Data flow */}
                <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Data Flow</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {SAMPLE_ARCH_FLOW.map((node, i) => (
                      <div key={node.name} className="flex items-center gap-1.5">
                        <div className={`px-3 py-2 rounded-lg border text-xs font-semibold ${node.color}`}>
                          <div>{node.name}</div>
                          <div className="text-[10px] opacity-70 font-normal mt-0.5">{node.type}</div>
                        </div>
                        {i < SAMPLE_ARCH_FLOW.length - 1 && (
                          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Tech stack */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-700 mb-3">Tech Stack</p>
                    <div className="space-y-2">
                      {SAMPLE_ARCH_TECH.map(({ key, val }) => (
                        <div key={key} className="flex justify-between gap-4">
                          <span className="text-xs text-zinc-400 shrink-0">{key}</span>
                          <span className="text-xs text-zinc-700 font-medium text-right">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Design decisions */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-700 mb-3">Key Design Decisions</p>
                    <div className="space-y-3">
                      {[
                        { decision: "WAL-based CDC over polling", reason: "Eliminates table-scan locking that crashed Airflow on Black Friday." },
                        { decision: "SQS over Kafka", reason: "Serverless, no cluster ops, handles burst traffic within team constraints." },
                        { decision: "Circuit Breaker pattern", reason: "Prevents Salesforce rate limits from cascading into pipeline failure." },
                      ].map((item, i) => (
                        <div key={i}>
                          <p className="text-xs font-semibold text-blue-600">{item.decision}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="h-px bg-gray-200" />

      {/* ── Features ── */}
      <section className="py-24 px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="text-[13px] font-bold tracking-[0.1em] text-[#1D9E75] uppercase mb-4">Why FlowFD</div>
        <h2 className="text-[40px] lg:text-[52px] font-bold text-gray-900 leading-tight mb-4 tracking-tight">Built for the FDE work cycle.</h2>
        <p className="text-[18px] text-gray-600 leading-relaxed max-w-[500px] mb-14">
          Not a generic project tool. Every feature is designed around how FDEs actually work.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-2xl p-7 hover:border-[#1D9E75]/30 transition-colors">
              <div className="text-[16px] font-bold text-gray-900 mb-2">{f.title}</div>
              <div className="text-[14px] text-gray-600 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-gray-200" />

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="text-[13px] font-bold tracking-[0.1em] text-[#1D9E75] uppercase mb-4">Pricing</div>
        <h2 className="text-[40px] lg:text-[52px] font-bold text-gray-900 leading-tight mb-4 tracking-tight">Start free. Upgrade when ready.</h2>
        <p className="text-[18px] text-gray-600 leading-relaxed max-w-[520px] mb-14">
          FlowFD is currently in demo — full pipeline available free. Paid plans launching soon.
        </p>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mb-16">
          <div className="rounded-2xl p-8 border-2 border-[#1D9E75] bg-[#1D9E75] text-white flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center justify-between mb-6">
              <span className="text-[15px] font-bold">Demo</span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white">Active now</span>
            </div>
            <div className="mb-2"><span className="text-[52px] font-bold leading-none">Free</span></div>
            <div className="text-[13px] text-white/70 mb-7">100 credits on sign-up</div>
            <ul className="space-y-3 flex-1 mb-8">
              {["Full pipeline access", "CPS → PRD → Architecture", "GitHub sync", "Unlimited projects"].map((feat, j) => (
                <li key={j} className="text-[13px] text-white/90 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4" /></svg>
                  {feat}
                </li>
              ))}
            </ul>
            <Link href={user ? `${APP_URL}/dashboard` : `${APP_URL}/register`} className="w-full py-3 rounded-xl text-[14px] font-semibold text-center block bg-white text-[#1D9E75] hover:bg-gray-50 transition-colors">
              {user ? "Go to Dashboard" : "Get started free"}
            </Link>
          </div>
          <div className="rounded-2xl p-8 border border-gray-200 bg-gray-50 flex flex-col opacity-60">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[15px] font-bold text-gray-900">Pro Monthly</span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-500">Coming soon</span>
            </div>
            <div className="mb-2"><span className="text-[52px] font-bold leading-none text-gray-900">$29</span><span className="text-[16px] text-gray-400 ml-1">/month</span></div>
            <div className="text-[13px] text-gray-400 mb-7">1,000 credits/month</div>
            <ul className="space-y-3 flex-1 mb-8">
              {["Everything in Demo", "1,000 credits renewed monthly", "RAG with Groups", "Up to 2,000 rollover", "Priority analysis"].map((feat, j) => (
                <li key={j} className="text-[13px] text-gray-500 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4" /></svg>
                  {feat}
                </li>
              ))}
            </ul>
            <div className="w-full py-3 rounded-xl text-[14px] font-semibold text-center bg-gray-100 text-gray-400 cursor-not-allowed select-none">Coming soon</div>
          </div>
          <div className="rounded-2xl p-8 border border-gray-200 bg-gray-50 flex flex-col opacity-60">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[15px] font-bold text-gray-900">Pro Annual</span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-500">Coming soon</span>
            </div>
            <div className="mb-1"><span className="text-[52px] font-bold leading-none text-gray-900">$290</span><span className="text-[16px] text-gray-400 ml-1">/year</span></div>
            <div className="text-[12px] text-gray-400 mb-1">$24.2/month · save 17%</div>
            <div className="text-[13px] text-gray-400 mb-7">12,000 credits/year</div>
            <ul className="space-y-3 flex-1 mb-8">
              {["Everything in Pro Monthly", "Save 17% vs monthly", "12,000 credits/year", "Priority support"].map((feat, j) => (
                <li key={j} className="text-[13px] text-gray-500 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4" /></svg>
                  {feat}
                </li>
              ))}
            </ul>
            <div className="w-full py-3 rounded-xl text-[14px] font-semibold text-center bg-gray-100 text-gray-400 cursor-not-allowed select-none">Coming soon</div>
          </div>
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-gray-900 mb-2">Credit usage</h3>
          <p className="text-[14px] text-gray-500 mb-6">Credits are consumed per pipeline run. All features available with any credit balance.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {creditItems.map((item, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="text-[22px] font-bold text-[#1D9E75] leading-none mb-1">{item.credits}</div>
                <div className="text-[11px] text-gray-500 leading-snug">credits</div>
                <div className="text-[12px] text-gray-600 mt-2">{item.action}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gray-200" />

      {/* ── FAQ ── */}
      <section className="py-24 px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="max-w-3xl">
          <div className="text-[13px] font-bold tracking-[0.1em] text-[#1D9E75] uppercase mb-4">FAQ</div>
          <h2 className="text-[36px] lg:text-[44px] font-bold text-gray-900 leading-tight mb-12 tracking-tight">Common questions</h2>
          <div className="space-y-7">
            {faqs.map((faq, i) => (
              <div key={i} className="border-b border-gray-100 pb-7">
                <h3 className="text-[17px] font-bold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-[15px] text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gray-200" />

      {/* ── Brand name ── */}
      <div className="border-t border-b border-gray-200 bg-gray-50">
        <div className="max-w-4xl mx-auto px-8 lg:px-12 py-20">
          <img src="/ffd-transparent.png" alt="FlowFD Logo" className="inline-block" width={300}/> 
          <div className="grid md:grid-cols-2 gap-12 mt-12">
            <div>
              <div className="text-[12px] text-[#1D9E75] tracking-[0.1em] font-bold uppercase mb-3">Flow</div>
              <div className="text-[20px] font-bold text-gray-900 mb-2">Uninterrupted pipeline</div>
              <div className="text-[15px] text-gray-600 leading-relaxed">From meeting to deployable code — every step connected, every doc in sync. No bottlenecks, no context loss.</div>
            </div>
            <div className="md:pl-12 md:border-l border-gray-300">
              <div className="text-[12px] text-[#1D9E75] tracking-[0.1em] font-bold uppercase mb-3">FD</div>
              <div className="text-[20px] font-bold text-gray-900 mb-2">Forward Deployed</div>
              <div className="text-[15px] text-gray-600 leading-relaxed">Engineers embedded at customer sites. FlowFD handles the operational overhead so FDEs can do what they do best.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Final CTA ── */}
      <section className="py-32 px-8 text-center">
        <h2 className="text-[44px] lg:text-[58px] font-bold text-gray-900 tracking-tight mb-5">Start with your next meeting.</h2>
        <p className="text-[18px] text-gray-600 mb-12 max-w-[460px] mx-auto">Set up in 5 minutes. Paste your notes. Let the pipeline do the rest.</p>
        <Link href={user ? `${APP_URL}/dashboard` : `${APP_URL}/register`} className="inline-block px-10 py-4 rounded-xl bg-[#1D9E75] text-white text-[16px] font-semibold hover:bg-[#0F6E56] transition-colors shadow-sm">
          {user ? t("dashboard") : "Get started free"}
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 px-8 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="text-[18px] font-bold text-gray-700">Flow<span className="text-[#1D9E75]">FD</span></div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/pricing" className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Pricing</Link>
            <Link href="/privacy" className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Terms of Service</Link>
            <div>
              <a href="https://www.producthunt.com/products/flowfd?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-flowfd" target="_blank" rel="noopener noreferrer">
                <img alt="FlowFD on Product Hunt" width="200" height="43" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1126749&theme=light&t=1776671606130" />
              </a>
            </div>
            <span className="text-[13px] text-gray-400">© 2026 FlowFD. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
