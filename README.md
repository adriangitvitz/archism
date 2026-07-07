# ArchSim - System Architecture Design + Production-Grade Simulation

Design system architectures on a drag-and-drop canvas (or as mermaid text), target **AWS / GCP / Azure / bare metal**, and verify them like production: live traffic simulation, static design validation, scoring, and pub/sub event-flow visualization.

## Features

- **Canvas editor** - Svelte Flow canvas with a searchable palette of 36 infrastructure components (load balancers, databases, caches, queues, topics…). Drag from the palette (or double-click to add), wire nodes, tune replicas / max QPS / autoscaling per node.
- **Provider skins** - one generic design, four provider views. Switching provider re-skins every node with the real product name, icon, docs link, and provider-specific constraints (e.g. AWS API Gateway account RPS cap, bare-metal can't autoscale) without touching the topology.
- **Traffic simulation** - a deterministic time-stepped fluid-flow engine runs in a Web Worker (100 ms sim ticks, O(V+E) per tick regardless of RPS). Load-balancer splitting, queue buildup (Little's law latency), utilization coloring, bottleneck detection, degradation with hysteresis, upstream backpressure, failure cascades. Inject chaos mid-run: kill/revive nodes, traffic ×10 spikes, latency injection, publish bursts.
- **Pub/sub semantics** - topics track per-consumer-group cursors (Kafka-style lag = produced − consumed), partitions cap group parallelism, failing subscribers route a fraction of messages to a DLQ, retention overflow either drops old messages or backpressures publishers (per-topic toggle). Lag badges live on the topic node.
- **Validation** - lint-style issues (SPOFs, unreachable nodes, topics without subscribers, missing DLQs, missing autoscaling) plus data-driven provider constraint checks. Click an issue to focus the node.
- **Scoring** - the 5×20-point interview-style rubric (scalability / availability / latency / cost / trade-offs), connectivity-aware: unwired components earn nothing.
- **Mermaid two-way sync** - every design serializes to mermaid `architecture-beta` text with `%% @meta` comments making the round-trip lossless (positions, configs, provider). Paste foreign architecture-beta text and it imports with icon-based component inference and auto-layout. Exported text renders in vanilla mermaid.
- **Persistence & sharing** - designs autosave to PostgreSQL scoped to an anonymous owner cookie. `Share` mints a read-only link (`/s/<slug>`) where visitors can still run simulations.

## Stack

Svelte 5 (runes) · SvelteKit 2 · @xyflow/svelte 1.6 · Tailwind v4 · PostgreSQL via postgres.js (pure JS, no native deps) · Docker Compose · vitest + fast-check.

## Development

Requires Node ≥ 22.5 and pnpm. **All installs skip lifecycle scripts** (`.npmrc` has `ignore-scripts=true`).

### Run with Docker (recommended)

```bash
docker compose up --build     # app on http://localhost:8090, Postgres on :5432
```

Designs persist in the `pgdata` volume. Health probe: `GET /api/health`.

### Develop bare-metal (app on host, DB in Docker)

```bash
docker compose up db -d       # Postgres only
pnpm install --ignore-scripts
pnpm dev                      # http://localhost:5173
pnpm test                     # unit tests; add TEST_DATABASE_URL=postgres://archsim:archsim@localhost:5432/archsim for the repo integration suite
pnpm check && pnpm build
pnpm gen-icons                # regenerate the offline icon bundle after editing provider mappings
```


| Env            | Default                                             | Purpose                                                   |
| -------------- | --------------------------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL` | `postgres://archsim:archsim@localhost:5432/archsim` | Postgres connection                                       |
| `ORIGIN`       | - (set in compose)                                  | adapter-node origin checking                              |
| `PORT`         | 3000 (container)                                    | listen port                                               |
| `OWNER_KEY`    | `local`                                             | single-user owner identity (local-by-design, no accounts) |

