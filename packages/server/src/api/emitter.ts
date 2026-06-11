type Listener = (data: unknown) => void;

class EventBus {
	private listeners = new Map<string, Set<Listener>>();

	emit(event: string, data: unknown): void {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const cb of set) {
			cb(data);
		}
	}

	subscribe(event: string, cb: Listener): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		const set = this.listeners.get(event) as Set<Listener>;
		set.add(cb);

		return () => {
			set.delete(cb);
			if (set.size === 0) {
				this.listeners.delete(event);
			}
		};
	}
}

export const eventBus = new EventBus();
