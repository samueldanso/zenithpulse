"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { TraceItem } from "@/components/trace-item";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getTraces } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function TracesPage() {
	const [actionFilter, setActionFilter] = useState<string>("all");

	const { data, isLoading } = useQuery({
		queryKey: ["traces", actionFilter],
		queryFn: () =>
			getTraces({
				limit: 100,
				...(actionFilter !== "all" ? { action: actionFilter } : {}),
			}),
		refetchInterval: 15_000,
	});

	return (
		<DashboardShell>
			<div className="space-y-4 p-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="font-mono text-sm uppercase tracking-wider text-foreground">
							Traces
						</span>
						{data && (
							<span className="border border-dashed border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
								{data.total}
							</span>
						)}
					</div>

					<Select
						value={actionFilter}
						onValueChange={(v: string | null) => {
							setActionFilter(v ?? "all");
						}}
					>
						<SelectTrigger className="w-36 rounded-none font-mono text-xs uppercase tracking-wider">
							<SelectValue placeholder="ALL ACTIONS" />
						</SelectTrigger>
						<SelectContent className="rounded-none font-mono text-xs">
							<SelectItem value="all">ALL</SelectItem>
							<SelectItem value="none">NONE</SelectItem>
							<SelectItem value="cancel_order">CANCEL ORDER</SelectItem>
							<SelectItem value="close_position">CLOSE POSITION</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* List */}
				{isLoading ? (
					<div className="space-y-2">
						{[0, 1, 2].map((i) => (
							<Skeleton key={i} className="h-14 w-full rounded-none" />
						))}
					</div>
				) : !data || data.data.length === 0 ? (
					<div className="flex h-40 items-center justify-center">
						<span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
							No traces yet
						</span>
					</div>
				) : (
					<div className="space-y-1">
						{data.data.map((trace) => (
							<TraceItem key={trace.id} trace={trace} />
						))}
					</div>
				)}
			</div>
		</DashboardShell>
	);
}
