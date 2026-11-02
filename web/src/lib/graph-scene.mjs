// Spatial index and bounded graph projection; no acquisition semantics.
export function indexScene(nodes, edges) {
  const values = [...nodes.values()]
  const bounds = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
  const tiles = new Map()
  for (const n of values) {
    bounds.x1 = Math.min(bounds.x1, n.x - (n.width ?? 160) / 2)
    bounds.x2 = Math.max(bounds.x2, n.x + (n.width ?? 160) / 2)
    bounds.y1 = Math.min(bounds.y1, n.y - (n.height ?? 120) / 2)
    bounds.y2 = Math.max(bounds.y2, n.y + (n.height ?? 120) / 2)
    const key = `${Math.floor(n.x / 512)},${Math.floor(n.y / 512)}`
    if (!tiles.has(key)) tiles.set(key, [])
    tiles.get(key).push(n)
  }
  if (!values.length) Object.assign(bounds, { x1: 0, y1: 0, x2: 1, y2: 1 })
  return { nodes, edges, bounds, tiles }
}

function visibleNodes(scene, extent, padding = 300) {
  const found = []
  for (
    let x = Math.floor((extent.x1 - padding) / 512);
    x <= Math.floor((extent.x2 + padding) / 512);
    x++
  ) {
    for (
      let y = Math.floor((extent.y1 - padding) / 512);
      y <= Math.floor((extent.y2 + padding) / 512);
      y++
    ) {
      for (const n of scene.tiles.get(`${x},${y}`) || [])
        if (
          n.x >= extent.x1 - padding &&
          n.x <= extent.x2 + padding &&
          n.y >= extent.y1 - padding &&
          n.y <= extent.y2 + padding
        )
          found.push(n)
    }
  }
  return found
}

export function renderSlice(scene, extent, zoom, maxNodes = 1200) {
  // Query the finite scene bounds even when users pan far outside the graph.
  const clipped = {
    x1: Math.max(extent.x1, scene.bounds.x1 - 100),
    y1: Math.max(extent.y1, scene.bounds.y1 - 100),
    x2: Math.min(extent.x2, scene.bounds.x2 + 100),
    y2: Math.min(extent.y2, scene.bounds.y2 + 100),
  }
  const candidates = visibleNodes(scene, clipped)
  if ((zoom < 0.35 && scene.nodes.size > 200) || candidates.length > maxNodes) {
    const buckets = new Map()
    let size = 40 / zoom
    let result
    do {
      buckets.clear()
      for (const n of candidates) {
        const key = `${Math.floor(n.x / size)},${Math.floor(n.y / size)}`
        if (!buckets.has(key))
          buckets.set(key, {
            id: `overview:${key}`,
            type: 'overview',
            x: 0,
            y: 0,
            count: 0,
          })
        const b = buckets.get(key)
        b.x += n.x
        b.y += n.y
        b.count++
      }
      result = [...buckets.values()].map((b) => ({
        ...b,
        x: b.x / b.count,
        y: b.y / b.count,
        label: String(b.count),
        size,
      }))
      size *= 2
    } while (result.length > maxNodes)
    return {
      nodes: result,
      edges: [],
      overview: true,
      omittedEdges: scene.edges.length,
    }
  }
  const ids = new Set(candidates.map((n) => n.id))
  const edges = scene.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  )
  return {
    nodes: candidates,
    edges: edges.slice(0, 3000),
    overview: false,
    omittedEdges: Math.max(0, edges.length - 3000),
  }
}
