import type { RiskState } from "@/lib/api";

const variants: Record<RiskState, string> = {
	healthy: "border-emerald-600 bg-emerald-500/10 text-emerald-400",
	elevated: "border-amber-600 bg-amber-500/10 text-amber-400",
	critical: "border-red-600 bg-red-500/10 text-red-400",
};

export function RiskBadge({ state }: { state: RiskState }) {
	return (
		<span
			className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] ${variants[state]}`}
		>
			{state}
		</span>
	);
}
