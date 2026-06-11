"use client";

import { ModeBadge } from "@/components/mode-badge";
import { RiskBadge } from "@/components/risk-badge";
import { TraceItem } from "@/components/trace-item";
import { type ExecutionMode, getPlaybook, getTraces, patchMode } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";

export default function PlaybookDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const queryClient = useQueryClient();

	const { data: playbook } = useQuery({
		queryKey: ["playbook", id],
		queryFn: () => getPlaybook(id),
	});

	const { data: traces } = useQuery({
		queryKey: ["traces", { playbook_id: id, limit: 10 }],
		queryFn: () => getTraces({ playbook_id: id, limit: 10 }),
	});

	const modeMutation = useMutation({
		mutationFn: (mode: ExecutionMode) => patchMode(id, mode),
		onSuccess: (data) => {
			toast.success(`Mode changed to ${data.mode}`);
			queryClient.invalidateQueries({ queryKey: ["playbook", id] });
		},
		onError: () => toast.error("Failed to change mode"),
	});

	if (!playbook) {
		return (
			<div className="p-6">
				<div className="h-6 w-48 animate-pulse bg-muted" />
			</div>
		);
	}

	const lastSeen = playbook.lastObservedAt
		? new Date(playbook.lastObservedAt).toLocaleString()
		: "—";

	return (
		<div className="p-6">
			<header className="mb-6 flex items-center gap-4">
				<Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
					<ArrowLeft className="h-4 w-4" />
				</Link>
				<h1 className="text-lg font-medium">{playbook.displayName}</h1>
				<label className="ml-auto flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
					Mode
					<select
						value={playbook.executionMode}
						onChange={(e) => modeMutation.mutate(e.target.value as ExecutionMode)}
						disabled={modeMutation.isPending}
						className="border border-border bg-transparent px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					>
						<option value="observe">observe</option>
						<option value="enforce">enforce</option>
						<option value="silent">silent</option>
					</select>
				</label>
			</header>

			<div className="mb-6 flex flex-wrap items-end gap-6">
				<div>
					<span className="text-xs uppercase tracking-wider text-muted-foreground">Risk Score</span>
					<div className="mt-1 flex items-end gap-2">
						<span className="font-mono text-4xl font-bold tabular-nums">{playbook.riskScore}</span>
						<RiskBadge state={playbook.riskState} />
					</div>
				</div>
				<div>
					<span className="text-xs uppercase tracking-wider text-muted-foreground">Mode</span>
					<div className="mt-1">
						<ModeBadge mode={playbook.executionMode} />
					</div>
				</div>
				<div>
					<span className="text-xs uppercase tracking-wider text-muted-foreground">
						Last Observed
					</span>
					<div className="mt-1 font-mono text-sm">{lastSeen}</div>
				</div>
			</div>

			{playbook.contract && (
				<section className="mb-6">
					<h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
						Contract Rules
					</h2>
					<div className="border border-dashed p-4">
						<dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
							<div>
								<dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
									Assets
								</dt>
								<dd className="mt-0.5 font-mono text-sm">
									{playbook.contract.allowedSymbols.join(", ")}
								</dd>
							</div>
							<div>
								<dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
									Max Drawdown
								</dt>
								<dd className="mt-0.5 font-mono text-sm">{playbook.contract.maxDrawdownPct}%</dd>
							</div>
							<div>
								<dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
									Margin Budget
								</dt>
								<dd className="mt-0.5 font-mono text-sm">
									${playbook.contract.marginBudget.toLocaleString()}
								</dd>
							</div>
							<div>
								<dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
									Backtest Sharpe
								</dt>
								<dd className="mt-0.5 font-mono text-sm">{playbook.contract.backTestSharpe}</dd>
							</div>
						</dl>
					</div>
				</section>
			)}

			<section>
				<h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
					Recent Traces
				</h2>
				{traces && traces.data.length === 0 && (
					<div className="border border-dashed p-6 text-center text-sm text-muted-foreground">
						No traces yet for this playbook.
					</div>
				)}
				<div className="flex flex-col gap-1">
					{traces?.data.map((trace) => (
						<TraceItem key={trace.id} trace={trace} />
					))}
				</div>
			</section>
		</div>
	);
}
