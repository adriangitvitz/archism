<script lang="ts">
	import { getEditorContext } from '$lib/stores/context';
	import type { ComponentNodeData, FlowEdgeData } from '$lib/stores/design.svelte';
	import type { EdgeKind } from '$lib/types/graph';
	import { getComponentById } from '$lib/catalog/components';
	import { resolveSkin } from '$lib/catalog/providers';
	import { pubSubSemantics } from '$lib/catalog/pubsub-semantics';
	import 'iconify-icon';

	const { design, selection, readOnly } = getEditorContext();

	const selectedNode = $derived(design.nodes.find((n) => n.id === selection.nodeId) ?? null);
	const selectedEdge = $derived(design.edges.find((e) => e.id === selection.edgeId) ?? null);
	const nodeData = $derived(selectedNode ? (selectedNode.data as ComponentNodeData) : null);
	const edgeData = $derived(
		selectedEdge ? ((selectedEdge.data ?? { kind: 'sync' }) as FlowEdgeData) : null
	);
	const spec = $derived(nodeData ? getComponentById(nodeData.componentId) : null);
	const skin = $derived(nodeData ? resolveSkin(nodeData.componentId, design.provider) : null);

	const ps = $derived(nodeData?.config.pubsub);
	const pubsubSem = $derived(pubSubSemantics(design.provider));
	const isTopic = $derived(
		!!nodeData && (nodeData.componentId === 'pub-sub' || ps?.role === 'topic')
	);
	const isSubscriber = $derived(
		!!selectedNode &&
			(ps?.role === 'subscriber' ||
				design.edges.some(
					(e) =>
						e.target === selectedNode.id && (e.data as FlowEdgeData | undefined)?.kind === 'pubsub'
				))
	);
	const isEntry = $derived(
		!!selectedNode && !design.edges.some((e) => e.target === selectedNode.id)
	);

	const topicNodes = $derived(
		design.nodes.filter((n) => {
			const d = n.data as ComponentNodeData;
			return (
				n.id !== selectedNode?.id &&
				(d.componentId === 'pub-sub' || d.config.pubsub?.role === 'topic')
			);
		})
	);

	const EDGE_KINDS: { value: EdgeKind; label: string }[] = [
		{ value: 'sync', label: 'Synchronous (request/response)' },
		{ value: 'async', label: 'Asynchronous (queued)' },
		{ value: 'pubsub', label: 'Pub/Sub (topic fan-out)' }
	];
</script>

