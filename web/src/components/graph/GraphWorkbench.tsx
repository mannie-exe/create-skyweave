import Disclosure from '../ui/Disclosure'
import Button from '../ui/Button'
import ViewTabs from '../ui/ViewTabs'
import Field from '../ui/Field'
import Feedback from '../ui/Feedback'
import { policies } from '../../lib/progression.mjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Viewport } from '@xyflow/react'
import { GraphCanvas, type CanvasHandle } from './GraphCanvas'
import { RecipeCard, type RecipeState } from '../recipes/RecipeCard'
import { routeData } from '../../lib/route-data'
import { requestJSON } from '../../lib/http'
import { detailBucket } from '../../lib/graph.mjs'
import { safeIcon } from '../../lib/recipe-view.mjs'
import {
  graphIndex,
  systemsScene,
  processingScene,
  coverageScene,
  routeScene,
  pathScene,
} from '../../lib/graph-views.mjs'
import {
  registerGraph,
  inspectGraphItem as inspect,
} from '../../lib/atlas-graph'
const initialCamera = () => ({ x: 0, y: 0, zoom: 1, fit: true })
const questions: Record<string, string> = {
  systems:
    'Possible cross-mod inputs → outputs. Connection counts are contributing routes, not mandatory dependencies.',
  processing:
    'Separate possible routes for a machine. Power, heat and plumbing remain separate requirements.',
  routes:
    'Top to bottom: potential acquisition under the selected policy. ALL input groups are required; dashed inputs are OR choices. Depth is not time or a production budget.',
  coverage: 'Mapping coverage, not confirmed gameplay failures.',
}
export default function GraphWorkbench() {
  const [bundle, setBundle] = useState<any>(null),
    [error, setError] = useState(''),
    [mode, setMode] = useState('systems'),
    [mod, setMod] = useState('create'),
    [status, setStatus] = useState('unmapped'),
    [cap, setCap] = useState(12)
  const [policy, setPolicy] = useState('planned')
  const [item, setItem] = useState('reliable_gliders:glider'),
    [machine, setMachine] = useState('create:mechanical_press'),
    [direction, setDirection] = useState('acquisition'),
    [path, setPath] = useState(false),
    [routeId, setRouteId] = useState(''),
    [query, setQuery] = useState(''),
    [limit, setLimit] = useState(100),
    [selectionLimit, setSelectionLimit] = useState(100)
  const [selection, setSelection] = useState<{ node?: string; edge?: string }>(
      {},
    ),
    [detail, setDetail] = useState<any>(null),
    [camera, setCamera] = useState<Viewport>(initialCamera)
  const controls = useRef<CanvasHandle | null>(null),
    cameras = useRef(new Map<string, Viewport>()),
    selections = useRef(new Map<string, { node?: string; edge?: string }>()),
    recipeStates = useRef(new Map<string, RecipeState>()),
    details = useRef(new Map<string, any>())
  const load = useCallback(async (refresh = false) => {
    setError('')
    try {
      const [catalog, data, authored] = await Promise.all([
        requestJSON('/generated/catalog.json'),
        routeData(refresh),
        requestJSON('/generated/authored.json'),
      ])
      details.current.clear()
      setBundle({
        index: graphIndex(
          catalog.nodes,
          data.routes,
          authored.progression?.machines || {},
        ),
        recipes: new Map(data.recipes.map((r: any) => [r.id, r])),
      })
    } catch (e) {
      setError(String(e))
    }
  }, [])
  const switchMode = useCallback(
    (next: string) => {
      cameras.current.set(mode, camera)
      selections.current.set(mode, selection)
      setMode(next)
      setCamera(cameras.current.get(next) ?? initialCamera())
      setSelection(selections.current.get(next) ?? {})
      setLimit(100)
    },
    [mode, camera, selection],
  )
  const openItem = useCallback(
    (id: string, fullPath = false, nextPolicy?: string) => {
      if (nextPolicy) setPolicy(nextPolicy)
      setItem(id)
      setPath(fullPath)
      setDirection('acquisition')
      setRouteId('')
      setMode('routes')
      setCamera(initialCamera())
      setSelection({})
    },
    [],
  )
  useEffect(() => {
    registerGraph({ load, openItem })
  }, [load, openItem])
  useEffect(() => setSelectionLimit(100), [selection, mode, machine])
  const index = bundle?.index,
    recipes = bundle?.recipes
  useEffect(() => {
    if (!index) return
    if (!index.byId.has(item)) setItem(index.items[0]?.id ?? '')
    if (!index.machines.has(machine))
      setMachine(([...index.machines][0] as string) || '')
    if (!index.items.some((n: any) => n.mod === mod))
      setMod(index.items[0]?.mod ?? '')
  }, [index])
  useEffect(() => {
    let active = true
    setDetail(null)
    if (index && mode === 'routes' && path) {
      const n = index.byId.get(item),
        key = `${n?.mod ?? item.split(':')[0]}/${detailBucket(item)}`
      const read = details.current.has(key)
        ? Promise.resolve(details.current.get(key))
        : requestJSON(`/generated/details/${key}.json`)
      void read
        .then((d) => {
          details.current.set(key, d)
          if (active)
            setDetail({
              ...(d[item] ?? {}),
              path:
                policy === 'earliest' ? d[item]?.earliestPath : d[item]?.path,
            })
        })
        .catch((e) => {
          if (active) setError(String(e))
        })
    }
    return () => {
      active = false
    }
  }, [index, item, path, mode, policy])
  const entries = useMemo(
    () =>
      index
        ? (direction === 'uses' ? index.byInput : index.byOutput).get(item) ||
          []
        : [],
    [index, direction, item],
  )
  const entry = entries.find((e: any) => e.route.id === routeId) ?? entries[0]
  const scene = useMemo(() => {
    if (!index) return null
    const source =
      mode === 'systems'
        ? systemsScene(index, mod, cap)
        : mode === 'coverage'
          ? coverageScene(index, status, cap)
          : mode === 'processing'
            ? processingScene(index, machine, Math.ceil(cap / 2))
            : path
              ? pathScene(index, detail?.path ?? [])
              : routeScene(index, entry)
    return {
      hiddenChoices: 0,
      hiddenOutputs: 0,
      hiddenSteps: 0,
      missingRoutes: 0,
      totalNeighbors: 0,
      shownNeighbors: 0,
      entries: [] as any[],
      ...source,
    }
  }, [index, mode, mod, cap, status, machine, path, detail, entry])
  const matches = useMemo(
    () =>
      !index
        ? []
        : mode === 'processing'
          ? [...index.machines].map((id: any) => index.byId.get(id))
          : mode === 'systems'
            ? index.items.filter((n: any) => n.mod === mod)
            : mode === 'coverage'
              ? index.items.filter((n: any) => n.status === status)
              : index.items,
    [index, mode, mod, status],
  )
  const filtered = useMemo(
    () =>
      matches.filter((n: any) =>
        `${n.id} ${n.name}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [matches, query],
  )
  const selectNode = useCallback(
      (id: string) => setSelection({ node: id }),
      [],
    ),
    selectEdge = useCallback((id: string) => setSelection({ edge: id }), [])
  const openRoute = (e: any) => {
    setPath(false)
    setDirection('acquisition')
    setItem(e.route.outputs.find((id: string) => index.byId.has(id)) || item)
    setRouteId(e.route.id)
    setMode('routes')
    setSelection({})
    setCamera(initialCamera())
  }
  const change = (action: () => void) => {
    action()
    setSelection({})
    setCamera(initialCamera())
  }
  if (!bundle || !scene)
    return (
      <div>
        <Feedback role="status" tone={error ? 'error' : 'neutral'}>
          {error || 'Loading graph data…'}
        </Feedback>
        {error && (
          <Button onClick={() => void load(true)}>Retry loading graph</Button>
        )}
      </div>
    )
  const node = scene.nodes.get(selection.node),
    edge = scene.edges.find((e: any) => e.id === selection.edge),
    selectedRecipe = recipes.get(
      node?.route?.id ?? (mode === 'routes' && !path ? entry?.route.id : ''),
    )
  const selectedEntries =
    edge?.entries ?? (mode === 'processing' && !node ? scene.entries : [])
  const title = edge?.entries
    ? 'Contributing routes'
    : (node?.label ??
      (mode === 'routes' ? index.byId.get(item)?.name : 'Selection'))
  const record =
    node?.route ??
    (node?.alternatives
      ? { alternatives: node.alternatives }
      : (edge ??
        (mode === 'routes'
          ? path
            ? Object.fromEntries(
                (detail?.path ?? [])
                  .filter((step: any) => step.route)
                  .map((step: any) => [
                    step.route,
                    index.byRoute.get(step.route)?.route,
                  ]),
              )
            : entry?.route
          : undefined)))
  const counts =
    mode === 'systems'
      ? `${scene.shownNeighbors} / ${scene.totalNeighbors} connected mods · all ${index.routes.length.toLocaleString()} modeled routes considered`
      : mode === 'coverage'
        ? `${matches.length.toLocaleString()} ${status} items · ${scene.shownNeighbors} / ${scene.totalNeighbors} namespaces shown`
        : mode === 'processing'
          ? `${index.byId.get(machine)?.name || 'No modeled machines'} · ${scene.entries.length} routes`
          : path
            ? `${policies[policy as keyof typeof policies]} · ${detail?.path?.length ?? 0} steps · ${scene.hiddenChoices} other choices${scene.hiddenSteps ? ` · ${scene.hiddenSteps} earlier steps omitted` : ''}${scene.missingRoutes ? ` · ${scene.missingRoutes} missing route records` : ''}`
            : entry
              ? `${entry.route.id}${entry.route.scenario ? ' · SCENARIO' : ''} · ${scene.hiddenChoices} alternatives in group details${scene.hiddenOutputs ? ` · ${scene.hiddenOutputs} outputs in source record` : ''}`
              : 'No modeled route in this direction. This is not proof of unobtainability.'
  return (
    <div className="flow-workspace">
      <ViewTabs label="Graph questions">
        {['systems', 'processing', 'routes', 'coverage'].map((m) => (
          <Button
            key={m}
            data-graph={m}
            aria-pressed={mode === m}
            onClick={() => switchMode(m)}
          >
            {m === 'routes' ? 'Item routes' : m[0].toUpperCase() + m.slice(1)}
          </Button>
        ))}
      </ViewTabs>
      <div className="toolbar">
        {mode === 'systems' && (
          <Field label={<>System </>} id="graph-mod" layout="inline">
            {(attributes) => (
              <select
                {...attributes}
                id="graph-mod"
                value={mod}
                onChange={(e) => change(() => setMod(e.target.value))}
              >
                {[...new Set<string>(index.items.map((n: any) => n.mod))]
                  .sort()
                  .map((m) => (
                    <option key={m}>{m}</option>
                  ))}
              </select>
            )}
          </Field>
        )}
        {mode === 'coverage' && (
          <Field label={<>Coverage </>} id="graph-status" layout="inline">
            {(attributes) => (
              <select
                {...attributes}
                id="graph-status"
                value={status}
                onChange={(e) => change(() => setStatus(e.target.value))}
              >
                {['unmapped', 'blocked', 'excluded', 'unified', 'mapped'].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            )}
          </Field>
        )}
        {mode !== 'routes' && (
          <Field label={<>Connections </>} id="graph-limit" layout="inline">
            {(attributes) => (
              <select
                {...attributes}
                id="graph-limit"
                value={cap}
                onChange={(e) => change(() => setCap(Number(e.target.value)))}
              >
                <option value={12}>Top 12</option>
                <option value={24}>Top 24</option>
                <option value={1000}>All</option>
              </select>
            )}
          </Field>
        )}
        <div className="flow-actions">
          <Button id="graph-fit" onClick={() => controls.current?.fit()}>
            Fit
          </Button>
          <Button
            id="graph-reset"
            onClick={() => {
              setQuery('')
              setCamera(initialCamera())
              controls.current?.fit()
            }}
          >
            Reset view
          </Button>
          <Button
            id="graph-in"
            aria-label="Zoom graph in"
            onClick={() => controls.current?.zoom(1.5)}
          >
            +
          </Button>
          <Button
            id="graph-out"
            aria-label="Zoom graph out"
            onClick={() => controls.current?.zoom(1 / 1.5)}
          >
            −
          </Button>
          <Button id="graph-reload" onClick={() => void load(true)}>
            Reload data
          </Button>
        </div>
      </div>
      <p id="graph-question" className="muted">
        {questions[mode]}
      </p>
      {mode === 'routes' && (
        <div className="toolbar">
          <strong id="graph-item-title">
            {index.byId.get(item)?.name ?? item}
          </strong>
          <select
            id="graph-route-view"
            aria-label="Route view"
            value={path ? 'path' : 'single'}
            onChange={(e) => change(() => setPath(e.target.value === 'path'))}
          >
            <option value="single">Single route</option>
            <option value="path">Item progression</option>
          </select>
          <select
            aria-label="Graph progression policy"
            value={policy}
            disabled={!path}
            onChange={(e) => change(() => setPolicy(e.target.value))}
          >
            {Object.entries(policies).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            id="graph-relation"
            aria-label="Route direction"
            disabled={path}
            value={direction}
            onChange={(e) =>
              change(() => {
                setDirection(e.target.value)
                setRouteId('')
              })
            }
          >
            <option value="acquisition">Acquisition</option>
            <option value="uses">Uses</option>
          </select>
          <select
            id="graph-recipe"
            aria-label="Displayed route"
            disabled={path || !entries.length}
            value={entry?.route.id ?? ''}
            onChange={(e) => change(() => setRouteId(e.target.value))}
          >
            {entries.map((e: any, i: number) => (
              <option key={`${e.index}`} value={e.route.id}>
                {i + 1}/{entries.length} · {e.route.kind}: {e.route.id}
              </option>
            ))}
          </select>
          <Button id="graph-inspect" onClick={() => inspect(item)}>
            Item details
          </Button>
        </div>
      )}
      <p id="graph-counts" className="muted" role="status">
        {error || counts}
      </p>
      <div className="flow-workbench">
        <section className="panel flow-sidebar" aria-label="Graph items">
          <h2>{mode === 'processing' ? 'Machines' : 'Items'}</h2>
          <input
            id="graph-search"
            type="search"
            aria-label="Search graph items"
            placeholder="Find an item…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(100)
            }}
          />
          <p className="muted">{filtered.length.toLocaleString()} items</p>
          <div id="graph-results" className="graph-results">
            {filtered.slice(0, limit).map((n: any) => (
              <Button
                key={n.id}
                data-item={n.id}
                aria-current={
                  mode === 'processing'
                    ? machine === n.id
                    : mode === 'routes' && item === n.id
                }
                onClick={() =>
                  mode === 'processing'
                    ? change(() => setMachine(n.id))
                    : openItem(n.id)
                }
              >
                {safeIcon(n.icon) && <img src={n.icon} alt="" loading="lazy" />}
                {n.name}
              </Button>
            ))}
          </div>
          {filtered.length > limit && (
            <Button id="graph-more" onClick={() => setLimit((n) => n + 100)}>
              Show more
            </Button>
          )}
        </section>
        <div className="flow-main">
          <GraphCanvas
            scene={scene}
            catalog={index.byId}
            recipes={recipes}
            inspect={inspect}
            selected={selection.node ?? ''}
            onSelect={selectNode}
            onEdge={selectEdge}
            viewport={camera}
            onViewport={setCamera}
            canvasId="graph-canvas"
            mode={mode}
            controls={controls}
            recipeStates={recipeStates.current}
          />
          <div className="flow-record-controls">
            <Field label={<>Inspect node</>} id="graph-node">
              {(attributes) => (
                <select
                  {...attributes}
                  id="graph-node"
                  aria-label="Inspect graph node"
                  value={selection.node ?? ''}
                  onChange={(e) => {
                    selectNode(e.target.value)
                    controls.current?.reveal(e.target.value)
                  }}
                >
                  <option value="">Choose a node…</option>
                  {[...scene.nodes.values()].map((n: any) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={<>Inspect connection</>} id="graph-edge">
              {(attributes) => (
                <select
                  {...attributes}
                  id="graph-edge"
                  aria-label="Inspect graph connection"
                  value={selection.edge ?? ''}
                  onChange={(e) => selectEdge(e.target.value)}
                >
                  <option value="">Choose a connection…</option>
                  {scene.edges.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {scene.nodes.get(e.source)?.label} →{' '}
                      {scene.nodes.get(e.target)?.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <section
            className="panel flow-selection"
            aria-label="Graph selection"
          >
            <h2 id="graph-selection-title">{title}</h2>
            <p id="graph-selection-summary">
              {edge?.entries
                ? `${edge.entries.length} routes mention this connection.`
                : node?.type === 'group'
                  ? 'Choose ONE alternative. ALL input groups are required.'
                  : node?.type === 'capability'
                    ? 'Modeled environmental requirement; inspect its source and conditions.'
                    : 'Inspect records and conditions; a route is potential access.'}
            </p>
            <div id="graph-route-list" className="graph-results">
              {node?.type === 'item' && (
                <>
                  <Button onClick={() => inspect(node.itemId || node.id)}>
                    Item details
                  </Button>
                  <Button onClick={() => openItem(node.itemId || node.id)}>
                    Trace acquisition
                  </Button>
                </>
              )}
              {node?.alternatives
                ?.slice(0, selectionLimit)
                .map((id: string) => (
                  <Button key={id} onClick={() => inspect(id)}>
                    {index.byId.get(id)?.name ?? id}
                  </Button>
                ))}
              {selectedEntries.slice(0, selectionLimit).map((e: any) => (
                <Button key={e.index} onClick={() => openRoute(e)}>
                  {e.route.kind}: {e.route.id}
                </Button>
              ))}
              {Math.max(
                selectedEntries.length,
                node?.alternatives?.length ?? 0,
              ) > selectionLimit && (
                <Button onClick={() => setSelectionLimit((n) => n + 100)}>
                  Show more choices
                </Button>
              )}
            </div>
            <div id="graph-recipe-preview">
              {selectedRecipe && (
                <RecipeCard
                  recipe={selectedRecipe}
                  catalog={index.byId}
                  inspect={inspect}
                />
              )}
            </div>
            {record && (
              <Disclosure id="graph-record" summary={<>Selection data</>}>
                <pre id="graph-selection-data">
                  {JSON.stringify(record, null, 2)}
                </pre>
              </Disclosure>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
