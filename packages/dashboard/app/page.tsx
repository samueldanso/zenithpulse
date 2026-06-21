"use client";

import { ModeBadge } from "@/components/mode-badge";
import { RiskBadge } from "@/components/risk-badge";
import { type CycleEvent, useEvents } from "@/hooks/use-events";
import { type Playbook, getHealth, getPlaybooks, getTraces } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

export default function OverviewPage() {
	const { data: health } = useQuery({
		queryKey: ["health"],
		queryFn: getHealth,
		refetchInterval: 15_000,
	});

	const { data: playbooks } = useQuery({
		queryKey: ["playbooks"],
		queryFn: getPlaybooks,
		refetchInterval: 30_000,
	});

	const { data: traces } = useQuery({
		queryKey: ["traces-count"],
		queryFn: () => getTraces({ limit: 1 }),
		refetchInterval: 15_000,
	});

	const [liveScores, setLiveScores] = useState<
		Record<string, { riskScore: number; riskState: string }>
	>({});

	const [activityLog, setActivityLog] = useState<
		Array<{ id: string; playbookId: string; riskScore: number; riskState: string; time: string }>
	>([]);

	const activityIdRef = useRef(0);

	const handleCycle = useCallback((e: CycleEvent) => {
		setLiveScores((prev) => ({
			...prev,
			[e.playbookId]: { riskScore: e.riskScore, riskState: e.riskState },
		}));
		setActivityLog((prev) => {
			const entry = {
				id: String(activityIdRef.current++),
				playbookId: e.playbookId,
				riskScore: e.riskScore,
				riskState: e.riskState,
				time: new Date().toLocaleTimeString(),
			};
			return [entry, ...prev].slice(0, 20);
		});
	}, []);

	const { connected } = useEvents(handleCycle);

	const formatUptime = (ms: number) => {
		const days = Math.floor(ms / 86_400_000);
		const hours = Math.floor((ms % 86_400_000) / 3_600_000);
		if (days > 0) return `${days}d ${hours}h`;
		const minutes = Math.floor((ms % 3_600_000) / 60_000);
		return `${hours}h ${minutes}m`;
	};

	const riskDistribution = playbooks?.reduce(
		(acc, pb) => {
			const state = (liveScores[pb.id]?.riskState ?? pb.riskState) as Playbook["riskState"];
			acc[state] = (acc[state] || 0) + 1;
			return acc;
		},
		{ healthy: 0, elevated: 0, critical: 0 } as Record<string, number>,
	);

	const playbookNameMap = playbooks?.reduce(
		(acc, pb) => {
			acc[pb.id] = pb.displayName;
			return acc;
		},
		{} as Record<string, string>,
	);

	return (
		<div className="p-6 max-w-[1400px]">
			{/* Header */}
			<header className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="font-mono text-lg font-bold tracking-tight">ZenithPulse</h1>
					<StatusChip connected={connected} />
				</div>
				<div className="hidden items-center gap-3 text-[10px] font-mono text-muted-foreground sm:flex">
					<a
						href="https://github.com/samueldanso/zenithpulse"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground transition-colors"
					>
						GitHub <ExternalLink className="h-2.5 w-2.5" />
					</a>
					<span className="text-border">|</span>
					<a
						href="https://zenithpulse-server.onrender.com/skill.md"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground transition-colors"
					>
						SKILL.md <ExternalLink className="h-2.5 w-2.5" />
					</a>
					<span className="text-border">|</span>
					<a
						href="https://www.npmjs.com/package/zenithpulse-mcp"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground transition-colors"
					>
						npm <ExternalLink className="h-2.5 w-2.5" />
					</a>
					<span className="text-border">|</span>
					<a
						href="https://github.com/samueldanso/zenithpulse/blob/main/examples/sample-output/session-capture.json"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground transition-colors"
					>
						Proof Log <ExternalLink className="h-2.5 w-2.5" />
					</a>
				</div>
			</header>

			{/* Headline */}
			<p className="mb-6 text-sm text-muted-foreground leading-relaxed max-w-3xl">
				Autonomous risk enforcement and observability runtime for Bitget Playbooks. Monitors live
				trading strategies against their own backtest rules — detects drift, scores risk, enforces
				automatically, and records every decision.
			</p>

			{/* Stats Row */}
			<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
				<StatCard
					label="Decision Traces"
					value={traces?.total ? formatNumber(traces.total) : "—"}
					sublabel="every 15s, per playbook"
				/>
				<StatCard
					label="Playbooks Monitored"
					value={health?.playbookCount?.toString() ?? "—"}
					sublabel="contracts derived from backtest"
				/>
				<StatCard
					label="Continuous Uptime"
					value={health ? formatUptime(health.uptime) : "—"}
					sublabel="observer running since deploy"
				/>
				<StatCard
					label="API Calls / Hour"
					value={health?.playbookCount ? `~${(health.playbookCount * 240).toLocaleString()}` : "—"}
					sublabel="Bitget futures API (bitget-core)"
				/>
			</div>

			{/* Two Column: Activity + Risk Distribution */}
			<div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
				{/* Live Activity Feed */}
				<div className="lg:col-span-2 border border-border bg-card p-4">
					<div className="mb-3 flex items-center justify-between">
						<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
							Live Activity — Observer Loop
						</span>
						<span className="font-mono text-[10px] text-muted-foreground">
							{health?.lastCycleAt
								? `last: ${new Date(health.lastCycleAt).toLocaleTimeString()}`
								: ""}
						</span>
					</div>
					{activityLog.length === 0 ? (
						<div className="py-6 text-center">
							<span className="font-mono text-xs text-muted-foreground">
								Waiting for next cycle...{" "}
								<span className={connected ? "text-emerald-400" : "text-zinc-500"}>
									{connected ? "(SSE connected, events arrive every 15s)" : "(connecting...)"}
								</span>
							</span>
						</div>
					) : (
						<div className="space-y-1 max-h-[200px] overflow-y-auto">
							{activityLog.map((entry) => (
								<div
									key={entry.id}
									className="flex items-center gap-3 py-1 border-b border-border/50 last:border-0"
								>
									<span className="font-mono text-[10px] text-muted-foreground w-16 shrink-0">
										{entry.time}
									</span>
									<span className="font-mono text-[10px] text-foreground truncate flex-1">
										{playbookNameMap?.[entry.playbookId] ?? entry.playbookId.slice(0, 8)}
									</span>
									<span className="font-mono text-[10px] tabular-nums">{entry.riskScore}</span>
									<RiskBadge state={entry.riskState as Playbook["riskState"]} />
								</div>
							))}
						</div>
					)}
				</div>

				{/* Risk Summary Panel */}
				<div className="border border-border bg-card p-4 flex flex-col">
					<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
						Risk Summary
					</span>
					{riskDistribution && (
						<div className="flex flex-col gap-2 mb-4">
							<RiskBar
								label="healthy"
								count={riskDistribution.healthy ?? 0}
								total={playbooks?.length ?? 1}
								color="emerald"
							/>
							<RiskBar
								label="elevated"
								count={riskDistribution.elevated ?? 0}
								total={playbooks?.length ?? 1}
								color="amber"
							/>
							<RiskBar
								label="critical"
								count={riskDistribution.critical ?? 0}
								total={playbooks?.length ?? 1}
								color="red"
							/>
						</div>
					)}
					<div className="mt-auto pt-3 border-t border-border/50">
						<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
							The Loop
						</span>
						<div className="mt-1.5 font-mono text-[10px] text-muted-foreground leading-relaxed">
							Watch → Detect → Score → Act → Record
						</div>
						<div className="mt-1 font-mono text-[10px] text-muted-foreground">
							4 rules checked per cycle: asset-drift, oversize, drawdown-breach, sharpe-degradation
						</div>
					</div>
				</div>
			</div>

			{/* Playbooks Grid */}
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-xs uppercase tracking-wider text-muted-foreground">
						Monitored Playbooks
					</h2>
					{playbooks && (
						<span className="font-mono text-[10px] text-muted-foreground">
							{playbooks.length} active
						</span>
					)}
				</div>

				{playbooks && playbooks.length === 0 && (
					<div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
						No playbooks registered. Start the observer to sync playbooks from Bitget.
					</div>
				)}

				<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
					{playbooks?.map((pb) => (
						<PlaybookCard key={pb.id} playbook={pb} liveScore={liveScores[pb.id]} />
					))}
				</div>
			</section>

			{/* Footer */}
			<footer className="mt-10 border-t border-border pt-4 flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground">
					Bitget AI Base Camp S1 — Track 2 (Trading Infra)
				</span>
				<span className="font-mono text-[10px] text-muted-foreground">
					bitget-core + getagent-skill
				</span>
			</footer>
		</div>
	);
}

