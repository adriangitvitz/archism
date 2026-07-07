<script lang="ts">
	let {
		points,
		color = '#f0c080',
		width = 160,
		height = 32,
		label = '',
		value = ''
	}: {
		points: number[];
		color?: string;
		width?: number;
		height?: number;
		label?: string;
		value?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, width, height);
		if (points.length < 2) return;

		let min = Infinity;
		let max = -Infinity;
		for (const p of points) {
			if (p < min) min = p;
			if (p > max) max = p;
		}
		if (max - min < 1e-9) {
			min -= 0.5;
			max += 0.5;
		}
		const pad = 2;
		const xStep = (width - pad * 2) / (points.length - 1);
		const yOf = (v: number) => height - pad - ((v - min) / (max - min)) * (height - pad * 2);

		ctx.strokeStyle = color;
		ctx.lineWidth = 1.25;
		ctx.beginPath();
		points.forEach((p, i) => {
			const x = pad + i * xStep;
			const y = yOf(p);
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		});
		ctx.stroke();

		ctx.lineTo(pad + (points.length - 1) * xStep, height - pad);
		ctx.lineTo(pad, height - pad);
		ctx.closePath();
		ctx.fillStyle = color + '18';
		ctx.fill();
	});
</script>

<div class="flex flex-col gap-0.5">
	{#if label}
		<div class="flex items-baseline justify-between">
			<span class="text-[12px] tracking-wide text-zinc-500 uppercase">{label}</span>
			{#if value}<span class="font-mono text-[12.5px] text-zinc-300">{value}</span>{/if}
		</div>
	{/if}
	<canvas bind:this={canvas} style={`width:${width}px;height:${height}px`}></canvas>
</div>
