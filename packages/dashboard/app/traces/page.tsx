"use client";

import { TraceItem } from "@/components/trace-item";
import { type EnforcementEvent, useEvents } from "@/hooks/use-events";
import { getPlaybooks, getTraces } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";

const PAGE_SIZE = 50;
const ACTION_OPTIONS = ["all", "none", "cancel_order", "close_position"];

export default function TracesPage() {
	const [playbookFilter, setPlaybookFilter] = useState("");
	const [actionFilter, setActionFilter] = useState("all");
	const [offset, setOffset] = useState(0);

	const { data: playbooks } = useQuery({
		queryKey: ["playbooks"],
		queryFn: getPlaybooks,
	});

	const { data: traces, refetch } = useQuery({
		queryKey: ["traces", { playbookFilter, actionFilter, offset }],
		queryFn: () =>
			getTraces({
				playbook_id: playbookFilter || undefined,
				action: actionFilter === "all" ? undefined : actionFilter,
				limit: PAGE_SIZE,
				offset,
			}),
	});

	const handleEnforcement = useCallback(
		(_e: EnforcementEvent) => {
			refetch();
		},
		[refetch],
	);

	useEvents(undefined, handleEnforcement);

	const total = traces?.total ?? 0;
	const hasNext = offset + PAGE_SIZE < total;
	const hasPrev = offset > 0;

	return (
		<div className="p-6">
			<header className="mb-6">
				<h1 className="font-mono text-lg font-bold">Decision Traces</h1>
			</header>

			<div className="mb-4 flex flex-wrap items-center gap-3">
				<label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
					Playbook
					<select
						value={playbookFilter}
						onChange={(e) => {
							setPlaybookFilter(e.target.value);
							setOffset(0);
						}}
						className="border border-border bg-transparent px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					>
						<option value="">All</option>
						{playbooks?.map((pb) => (
							<option key={pb.id} value={pb.id}>
								{pb.displayName}
							</option>
						))}
					</select>
				</label>

				<label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
					Action
					<select
						value={actionFilter}
						onChange={(e) => {
							setActionFilter(e.target.value);
							setOffset(0);
						}}
						className="border border-border bg-transparent px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					>
						{ACTION_OPTIONS.map((opt) => (
							<option key={opt} value={opt}>
								{opt}
							</option>
						))}
					</select>
				</label>

				<span className="ml-auto font-mono text-xs text-muted-foreground">{total} total</span>
			</div>

			{traces && traces.data.length === 0 && (
				<div className="border border-dashed p-8 text-center text-sm text-muted-foreground">
					No traces found.
				</div>
			)}

			<div className="flex flex-col gap-1">
				{traces?.data.map((trace) => (
					<TraceItem key={trace.id} trace={trace} />
				))}
			</div>

			{total > PAGE_SIZE && (
				<div className="mt-4 flex items-center justify-center gap-4">
					<button
						type="button"
						onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
						disabled={!hasPrev}
						className="flex items-center gap-1 border border-border px-3 py-1.5 font-mono text-xs text-foreground disabled:opacity-30"
					>
						<ChevronLeft className="h-3 w-3" /> Prev
					</button>
					<span className="font-mono text-xs text-muted-foreground">
						{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
					</span>
					<button
						type="button"
						onClick={() => setOffset(offset + PAGE_SIZE)}
						disabled={!hasNext}
						className="flex items-center gap-1 border border-border px-3 py-1.5 font-mono text-xs text-foreground disabled:opacity-30"
					>
						Next <ChevronRight className="h-3 w-3" />
					</button>
				</div>
			)}
		</div>
	);
}
