import Disclosure from '../ui/Disclosure'
import Button from '../ui/Button'
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  MarkerType,
  type NodeProps,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import '../../styles/graph.css'
import '../../styles/recipes.css'
import { indexScene, renderSlice } from '../../lib/graph-scene.mjs'
import { createMinimap } from '../../lib/minimap'
import {
  RecipeCard,
  ItemSlot,
  type RecipeState,
  type Catalog,
} from '../recipes/RecipeCard'

const GraphContext = createContext<any>(null)
const GraphNode = memo(function GraphNode({ id, data }: NodeProps) {
  const { catalog, recipes, inspect, recipeStates, select, center } =
    useContext(GraphContext)
  const n: any = data.record
  const [state, setState] = useState<RecipeState>(
    () => recipeStates.get(id) ?? {},
  )
  const save = (next: RecipeState) => {
    recipeStates.set(id, next)
    setState(next)
  }
  const recipe =
    n.route?.kind === 'recipe' ? recipes.get(n.route.id) : undefined
  return (
    <div
      className={`flow-node flow-${n.type}${data.detailed ? ' detailed' : ''}`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {n.type === 'overview' ? (
        <Button className="nodrag nopan" onClick={() => center(n.x, n.y, 0.7)}>
          {n.count} nodes
        </Button>
      ) : (
        <>
          <Button
            className="flow-node-title nodrag nopan"
            onClick={() => select(id)}
          >
            {n.label}
          </Button>
          {n.type === 'route' && !n.compact && data.detailed ? (
            <div className="flow-node-content nodrag nopan nowheel">
              {recipe ? (
                <RecipeCard
                  recipe={recipe}
                  catalog={catalog}
                  inspect={inspect}
                  state={state}
                  onState={save}
                />
              ) : (
                <>
                  <p>{n.route.detail ?? n.route.kind}</p>
                  <Disclosure summary={<>Conditions and source</>}>
                    <pre>{JSON.stringify(n.route, null, 2)}</pre>
                  </Disclosure>
                </>
              )}
            </div>
          ) : n.type === 'item' ? (
            <ItemSlot
              id={n.itemId || n.id}
              catalog={catalog}
              inspect={inspect}
            />
          ) : null}
          {n.type === 'group' && data.detailed && (
            <p className="muted">
              {n.alternatives.length > 1 ? 'ONE alternative' : 'Required input'}{' '}
              · inspect for choices
            </p>
          )}
        </>
      )}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  )
})
const nodeTypes = { atlas: GraphNode }

// Positions remain a projection of existing routes, never a second progression solver.
function cardScene(source: any) {
  const detailed = [...source.nodes.values()].some(
    (n: any) => n.type === 'route',
  )
  const nodeHeight = (n: any) =>
    n.type === 'route' && !n.compact
      ? n.route?.kind === 'recipe'
        ? 440
        : 180
      : 86
  const rows = new Map<number, number>()
  for (const n of source.nodes.values())
    rows.set(n.y, Math.max(rows.get(n.y) ?? 0, nodeHeight(n)))
  const positions = new Map<number, number>()
  let previous: number | undefined,
    previousHeight = 0,
    y = 0
  for (const [row, height] of [...rows].sort((a, b) => a[0] - b[0])) {
    if (previous !== undefined)
      y += Math.max(row - previous, (previousHeight + height) / 2 + 50)
    positions.set(row, y)
    previous = row
    previousHeight = height
  }
  const nodes = new Map(
    [...source.nodes].map(([id, n]: any) => [
      id,
      {
        ...n,
        x: n.x * (detailed ? 1.25 : 1),
        y: detailed ? positions.get(n.y) : n.y,
        width: n.type === 'route' && !n.compact ? 380 : 190,
        height: nodeHeight(n),
      },
    ]),
  )
  return { ...source, ...indexScene(nodes, source.edges) }
}
export type CanvasHandle = {
  fit: () => void
  reveal: (id: string) => void
  zoom: (factor: number) => void
  center: (x: number, y: number, zoom?: number) => void
}
type Props = {
  scene: any
  catalog: Catalog
  recipes: Map<string, any>
  inspect: (id: string) => void
  selected: string
  onSelect: (id: string) => void
  onEdge: (id: string) => void
  viewport: Viewport
  onViewport: (v: Viewport) => void
  canvasId?: string
  initialFraming?: 'route' | 'all'
  mode?: string
  controls: React.RefObject<CanvasHandle | null>
  recipeStates: Map<string, RecipeState>
}

function Canvas(props: Props) {
  const {
    scene: source,
    catalog,
    recipes,
    inspect,
    selected,
    onSelect,
    onEdge,
    viewport,
    onViewport,
    canvasId,
    initialFraming = 'route',
    mode,
    controls,
    recipeStates,
  } = props
  const scene = useMemo(() => cardScene(source), [source])
  const host = useRef<HTMLDivElement>(null),
    mini = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 }),
    [focused, setFocused] = useState('')
  const camera = useRef(viewport)
  camera.current = viewport
  const center = useCallback(
    (x: number, y: number, zoom = camera.current.zoom) =>
      onViewport({
        x: size.width / 2 - x * zoom,
        y: size.height / 2 - y * zoom,
        zoom,
      }),
    [onViewport, size],
  )
  const fit = useCallback(() => {
    if (!size.width || !size.height) return
    const b = scene.bounds
    center(
      (b.x1 + b.x2) / 2,
      (b.y1 + b.y2) / 2,
      Math.max(
        0.02,
        Math.min(
          1,
          (size.width - 60) / Math.max(1, b.x2 - b.x1),
          (size.height - 60) / Math.max(1, b.y2 - b.y1),
        ),
      ),
    )
  }, [scene, size, center])
  const zoom = useCallback(
    (factor: number) => {
      const v = camera.current
      center(
        (size.width / 2 - v.x) / v.zoom,
        (size.height / 2 - v.y) / v.zoom,
        Math.max(0.02, Math.min(2.5, v.zoom * factor)),
      )
    },
    [center, size],
  )
  useEffect(() => {
    controls.current = {
      fit,
      zoom,
      center,
      reveal: (id) => {
        const n = scene.nodes.get(id)
        if (n) center(n.x, n.y, 0.85)
      },
    }
    return () => {
      controls.current = null
    }
  }, [controls, fit, zoom, center, scene])
  useEffect(() => {
    let frame = 0
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      cancelAnimationFrame(frame)
      if (width && height)
        frame = requestAnimationFrame(() =>
          setSize((previous) =>
            previous.width === width && previous.height === height
              ? previous
              : { width, height },
          ),
        )
    })
    ro.observe(host.current!)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  const fitSource = useRef<any>(null)
  useEffect(() => {
    if (
      size.width &&
      size.height &&
      scene.nodes.size &&
      fitSource.current !== source &&
      (viewport as any).fit
    ) {
      fitSource.current = source
      const routes = [...scene.nodes.values()].filter(
        (n: any) => n.type === 'route',
      )
      if (
        initialFraming === 'route' &&
        routes.length &&
        (mode === 'routes' || !canvasId)
      ) {
        const target: any = routes.at(-1)
        center(
          target.x,
          target.y,
          Math.max(0.02, Math.min(0.85, (size.width - 48) / target.width)),
        )
      } else fit()
    }
  }, [source, fit, viewport, initialFraming])
  const keyboard = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      if (e.target !== host.current && e.target !== mini.current) return
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [100, 0],
        ArrowRight: [-100, 0],
        ArrowUp: [0, 100],
        ArrowDown: [0, -100],
      }
      if (moves[e.key]) {
        e.preventDefault()
        const [x, y] = moves[e.key]
        onViewport({
          ...camera.current,
          x: camera.current.x + x,
          y: camera.current.y + y,
        })
      } else if (['+', '=', '-', 'Home'].includes(e.key)) {
        e.preventDefault()
        e.key === 'Home' ? fit() : zoom(e.key === '-' ? 1 / 1.5 : 1.5)
      }
    },
    [onViewport, fit, zoom],
  )
  const extent = {
    x1: -viewport.x / viewport.zoom,
    y1: -viewport.y / viewport.zoom,
    x2: (size.width - viewport.x) / viewport.zoom,
    y2: (size.height - viewport.y) / viewport.zoom,
  }
  const slice = useMemo(() => {
    const start = performance.now(),
      s = renderSlice(scene, extent, viewport.zoom, 400)
    // A focused control must survive panning/culling until focus leaves it.
    if (
      focused &&
      scene.nodes.has(focused) &&
      !s.nodes.some((n: any) => n.id === focused)
    )
      s.nodes.push(scene.nodes.get(focused))
    return { ...s, projectionMs: performance.now() - start }
  }, [scene, viewport, size, focused])
  const detailed = viewport.zoom >= 0.55
  const nodeCache = useMemo(() => new Map<string, any>(), [scene])
  const definitions = useMemo(
    () =>
      slice.nodes.map((n: any) => {
        const expanded = detailed || focused === n.id,
          active = n.id === selected
        const previous = nodeCache.get(n.id)
        if (
          previous?.data.record === n &&
          previous.data.detailed === expanded &&
          previous.selected === active
        )
          return previous
        const width = n.width ?? 120,
          height = n.height ?? 60
        const definition = {
          id: n.id,
          type: 'atlas',
          position: { x: n.x - width / 2, y: n.y - height / 2 },
          width,
          height,
          measured: { width, height },
          handles: [
            {
              type: 'target',
              position: Position.Top,
              x: width / 2 - 3,
              y: -3,
              width: 6,
              height: 6,
            },
            {
              type: 'source',
              position: Position.Bottom,
              x: width / 2 - 3,
              y: height - 3,
              width: 6,
              height: 6,
            },
          ],
          data: { record: n, detailed: expanded },
          selected: active,
          style: { width, height },
          draggable: false,
          connectable: false,
        }
        if (n.type !== 'overview') nodeCache.set(n.id, definition)
        return definition
      }),
    [slice, detailed, selected, focused, nodeCache],
  )
  const edgeCache = useMemo(() => new Map<string, any>(), [scene])
  const edges = useMemo(
    () =>
      slice.edges.map((e: any) => {
        const previous = edgeCache.get(e.id)
        if (previous) return previous
        const definition = {
          ...e,
          type: 'smoothstep',
          label: e.label || undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke:
              e.type === 'alternative'
                ? 'var(--ink-muted)'
                : 'var(--color-action)',
            strokeDasharray: e.type === 'alternative' ? '5 5' : undefined,
          },
          ariaLabel: `${scene.nodes.get(e.source)?.label} to ${scene.nodes.get(e.target)?.label}`,
        }
        edgeCache.set(e.id, definition)
        return definition
      }),
    [slice, scene, edgeCache],
  )
  const clickNode = useCallback(
    (_: unknown, n: { id: string }) => onSelect(n.id),
    [onSelect],
  )
  const clickEdge = useCallback(
    (_: unknown, e: { id: string }) => onEdge(e.id),
    [onEdge],
  )
  const context = useMemo(
    () => ({
      catalog,
      recipes,
      inspect,
      recipeStates,
      select: onSelect,
      center,
    }),
    [catalog, recipes, inspect, recipeStates, onSelect, center],
  )
  const miniView = useRef<ReturnType<typeof createMinimap> | null>(null)
  useEffect(() => {
    const m = createMinimap(mini.current!, center, keyboard)
    miniView.current = m
    m.setScene(
      scene.bounds,
      [...scene.nodes.values()].map((n: any) => ({ x: n.x, y: n.y })),
    )
    m.draw(extent)
    return () => {
      miniView.current = null
      m.destroy?.()
    }
  }, [scene, center, keyboard])
  useEffect(() => {
    miniView.current?.draw(extent)
  }, [viewport, size])
  return (
    <GraphContext.Provider value={context}>
      <div className="flow-display">
        <div
          ref={host}
          id={canvasId}
          className={canvasId ? 'graph-canvas' : 'route-preview-canvas'}
          tabIndex={0}
          role="region"
          aria-label="Graph. Drag to pan; plus and minus zoom; arrow keys pan; Home fits."
          onKeyDown={keyboard}
          data-view={mode}
          data-mode={slice.overview ? 'overview' : 'detail'}
          data-rendered-nodes={definitions.length}
          data-scene-nodes={scene.nodes.size}
          data-rendered-edges={edges.length}
          data-zoom={viewport.zoom}
          data-pan-x={viewport.x}
          data-pan-y={viewport.y}
          data-render-ms={slice.projectionMs.toFixed(2)}
          onFocusCapture={(e) =>
            setFocused(
              (e.target as HTMLElement).closest<HTMLElement>(
                '.react-flow__node',
              )?.dataset.id || '',
            )
          }
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setFocused('')
          }}
        >
          <ReactFlow
            nodes={definitions}
            edges={edges}
            nodeTypes={nodeTypes}
            viewport={viewport}
            onViewportChange={onViewport}
            onNodeClick={clickNode}
            onEdgeClick={clickEdge}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesReconnectable={false}
            deleteKeyCode={null}
            minZoom={0.02}
            maxZoom={2.5}
            onlyRenderVisibleElements={false}
            autoPanOnNodeFocus={true}
            preventScrolling={true}
            ariaLabelConfig={{
              'node.a11yDescription.default':
                'Press Enter to inspect this node. Tab enters its controls.',
            }}
          />
        </div>
        <div className="flow-navigation">
          <p className="muted" role="status">
            {definitions.length} visible / {scene.nodes.size} nodes ·{' '}
            {edges.length} connections
            {slice.overview ? ' · zoom in for details' : ''}
            {slice.omittedEdges
              ? ' · connections omitted; source records remain available'
              : ''}
          </p>
          <canvas
            ref={mini}
            id={canvasId ? 'graph-minimap' : undefined}
            width={220}
            height={150}
            tabIndex={0}
            aria-label="Graph minimap. Click or drag to navigate; arrow keys pan."
          />
        </div>
      </div>
    </GraphContext.Provider>
  )
}
export function GraphCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
