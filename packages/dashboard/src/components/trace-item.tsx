"use client";

import { RiskBadge } from "@/components/risk-badge";
import type { TraceRow } from "@/lib/api";
import { useState } from "react";

const actionVariants: Record<string, string> = {
	none: "border-zinc-600 bg-zinc-500/10 text-zinc-400",
	cancel_order: "border-amber-600 bg-amber-500/10 text-amber-400",
	close_position: "border-red-600 bg-red-500/10 text-red-400",
};

function ActionBadge({ action }: { action: string }) {
	const variant = actionVariants[action] ?? actionVariants.none;
	return (
		<span
			className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] ${variant}`}
		>
			{action}
		</span>
	);
}

export function TraceItem({ trace, highlight }: { trace: TraceRow; highlight?: boolean }) {
	const [expanded, setExpanded] = useState(false);
	const ts = new Date(trace.timestamp).toLocaleString();
	const truncated =
		trace.reasoning.length > 80 ? `${trace.reasoning.slice(0, 80)}…` : trace.reasoning;

	return (
		<div
			className={`border border-border p-3 transition-colors ${highlight ? "animate-pulse bg-[color:var(--brand-accent)]/10" : ""}`}
		>
			<div className="flex flex-wrap items-center gap-3">
				<span className="font-mono text-xs text-muted-foreground">{ts}</span>
				<span className="font-mono text-xs tabular-nums">{trace.riskScore}</span>
				<RiskBadge state={trace.riskState} />
				<ActionBadge action={trace.enforcementAction} />
			</div>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="mt-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
			>
				{expanded ? trace.reasoning : truncated}
			</button>
		</div>
	);
}