function StatusChip({ connected }: { connected: boolean }) {
	return (
		<div className="flex items-center gap-1.5 rounded-sm border border-border px-2 py-0.5">
			<span
				className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-emerald-400" : "bg-zinc-600"}`}
			/>
			<span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
				{connected ? "Live" : "Offline"}
			</span>
		</div>
	);
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
	return (
		<div className="border border-border bg-card p-4">
			<span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
			<div className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight">{value}</div>
			<span className="text-[10px] text-muted-foreground">{sublabel}</span>
		</div>
	);
}

function RiskBar({
	label,
	count,
	total,
	color,
}: { label: string; count: number; total: number; color: "emerald" | "amber" | "red" }) {
	const pct = total > 0 ? (count / total) * 100 : 0;
	const colors = {
		emerald: "bg-emerald-400",
		amber: "bg-amber-400",
		red: "bg-red-400",
	};
	const textColors = {
		emerald: "text-emerald-400",
		amber: "text-amber-400",
		red: "text-red-400",
	};

	return (
		<div className="flex items-center gap-2">
			<span className="font-mono text-[10px] text-muted-foreground w-14">{label}</span>
			<div className="flex-1 h-2 bg-muted/50 overflow-hidden">
				<div className={`h-full ${colors[color]} transition-all`} style={{ width: `${pct}%` }} />
			</div>
			<span className={`font-mono text-[11px] font-bold w-5 text-right ${textColors[color]}`}>
				{count}
			</span>
		</div>
	);
}