<div class="flex flex-col">
	{#if selectedNode && nodeData && spec}
		<div class="border-b border-zinc-800 p-3">
			<div class="flex items-center gap-2">
				<iconify-icon icon={skin?.icon ?? 'lucide:box'} width="20" height="20" class="text-zinc-300"
				></iconify-icon>
				<span class="text-sm font-semibold text-zinc-100">{spec.label}</span>
			</div>
			{#if skin && skin.name !== spec.label}
				<p class="mt-1 text-xs text-cyan-300/80">{skin.name}</p>
			{/if}
			<p class="mt-2 line-clamp-4 text-[13.5px] leading-relaxed text-zinc-500">
				{spec.description}
			</p>
			{#if skin?.docsUrl}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={skin.docsUrl}
					target="_blank"
					rel="noreferrer"
					class="mt-1 inline-block text-[13.5px] text-cyan-400 hover:underline"
				>
					Provider docs ↗
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</div>

		<div class="space-y-3 p-3">
			<label class="block">
				<span class="text-[13.5px] font-medium text-zinc-400">Label</span>
				<input
					value={nodeData.label}
					disabled={readOnly}
					oninput={(e) => design.updateNodeData(selectedNode.id, { label: e.currentTarget.value })}
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="text-[13.5px] font-medium text-zinc-400">Replicas</span>
				<input
					type="number"
					min="1"
					max="1000"
					value={nodeData.config.replicas ?? 1}
					disabled={readOnly}
					oninput={(e) => {
						const v = Math.max(1, Math.floor(Number(e.currentTarget.value) || 1));
						design.updateNodeConfig(selectedNode.id, { replicas: v });
					}}
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="text-[13.5px] font-medium text-zinc-400">
					Max QPS per replica
					<span class="text-zinc-600">(default {spec.maxQPS.toLocaleString()})</span>
				</span>
				<input
					type="number"
					min="1"
					placeholder={String(spec.maxQPS)}
					value={nodeData.config.maxQPSOverride ?? ''}
					disabled={readOnly}
					oninput={(e) => {
						const raw = e.currentTarget.value;
						const v = raw === '' ? undefined : Math.max(1, Math.floor(Number(raw) || spec.maxQPS));
						design.updateNodeConfig(selectedNode.id, { maxQPSOverride: v });
					}}
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="text-[13.5px] font-medium text-zinc-400">
					Service latency (ms)
					<span class="text-zinc-600">(default {spec.latencyMs} - raise for slow externals)</span>
				</span>
				<input
					type="number"
					min="0"
					placeholder={String(spec.latencyMs)}
					value={nodeData.config.latencyMsOverride ?? ''}
					disabled={readOnly}
					oninput={(e) => {
						const raw = e.currentTarget.value;
						const v = raw === '' ? undefined : Math.max(0, Number(raw) || spec.latencyMs);
						design.updateNodeConfig(selectedNode.id, { latencyMsOverride: v });
					}}
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
				/>
			</label>

			{#if isEntry}
				<label class="block">
					<span class="text-[13.5px] font-medium text-zinc-400">
						Entry traffic (RPS) <span class="text-zinc-600">(blank = share of global slider)</span>
					</span>
					<input
						type="number"
						min="0"
						value={nodeData.config.entryRps ?? ''}
						placeholder="global"
						disabled={readOnly}
						oninput={(e) => {
							const raw = e.currentTarget.value;
							design.updateNodeConfig(selectedNode.id, {
								entryRps: raw === '' ? undefined : Math.max(0, Number(raw) || 0)
							});
						}}
						class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
					/>
				</label>
			{/if}

			<label class="block">
				<span class="text-[13.5px] font-medium text-zinc-400">
					Request timeout (ms) <span class="text-zinc-600">(0 = never)</span>
				</span>
				<input
					type="number"
					min="0"
					step="100"
					value={nodeData.config.timeoutMs ?? ''}
					placeholder={spec.category === 'messaging' ? '0' : '10000'}
					disabled={readOnly}
					oninput={(e) => {
						const raw = e.currentTarget.value;
						design.updateNodeConfig(selectedNode.id, {
							timeoutMs: raw === '' ? undefined : Math.max(0, Math.floor(Number(raw) || 0))
						});
					}}
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
				/>
			</label>

			{#if nodeData.componentId === 'cache'}
				{@const cache = nodeData.config.cache}
				<div class="space-y-2 rounded-md border border-amber-900/60 bg-amber-950/20 p-2">
					<span class="text-[13.5px] font-semibold text-amber-300">Cache behavior</span>
					<label class="block">
						<span class="text-[12.5px] text-zinc-400">
							Hit ratio: {(((cache?.hitRatio ?? 0.8) as number) * 100).toFixed(0)}% (misses flow
							downstream)
						</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={cache?.hitRatio ?? 0.8}
							disabled={readOnly}
							oninput={(e) =>
								design.updateNodeConfig(selectedNode.id, {
									cache: {
										warmupSec: cache?.warmupSec ?? 30,
										hitRatio: Number(e.currentTarget.value)
									}
								})}
							class="mt-0.5 w-full accent-amber-500"
						/>
					</label>
					<label class="block">
						<span class="text-[12.5px] text-zinc-400">Warmup after restart (s)</span>
						<input
							type="number"
							min="0"
							value={cache?.warmupSec ?? 30}
							disabled={readOnly || !cache}
							oninput={(e) =>
								design.updateNodeConfig(selectedNode.id, {
									cache: {
										hitRatio: cache?.hitRatio ?? 0.8,
										warmupSec: Math.max(0, Math.floor(Number(e.currentTarget.value) || 0))
									}
								})}
							class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
						/>
					</label>
					{#if !cache}
						<p class="text-[12.5px] text-zinc-500">
							Move the slider to enable hit-ratio simulation.
						</p>
					{/if}
				</div>
			{/if}

			{#if spec.scalable}
				{@const as =
					typeof nodeData.config.autoscale === 'object' ? nodeData.config.autoscale : null}
				{@const asOn = !!nodeData.config.autoscale}
				<div class="space-y-2 rounded-md border border-cyan-900/60 bg-cyan-950/20 p-2">
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={asOn}
							disabled={readOnly}
							onchange={(e) =>
								design.updateNodeConfig(selectedNode.id, {
									autoscale: e.currentTarget.checked ? true : undefined
								})}
							class="accent-cyan-500"
						/>
						<span class="text-xs text-zinc-300">Autoscaling</span>
					</label>
					{#if asOn}
						{@const replicas = nodeData.config.replicas ?? 1}
						{@const eff = as ?? {
							min: replicas,
							max: Math.max(replicas * 10, replicas + 4),
							targetUtil: 0.7,
							scaleOutDelaySec: 60,
							scaleInDelaySec: 300,
							warmupSec: 30
						}}
						<div class="grid grid-cols-2 gap-2">
							{#each [['min', 'Min replicas'], ['max', 'Max replicas'], ['scaleOutDelaySec', 'Scale-out delay (s)'], ['warmupSec', 'Warmup (s)']] as [key, label] (key)}
								<label class="block">
									<span class="text-[12.5px] text-zinc-400">{label}</span>
									<input
										type="number"
										min="0"
										value={eff[key as 'min']}
										disabled={readOnly}
										oninput={(e) =>
											design.updateNodeConfig(selectedNode.id, {
												autoscale: {
													...eff,
													[key]: Math.max(0, Number(e.currentTarget.value) || 0)
												}
											})}
										class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
									/>
								</label>
							{/each}
						</div>
						<p class="text-[12.5px] text-zinc-500">
							Target {Math.round(eff.targetUtil * 100)}% util · scale-in after {eff.scaleInDelaySec}s
						</p>
					{/if}
				</div>
			{/if}

			{#if isTopic}
				<div class="space-y-2 rounded-md border border-violet-900/60 bg-violet-950/20 p-2">
					<span class="text-[13.5px] font-semibold text-violet-300">Topic settings</span>
					<p class="text-[12px] leading-snug text-violet-200/70">
						<span class="font-medium text-violet-200">{pubsubSem.product}</span> - {pubsubSem.note}
					</p>
					{#if pubsubSem.partitionsCapParallelism}
						<label class="block">
							<span class="text-[12.5px] text-zinc-400">Partitions (caps consumer parallelism)</span
							>
							<input
								type="number"
								min="1"
								value={ps?.partitions ?? 8}
								disabled={readOnly}
								oninput={(e) =>
									design.updateNodeConfig(selectedNode.id, {
										pubsub: {
											...ps,
											role: 'topic',
											partitions: Math.max(1, Math.floor(Number(e.currentTarget.value) || 1))
										}
									})}
								class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
							/>
						</label>
					{/if}
					<label class="block">
						<span class="text-[12.5px] text-zinc-400">Retention (messages)</span>
						<input
							type="number"
							min="0"
							value={ps?.retentionMessages ?? 1000000}
							disabled={readOnly}
							oninput={(e) =>
								design.updateNodeConfig(selectedNode.id, {
									pubsub: {
										...ps,
										role: 'topic',
										retentionMessages: Math.max(0, Math.floor(Number(e.currentTarget.value) || 0))
									}
								})}
							class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
						/>
					</label>
					{#if pubsubSem.canBackpressurePublishers}
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={ps?.backpressure ?? false}
								disabled={readOnly}
								onchange={(e) =>
									design.updateNodeConfig(selectedNode.id, {
										pubsub: { ...ps, role: 'topic', backpressure: e.currentTarget.checked }
									})}
								class="accent-violet-500"
							/>
							<span class="text-[12.5px] text-zinc-300"
								>Backpressure (throttle publishers instead of losing old messages)</span
							>
						</label>
					{/if}
				</div>
			{:else}
				{#if isSubscriber}
					<div class="space-y-2 rounded-md border border-violet-900/60 bg-violet-950/20 p-2">
						<span class="text-[13.5px] font-semibold text-violet-300">Subscriber settings</span>
						<label class="block">
							<span class="text-[12.5px] text-zinc-400"
								>Consumer group (same group = shared cursor)</span
							>
							<input
								value={ps?.group ?? ''}
								placeholder="own group (fan-out)"
								disabled={readOnly}
								oninput={(e) =>
									design.updateNodeConfig(selectedNode.id, {
										pubsub: { ...ps, role: 'subscriber', group: e.currentTarget.value || undefined }
									})}
								class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
							/>
						</label>
						<label class="block">
							<span class="text-[12.5px] text-zinc-400"
								>Failure rate: {((ps?.failureFraction ?? 0) * 100).toFixed(0)}%</span
							>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={ps?.failureFraction ?? 0}
								disabled={readOnly}
								oninput={(e) =>
									design.updateNodeConfig(selectedNode.id, {
										pubsub: {
											...ps,
											role: 'subscriber',
											failureFraction: Number(e.currentTarget.value)
										}
									})}
								class="mt-0.5 w-full accent-violet-500"
							/>
						</label>
						<label class="block">
							<span class="text-[12.5px] text-zinc-400">Dead-letter queue</span>
							<select
								value={ps?.dlqNodeId ?? ''}
								disabled={readOnly}
								onchange={(e) =>
									design.updateNodeConfig(selectedNode.id, {
										pubsub: {
											...ps,
											role: 'subscriber',
											dlqNodeId: e.currentTarget.value || undefined
										}
									})}
								class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
							>
								<option value="">- none -</option>
								{#each topicNodes as t (t.id)}
									<option value={t.id}>{(t.data as ComponentNodeData).label}</option>
								{/each}
							</select>
						</label>
					</div>
				{/if}
			{/if}

			{#if !readOnly}
				<button
					onclick={() => {
						design.deleteNode(selectedNode.id);
						selection.clear();
					}}
					class="w-full rounded-md border border-rose-900 px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-950"
				>
					Delete node
				</button>
			{/if}
		</div>
	{:else if selectedEdge && edgeData}
		<div class="border-b border-zinc-800 p-3">
			<span class="text-sm font-semibold text-zinc-100">Connection</span>
			<p class="mt-1 text-[13.5px] text-zinc-500">{selectedEdge.source} → {selectedEdge.target}</p>
		</div>
		<div class="space-y-3 p-3">
			<label class="block">
				<span class="text-[13.5px] font-medium text-zinc-400">Kind</span>
				<select
					value={edgeData.kind}
					disabled={readOnly}
					onchange={(e) =>
						design.updateEdgeData(selectedEdge.id, { kind: e.currentTarget.value as EdgeKind })}
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
				>
					{#each EDGE_KINDS as k (k.value)}
						<option value={k.value}>{k.label}</option>
					{/each}
				</select>
			</label>

			<label class="block">
				<span class="text-[13.5px] font-medium text-zinc-400">Label</span>
				<input
					value={edgeData.label ?? ''}
					disabled={readOnly}
					oninput={(e) =>
						design.updateEdgeData(selectedEdge.id, { label: e.currentTarget.value || undefined })}
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="text-[13.5px] font-medium text-zinc-400">Protocol</span>
				<select
					value={edgeData.protocol ?? ''}
					disabled={readOnly}
					onchange={(e) =>
						design.updateEdgeData(selectedEdge.id, {
							protocol: e.currentTarget.value || undefined
						})}
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
				>
					<option value="">-</option>
					{#each ['HTTP', 'gRPC', 'WebSocket', 'TCP', 'UDP'] as p (p)}
						<option value={p}>{p}</option>
					{/each}
				</select>
			</label>

			{#if edgeData.kind === 'sync' || edgeData.kind === 'async'}
				{@const weight = (selectedEdge.data as { weight?: number } | undefined)?.weight ?? 1}
				<label class="block">
					<span class="text-[13.5px] font-medium text-zinc-400"
						>Traffic weight: {(weight * 100).toFixed(0)}%</span
					>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={weight}
						disabled={readOnly}
						oninput={(e) =>
							design.updateEdgeData(selectedEdge.id, { weight: Number(e.currentTarget.value) })}
						class="mt-1 w-full accent-cyan-500"
					/>
					<span class="text-[12.5px] text-zinc-600">
						Fan-out: absolute fraction · Load balancer: relative share
					</span>
				</label>
			{/if}

			{#if edgeData.kind === 'sync'}
				{@const retry = (
					selectedEdge.data as { retry?: { max: number; backoffMs: number } } | undefined
				)?.retry}
				<div class="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={!!retry}
							disabled={readOnly}
							onchange={(e) =>
								design.updateEdgeData(selectedEdge.id, {
									retry: e.currentTarget.checked ? { max: 3, backoffMs: 500 } : undefined
								})}
							class="accent-cyan-500"
						/>
						<span class="text-xs text-zinc-300">Retry failed calls</span>
					</label>
					{#if retry}
						<div class="grid grid-cols-2 gap-2">
							<label class="block">
								<span class="text-[12.5px] text-zinc-400">Max attempts</span>
								<input
									type="number"
									min="1"
									max="10"
									value={retry.max}
									disabled={readOnly}
									oninput={(e) =>
										design.updateEdgeData(selectedEdge.id, {
											retry: {
												...retry,
												max: Math.max(1, Math.floor(Number(e.currentTarget.value) || 1))
											}
										})}
									class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
								/>
							</label>
							<label class="block">
								<span class="text-[12.5px] text-zinc-400">Backoff (ms)</span>
								<input
									type="number"
									min="100"
									step="100"
									value={retry.backoffMs}
									disabled={readOnly}
									oninput={(e) =>
										design.updateEdgeData(selectedEdge.id, {
											retry: {
												...retry,
												backoffMs: Math.max(100, Number(e.currentTarget.value) || 100)
											}
										})}
									class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
								/>
							</label>
						</div>
						<p class="text-[12.5px] text-amber-500/80">
							⚠ Retries amplify load on a struggling target - that's the point.
						</p>
					{/if}
				</div>

				{@const pool = (selectedEdge.data as { poolSize?: number } | undefined)?.poolSize}
				<label class="block">
					<span class="text-[13.5px] font-medium text-zinc-400">
						Connection pool <span class="text-zinc-600">(max in-flight, blank = unbounded)</span>
					</span>
					<input
						type="number"
						min="1"
						value={pool ?? ''}
						placeholder="∞"
						disabled={readOnly}
						oninput={(e) => {
							const raw = e.currentTarget.value;
							design.updateEdgeData(selectedEdge.id, {
								poolSize: raw === '' ? undefined : Math.max(1, Math.floor(Number(raw) || 1))
							});
						}}
						class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
					/>
				</label>

				{@const breaker = (
					selectedEdge.data as
						{ breaker?: { errorThreshold: number; cooldownSec: number } } | undefined
				)?.breaker}
				<div class="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={!!breaker}
							disabled={readOnly}
							onchange={(e) =>
								design.updateEdgeData(selectedEdge.id, {
									breaker: e.currentTarget.checked
										? { errorThreshold: 0.5, cooldownSec: 10 }
										: undefined
								})}
							class="accent-rose-500"
						/>
						<span class="text-xs text-zinc-300">Circuit breaker</span>
					</label>
					{#if breaker}
						<div class="grid grid-cols-2 gap-2">
							<label class="block">
								<span class="text-[12.5px] text-zinc-400">Trip at failure %</span>
								<input
									type="number"
									min="1"
									max="100"
									value={Math.round(breaker.errorThreshold * 100)}
									disabled={readOnly}
									oninput={(e) =>
										design.updateEdgeData(selectedEdge.id, {
											breaker: {
												...breaker,
												errorThreshold: Math.min(
													1,
													Math.max(0.01, Number(e.currentTarget.value) / 100)
												)
											}
										})}
									class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
								/>
							</label>
							<label class="block">
								<span class="text-[12.5px] text-zinc-400">Cooldown (s)</span>
								<input
									type="number"
									min="1"
									value={breaker.cooldownSec}
									disabled={readOnly}
									oninput={(e) =>
										design.updateEdgeData(selectedEdge.id, {
											breaker: {
												...breaker,
												cooldownSec: Math.max(1, Number(e.currentTarget.value) || 1)
											}
										})}
									class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
								/>
							</label>
						</div>
						<p class="text-[12.5px] text-zinc-500">
							Opens when the callee's failure rate exceeds the threshold; calls then fail fast at
							the caller until half-open probes succeed.
						</p>
					{/if}
				</div>
			{/if}

			{#if !readOnly}
				<button
					onclick={() => {
						design.deleteEdge(selectedEdge.id);
						selection.clear();
					}}
					class="w-full rounded-md border border-rose-900 px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-950"
				>
					Delete connection
				</button>
			{/if}
		</div>
	{:else}
		<div class="p-4 text-center text-xs text-zinc-600">
			Select a node or connection to edit its properties.
			<p class="mt-3 text-[13.5px] text-zinc-700">
				Drag components from the palette, or double-click one to add it at the center.
			</p>
		</div>
	{/if}
</div>
