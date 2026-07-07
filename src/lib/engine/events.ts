import type { InjectedEvent } from './types';

interface ScheduledEvent {
	atSimTime: number;
	seq: number;
	event: InjectedEvent;
}

export class EventTimeline {
	private heap: ScheduledEvent[] = [];
	private seq = 0;

	schedule(event: InjectedEvent, atSimTime: number): void {
		this.heap.push({ atSimTime, seq: this.seq++, event });
		this.bubbleUp(this.heap.length - 1);
	}

	peekTime(): number | null {
		return this.heap.length > 0 ? this.heap[0].atSimTime : null;
	}

	popDue(simTime: number): InjectedEvent[] {
		const due: InjectedEvent[] = [];
		while (this.heap.length > 0 && this.heap[0].atSimTime <= simTime) {
			due.push(this.pop().event);
		}
		return due;
	}

	private pop(): ScheduledEvent {
		const top = this.heap[0];
		const last = this.heap.pop()!;
		if (this.heap.length > 0) {
			this.heap[0] = last;
			this.bubbleDown(0);
		}
		return top;
	}

	private less(a: ScheduledEvent, b: ScheduledEvent): boolean {
		return a.atSimTime === b.atSimTime ? a.seq < b.seq : a.atSimTime < b.atSimTime;
	}

	private bubbleUp(i: number): void {
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (!this.less(this.heap[i], this.heap[parent])) break;
			[this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
			i = parent;
		}
	}

	private bubbleDown(i: number): void {
		const n = this.heap.length;
		for (;;) {
			let smallest = i;
			const l = 2 * i + 1;
			const r = 2 * i + 2;
			if (l < n && this.less(this.heap[l], this.heap[smallest])) smallest = l;
			if (r < n && this.less(this.heap[r], this.heap[smallest])) smallest = r;
			if (smallest === i) return;
			[this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
			i = smallest;
		}
	}
}
