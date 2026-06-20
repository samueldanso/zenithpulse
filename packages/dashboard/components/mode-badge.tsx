import type { ExecutionMode } from "@/lib/api";

const variants: Record<ExecutionMode, string> = {
	observe: "border-zinc-600 bg-zinc-500/10 text-zinc-400",
	enforce: "border-amber-600 bg-amber-500/10 text-amber-400",
	silent: "border-blue-600 bg-blue-500/10 text-blue-400",
};

export function ModeBadge({ mode }: { mode: ExecutionMode }) {
	return (
		<span
			className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] ${variants[mode]}`}
		>
			{mode}
		</span>
	);
}
