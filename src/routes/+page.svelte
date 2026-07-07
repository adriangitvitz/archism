<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PROVIDERS, type Provider } from '$lib/types/provider';

	let { data } = $props();

	let creating = $state(false);
	let newName = $state('');
	let newProvider = $state<Provider>('generic');

	async function createDesign(event: SubmitEvent) {
		event.preventDefault();
		creating = true;
		try {
			const res = await fetch('/api/designs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: newName, provider: newProvider })
			});
			if (res.ok) {
				const { id } = await res.json();
				await goto(resolve('/design/[id]', { id }));
			}
		} finally {
			creating = false;
		}
	}

	async function deleteDesign(id: string, name: string) {
		if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
		await fetch(`/api/designs/${id}`, { method: 'DELETE' });
		await invalidateAll();
	}

	function providerLabel(key: string): string {
		return PROVIDERS.find((p) => p.key === key)?.label ?? key;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<svelte:head>
	<title>ArchSim - System Architecture Simulator</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="mx-auto max-w-4xl px-6 py-12">
		<header class="mb-10">
			<h1 class="text-3xl font-bold tracking-tight">ArchSim</h1>
			<p class="mt-2 text-zinc-400">
				Design system architectures for AWS, GCP, Azure, or bare metal - then verify them like
				production: traffic simulation, design validation, and pub/sub event flow.
			</p>
		</header>

		<form onsubmit={createDesign} class="mb-10 flex flex-wrap items-center gap-3">
			<input
				bind:value={newName}
				placeholder="New design name…"
				class="min-w-52 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
			/>
			<select
				bind:value={newProvider}
				class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
			>
				{#each PROVIDERS as p (p.key)}
					<option value={p.key}>{p.label}</option>
				{/each}
			</select>
			<button
				type="submit"
				disabled={creating}
				class="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
			>
				{creating ? 'Creating…' : 'Create design'}
			</button>
		</form>

		{#if data.designs.length === 0}
			<div class="rounded-xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500">
				No designs yet - create your first one above.
			</div>
		{:else}
			<ul class="grid gap-3 sm:grid-cols-2">
				{#each data.designs as design (design.id)}
					<li
						class="group relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-600"
					>
						<a href={resolve('/design/[id]', { id: design.id })} class="block">
							<div class="flex items-center justify-between gap-2">
								<span class="truncate font-medium">{design.name}</span>
								<span class="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
									{providerLabel(design.provider)}
								</span>
							</div>
							<p class="mt-2 text-xs text-zinc-500">Updated {formatDate(design.updatedAt)}</p>
						</a>
						<button
							onclick={() => deleteDesign(design.id, design.name)}
							class="absolute right-3 bottom-3 hidden rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-950 group-hover:block"
							aria-label={`Delete ${design.name}`}
						>
							Delete
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
