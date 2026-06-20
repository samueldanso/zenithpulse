"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type CycleEvent = {
	playbookId: string;
	cycleId: string;
	riskScore: number;
	riskState: string;
	driftCount: number;
	timestamp: string;
};

export type EnforcementEvent = {
	playbookId: string;
	action: string;
	target: string | null;
	result: string | null;
	timestamp: string;
};

export function useEvents(
	onCycle?: (e: CycleEvent) => void,
	onEnforcement?: (e: EnforcementEvent) => void,
) {
	const [connected, setConnected] = useState(false);
	const onCycleRef = useRef(onCycle);
	const onEnforcementRef = useRef(onEnforcement);
	onCycleRef.current = onCycle;
	onEnforcementRef.current = onEnforcement;

	useEffect(() => {
		const es = new EventSource(`${API_URL}/api/events`);
		es.addEventListener("cycle", (e) => {
			try {
				onCycleRef.current?.(JSON.parse(e.data) as CycleEvent);
			} catch {
				/* ignore parse errors */
			}
		});
		es.addEventListener("enforcement", (e) => {
			try {
				onEnforcementRef.current?.(JSON.parse(e.data) as EnforcementEvent);
			} catch {
				/* ignore parse errors */
			}
		});
		es.onopen = () => setConnected(true);
		es.onerror = () => setConnected(false);
		return () => es.close();
	}, []);

	return { connected };
}