function PlaybookCard({
	playbook,
	liveScore,
}: { playbook: Playbook; liveScore?: { riskScore: number; riskState: string } }) {
	const score = liveScore?.riskScore ?? playbook.riskScore;
	const state = (liveScore?.riskState as Playbook["riskState"]) ?? playbook.riskState;
	const lastSeen = playbook.lastObservedAt
		? new Date(playbook.lastObservedAt).toLocaleTimeString()
		: "—";

	const borderAccent =
		state === "critical"
			? "border-l-red-500/50"
			: state === "elevated"
				? "border-l-amber-500/50"
				: "border-l-emerald-500/20";
	const scoreColor =
		state === "critical"
			? "text-red-400"
			: state === "elevated"
				? "text-amber-400"
				: "text-emerald-400";

	return (
		<Link
			href={`/playbooks/${playbook.id}`}
			className={`group border border-border border-l-2 ${borderAccent} bg-card p-4 transition-all hover:bg-accent/50`}
		>
			<div className="mb-3 flex items-start justify-between gap-2">
				<span className="text-sm font-medium leading-tight line-clamp-1">
					{playbook.displayName}
				</span>
				<ModeBadge mode={playbook.executionMode} />
			</div>

			<div className="mb-3 flex items-center gap-3">
				<div className="flex items-baseline gap-1.5">
					<span className={`font-mono text-2xl font-bold tabular-nums ${scoreColor}`}>{score}</span>
					<span className="font-mono text-[10px] text-muted-foreground">/100</span>
				</div>
				<RiskBadge state={state} />
			</div>

			<div className="flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground">{lastSeen}</span>
				<span className="flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
					details <ArrowRight className="h-3 w-3" />
				</span>
			</div>
		</Link>
	);
}

function formatNumber(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return n.toString();
}
