import type {
  NetworkEdgeState,
  NetworkNodeState,
  TraceForest,
  TraceNetwork,
  TraceNetworkEdge,
  TraceNetworkNode,
} from "../types";

/** Graphs that fit on screen (and stay readable on a phone). */
export const MAX_NETWORK_NODES = 7;

/**
 * A directed graph the traces mark up step by step: node states and badges, edge states. Nodes keep the spots the
 * trace gave them, so nothing moves between scenes. Edge states set in one step (`new`, `better`, `worse`) are
 * cleared by `snapshot()`; `used` edges stay used.
 */
export class Network {
  readonly nodes: TraceNetworkNode[];
  readonly edges: TraceNetworkEdge[] = [];

  constructor(
    nodes: { label: string; x: number; y: number }[],
    readonly directed = true,
  ) {
    this.nodes = nodes.map((n, id) => ({ id, ...n, state: "idle" }));
  }

  /** The graph as given: every node and edge idle, no badges. */
  given(): TraceNetwork {
    return {
      directed: this.directed,
      nodes: this.nodes.map(({ id, label, x, y }) => ({ id, label, x, y, state: "idle" })),
      edges: this.edges.map(({ from, to, weight }) => ({
        from,
        to,
        ...(weight !== undefined ? { weight } : {}),
        state: "idle",
      })),
    };
  }

  addEdge(from: number, to: number, weight?: number, state: NetworkEdgeState = "idle"): TraceNetworkEdge {
    const edge: TraceNetworkEdge = { from, to, ...(weight !== undefined ? { weight } : {}), state };
    this.edges.push(edge);
    return edge;
  }

  edge(from: number, to: number): TraceNetworkEdge {
    return this.edges.find((e) => e.from === from && e.to === to)!;
  }

  out(id: number): TraceNetworkEdge[] {
    return this.edges.filter((e) => e.from === id);
  }

  setState(id: number, state: NetworkNodeState) {
    this.nodes[id].state = state;
  }

  state(id: number): NetworkNodeState {
    return this.nodes[id].state;
  }

  setBadge(id: number, badge: string | undefined) {
    if (badge === undefined) delete this.nodes[id].badge;
    else this.nodes[id].badge = badge;
  }

  /** The graph now; then clear this step's edge marks (`used` edges stay used). */
  snapshot(): TraceNetwork {
    const shot: TraceNetwork = {
      directed: this.directed,
      nodes: this.nodes.map((n) => ({ ...n })),
      edges: this.edges.map((e) => ({ ...e })),
    };
    for (const e of this.edges) if (e.state !== "used") e.state = "idle";
    return shot;
  }
}

/**
 * Union-find the traces drive exactly like the reference solutions: `find` does path halving
 * (`parent[x] = parent[parent[x]]`), recording the chain it walked and the links it rewired; `union` (by size when
 * `bySize`) points one root at the other. `snapshot()` reports the forest and this step's work, then clears it.
 */
export class Forest {
  readonly parents: number[];
  readonly sizes: number[] | undefined;
  private finds: { path: number[] }[] = [];
  private compressed: { node: number; from: number; to: number }[] = [];
  private joined: { child: number; parent: number } | undefined;
  private shared: number | undefined;

  constructor(
    readonly labels: string[],
    bySize: boolean,
  ) {
    this.parents = labels.map((_, i) => i);
    this.sizes = bySize ? labels.map(() => 1) : undefined;
  }

  find(x: number): number {
    // The chain as it stands before halving rewires it.
    const path = [x];
    for (let y = x; this.parents[y] !== y; y = this.parents[y]) path.push(this.parents[y]);
    while (this.parents[x] !== x) {
      const grand = this.parents[this.parents[x]];
      if (grand !== this.parents[x]) this.compressed.push({ node: x, from: this.parents[x], to: grand });
      this.parents[x] = grand;
      x = grand;
    }
    this.finds.push({ path });
    return x;
  }

  /** Point root `child` at root `parent`. */
  link(child: number, parent: number) {
    this.parents[child] = parent;
    if (this.sizes) this.sizes[parent] += this.sizes[child];
    this.joined = { child, parent };
  }

  /** Two elements already share root `root`. */
  same(root: number) {
    this.shared = root;
  }

  snapshot(): TraceForest {
    const shot: TraceForest = {
      labels: [...this.labels],
      parents: [...this.parents],
      ...(this.sizes ? { sizes: [...this.sizes] } : {}),
      ...(this.finds.length ? { finds: this.finds } : {}),
      ...(this.compressed.length ? { compressed: this.compressed } : {}),
      ...(this.joined ? { union: this.joined } : {}),
      ...(this.shared !== undefined ? { same: this.shared } : {}),
    };
    this.finds = [];
    this.compressed = [];
    this.joined = undefined;
    this.shared = undefined;
    return shot;
  }
}

/**
 * Spots for a directed graph's nodes: columns by hops from `roots` (breadth-first; nodes reached only later go in
 * the next column), nodes in a column ordered by id and centered on the tallest column. Every arrow along a hop then
 * points right; the drawing curves the rest. Nodes with no edges at all get a row of their own underneath, left to
 * right, so they don't stretch a column.
 */
export function layers(n: number, edges: [number, number][], roots: number[]): { x: number; y: number }[] {
  const linked = new Set(edges.flat());
  const lone = Array.from({ length: n }, (_, i) => i).filter((i) => !linked.has(i));
  const col = new Array<number>(n).fill(-1);
  const queue = roots.filter((r) => linked.has(r));
  for (const r of queue) col[r] = 0;
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    for (const [from, to] of edges)
      if (from === u && col[to] < 0) {
        col[to] = col[u] + 1;
        queue.push(to);
      }
  }
  const last = Math.max(0, ...col);
  for (let i = 0; i < n; i++) if (col[i] < 0 && linked.has(i)) col[i] = last + 1;
  const columns = new Map<number, number[]>();
  for (let i = 0; i < n; i++) if (linked.has(i)) columns.set(col[i], [...(columns.get(col[i]) ?? []), i]);
  const tallest = Math.max(0, ...[...columns.values()].map((c) => c.length));
  const spot: { x: number; y: number }[] = [];
  for (const [x, ids] of columns)
    ids.forEach((id, k) => (spot[id] = { x, y: (tallest - ids.length) / 2 + k }));
  lone.forEach((id, k) => (spot[id] = { x: k, y: tallest }));
  return spot;
}
