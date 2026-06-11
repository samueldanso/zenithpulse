"use client";

import { ModeBadge } from "@/components/mode-badge";
import { RiskBadge } from "@/components/risk-badge";
import { type CycleEvent, useEvents } from "@/hooks/use-events";
import { type Playbook, getHealth, getPlaybooks } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

export default function OverviewPage() {
	const { data: health } = useQuery({
		queryKey: ["health"],
		queryFn: getHealth,
		refetchInterval: 30_000,
	});

	const { data: playbooks } = useQuery({
		queryKey: ["playbooks"],
		queryFn: getPlaybooks,
		refetchInterval: 30_000,
	});

	const [liveScores, setLiveScores] = useState<
		Record<string, { riskScore: number; riskState: string }>
	>({});

	const handleCycle = useCallback((e: CycleEvent) => {
		setLiveScores((prev) => ({
			...prev,
			[e.playbookId]: { riskScore: e.riskScore, riskState: e.riskState },
		}));
	}, []);

	const { connected } = useEvents(handleCycle);

	const formatUptime = (ms: number) => {
		const totalSeconds = Math.floor(ms / 1000);
		const h = Math.floor(totalSeconds / 3600);
		const m = Math.floor((totalSeconds % 3600) / 60);
		return `${h}h ${m}m`;
	};

	return (
		<div className="p-6">
			<header className="mb-8 flex items-center gap-3">
				<h1 className="font-mono text-lg font-bold">ZenithPulse</h1>
				<div className="flex items-center gap-1.5">
					<span
						className={`h-2 w-2 rounded-full ${connected ? "animate-pulse bg-emerald-400" : "bg-zinc-600"}`}
					/>
					<span className="text-xs text-muted-foreground">{connected ? "Live" : "Offline"}</span>
				</div>
				{health && (
					<span className="ml-auto font-mono text-xs text-muted-foreground">
						uptime {formatUptime(health.uptime)}
					</span>
				)}
			</header>

			<section>
				<h2 className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">Playbooks</h2>

				{playbooks && playbooks.length === 0 && (
					<div className="border border-dashed p-8 text-center text-sm text-muted-foreground">
						No playbooks registered. Start the observer to sync playbooks from Bitget.
					</div>
				)}

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{playbooks?.map((pb) => (
						<PlaybookCard key={pb.id} playbook={pb} liveScore={liveScores[pb.id]} />
					))}
				</div>
			</section>
		</div>
	);
}

function PlaybookCard({
	playbook,
	liveScore,
}: {
	playbook: Playbook;
	liveScore?: { riskScore: number; riskState: string };
}) {
	const score = liveScore?.riskScore ?? playbook.riskScore;
	const state = (liveScore?.riskState as Playbook["riskState"]) ?? playbook.riskState;
	const lastSeen = playbook.lastObservedAt
		? new Date(playbook.lastObservedAt).toLocaleTimeString()
		: "—";

	return (
		<Link
			href={`/playbooks/${playbook.id}`}
			className="group border border-border bg-card p-4 transition-colors hover:bg-accent"
		>
			<div className="mb-3 flex items-start justify-between">
				<span className="text-sm font-medium">{playbook.displayName}</span>
				<ModeBadge mode={playbook.executionMode} />
			</div>

			<div className="mb-3 flex items-end gap-3">
				<span className="font-mono text-3xl font-bold tabular-nums">{score}</span>
				<RiskBadge state={state} />
			</div>

			<div className="flex items-center justify-between">
				<span className="font-mono text-xs text-muted-foreground">{lastSeen}</span>
				<span className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
					View <ArrowRight className="h-3 w-3" />
				</span>
			</div>
		</Link>
	);
}
