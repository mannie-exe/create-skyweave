import Disclosure from '../ui/Disclosure'
import Button from '../ui/Button'
import { outcomeLabel } from '../../lib/acquisition-facts.mjs'
import { useMemo, useRef, useState } from 'react'
import type { Viewport } from '@xyflow/react'
import { GraphCanvas, type CanvasHandle } from '../graph/GraphCanvas'
import { RecipeCard } from '../recipes/RecipeCard'
import { routeScene } from '../../lib/graph-views.mjs'
import { acquisitionMethods } from '../../lib/acquisition-methods.mjs'
import '../../styles/acquisition-methods.css'
import { MethodChooser } from './MethodChooser'
import {
  methodMetrics,
  methodTraceLabels,
} from '../../lib/method-comparison.mjs'

export type Method = {
  type: string
  metrics?: {
    planned?: any
    outcome?: any
    earliestDepth?: number | null
    depth: number | null
    mappedDepth: number | null
    status: keyof typeof methodTraceLabels
    inputCount: number
    prerequisites: any[]
  }
  id: string
  route: any
  index: number
  recipe?: any
  group: string
  label: string
  secondary: boolean
  conversion: boolean
}
const sessions = new WeakMap<object, { selected: string }>()
export default function AcquisitionMethods({
  detail,
  itemId,
  index,
  recipes,
  inspect,
  openProgression,
  roots = [],
  policy = 'planned',
}: {
  openProgression: () => void
  roots?: string[]
  policy?: string
  detail: any
  itemId: string
  index: any
  recipes: Map<string, any>
  inspect: (id: string) => void
}) {
  const baseMethods = useMemo<Method[]>(
    () =>
      acquisitionMethods(
        itemId,
        index.byOutput.get(itemId) ?? [],
        recipes,
        index.byId,
      ),
    [itemId, index, recipes],
  )
  const methods = useMemo<Method[]>(() => {
    if (!baseMethods.length) return []
    const metrics = methodMetrics(itemId, index.routes, roots)
    return baseMethods.map((method) => ({
      ...method,
      metrics: metrics.get(method.id),
    }))
  }, [baseMethods, itemId, index, roots])
  const initial =
    sessions.get(detail)?.selected ??
    (policy === 'earliest' ? detail.earliestPath : detail.path)?.find(
      (step: any) => step.id === itemId,
    )?.route
  const [selected, setSelected] = useState(
    methods.some((m) => m.id === initial) ? initial : (methods[0]?.id ?? ''),
  )
  const method = methods.find((m) => m.id === selected)
  function choose(id: string) {
    setSelected(id)
    sessions.set(detail, { selected: id })
  }
  if (!method)
    return (
      <section className="item-route">
        <h3 data-text-role="section-title">
          {detail.coverage?.status === 'unified'
            ? 'Unified variant'
            : detail.coverage?.status === 'excluded'
              ? 'Internal / creative'
              : 'No acquisition adapter'}
        </h3>
        {detail.coverage?.status === 'unified' ? (
          <p>
            New production uses{' '}
            <Button onClick={() => inspect(detail.coverage.canonical)}>
              {index.byId.get(detail.coverage.canonical)?.name ??
                detail.coverage.canonical}
            </Button>
            . Existing items retain their tags and recipe compatibility.
          </p>
        ) : (
          <p>
            {detail.coverage?.status === 'excluded'
              ? 'Classified as an operator, creative or internal item. Not counted as a missing survival route.'
              : 'No acquisition method is indexed. This is a map gap, not proof that the item is unobtainable.'}
          </p>
        )}
      </section>
    )
  return (
    <>
      <section
        className="item-route method-route"
        data-selected-method={method.id}
        aria-label="Selected method diagram"
      >
        <h3 data-text-role="section-title">{method.label}</h3>
        <p className="muted">
          {method.group} · {index.byId.get(itemId)?.name ?? itemId}
        </p>
        {method.conversion && (
          <p className="method-caution">
            Converts an existing material. A reverse crafting recipe is also
            indexed.
          </p>
        )}
        {method.secondary && (
          <p className="method-caution">
            This item is a secondary output. Check the recipe’s output weights
            and conditions.
          </p>
        )}
        <MethodDiagram
          key={method.id}
          method={method}
          index={index}
          recipes={recipes}
          inspect={inspect}
        />
        <p className="muted" data-text-role="caption">
          Direct inputs for this method. Select an ingredient to explore how to
          obtain it. Alternatives and operating requirements remain in the
          recipe details.
        </p>
        <Button id="view-item-route" onClick={openProgression}>
          Open item progression
        </Button>
        <p className="muted" data-text-role="caption">
          The{' '}
          {policy === 'earliest' ? 'earliest possible' : 'planned first-access'}{' '}
          path may use a different acquisition method.
        </p>
      </section>
      <section
        className="item-methods linked-methods"
        aria-label="Acquisition methods"
      >
        <MethodChooser
          methods={methods}
          selected={selected}
          choose={choose}
          sessionKey={detail}
        />
        <div className="method-detail" data-method-detail={method.id}>
          <h3 data-text-role="group-title">Selected method</h3>
          <p>{method.label}</p>
          {method.metrics && (
            <Disclosure
              className="method-evidence"
              summary={
                <>
                  {method.metrics.depth === null
                    ? methodTraceLabels[method.metrics.status]
                    : `${method.metrics.depth} graph steps deep`}{' '}
                  · comparison evidence
                </>
              }
            >
              <p>
                {method.metrics.depth === null
                  ? 'No independent depth is assigned. Review the missing prerequisites and other ways to obtain this item.'
                  : 'One independently traced alternative per required input; these branches may share earlier steps.'}
              </p>
              {method.metrics.planned && (
                <p>
                  Planned route: {method.metrics.planned.opportunities}{' '}
                  opportunistic-source branches,{' '}
                  {method.metrics.planned.unknowns} uncalculated-chance
                  branches, {method.metrics.planned.random} chance-based
                  branches. Shared prerequisites may repeat. Earliest possible
                  depth: {method.metrics.earliestDepth}.
                </p>
              )}
              <ul>
                {method.metrics.prerequisites.map((input, i) => (
                  <li key={i}>
                    {input.id ? (
                      <>
                        {index.byId.get(input.id)?.name ?? input.id} · depth{' '}
                        {input.depth}
                      </>
                    ) : (
                      <>
                        Input {i + 1} · no independent route
                        {input.alternatives.length
                          ? ` (${input.alternatives.map((id: string) => index.byId.get(id)?.name ?? id).join(', ')})`
                          : ' (empty input group)'}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
          <Disclosure
            className="method-facts"
            summary={
              <>
                {outcomeLabel(method.metrics?.outcome)} · yield and requirements
              </>
            }
          >
            {method.metrics?.outcome?.expectedCount != null && (
              <p>
                {Number(method.metrics.outcome.expectedCount.toFixed(3))}{' '}
                expected items per {method.metrics.outcome.unit}. This is an
                average, not a guaranteed batch.
              </p>
            )}
            {method.metrics?.outcome?.probability > 0 &&
              method.metrics?.outcome.probability < 1 && (
                <p>
                  About{' '}
                  {Number((1 / method.metrics?.outcome.probability).toFixed(2))}{' '}
                  eligible attempts on average for a success, assuming identical
                  independent trials. Finding sources and time between attempts
                  are not measured.
                </p>
              )}
            <ul>
              {method.metrics?.outcome?.assumptions?.map((text: string) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            <p>{method.route.facts?.supply}</p>
            {method.route.facts?.access && <p>{method.route.facts.access}</p>}
            {method.route.facts?.quantities?.length > 0 && (
              <Disclosure summary={<>Materials and setup</>}>
                <ul>
                  {method.route.facts.quantities.map((q: any, i: number) => (
                    <li key={i}>
                      {q.amount ?? '?'} {q.unit} ·{' '}
                      {q.alternatives
                        .map((id: string) => index.byId.get(id)?.name ?? id)
                        .join(' or ')}{' '}
                      · {q.role}
                    </li>
                  ))}
                </ul>
                <p>
                  Setup / operating requirements:{' '}
                  {method.route.facts.setup
                    .map((g: string[]) =>
                      g
                        .map((id) => index.byId.get(id)?.name ?? id)
                        .join(' or '),
                    )
                    .join('; ') || 'See source conditions'}
                  . Fuel, durability, stress and reusable tools need separate
                  operating budgets.
                </p>
              </Disclosure>
            )}
          </Disclosure>
          {method.recipe ? (
            <RecipeCard
              key={method.id}
              recipe={method.recipe}
              catalog={index.byId}
              inspect={inspect}
              typography="semantic"
            />
          ) : (
            <>
              <p>
                {method.route.detail ??
                  'Conditions are recorded with this method.'}
              </p>
              <Disclosure summary={<>Conditions and source</>}>
                <pre>{JSON.stringify(method.route, null, 2)}</pre>
              </Disclosure>
            </>
          )}
        </div>
      </section>
    </>
  )
}

function MethodDiagram({ method, index, recipes, inspect }: any) {
  const scene = useMemo(() => {
    const scene = routeScene(index, {
      route: method.route,
      index: method.index,
    })
    // Details remain beside the diagram; do not repeat a full recipe card here.
    for (const node of scene.nodes.values()) {
      if (node.type === 'route') {
        node.compact = true
        node.label = method.label
      } else if (node.type === 'group') {
        node.label =
          node.alternatives.length > 1
            ? 'Choose one'
            : node.alternatives.length
              ? 'Required'
              : 'Missing input'
      } else if (
        node.type === 'capability' &&
        node.itemId?.startsWith('atlas:')
      ) {
        node.label = node.itemId.slice(6).replaceAll('_', ' ')
      }
    }
    return scene
  }, [index, method])
  const [camera, setCamera] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
    fit: true,
  } as Viewport)
  const [selected, setSelected] = useState('')
  const controls = useRef<CanvasHandle | null>(null),
    states = useRef(new Map())
  const node = scene.nodes.get(selected)
  return (
    <>
      <div className="route-preview-controls">
        <Button onClick={() => controls.current?.fit()}>Fit</Button>
        <Button
          aria-label="Zoom route in"
          onClick={() => controls.current?.zoom(1.5)}
        >
          +
        </Button>
        <Button
          aria-label="Zoom route out"
          onClick={() => controls.current?.zoom(1 / 1.5)}
        >
          −
        </Button>
      </div>
      <GraphCanvas
        initialFraming="all"
        scene={scene}
        catalog={index.byId}
        recipes={recipes}
        inspect={inspect}
        selected={selected}
        onSelect={setSelected}
        onEdge={(id) => {
          const edge = scene.edges.find((e: any) => e.id === id)
          if (edge) setSelected(edge.target)
        }}
        viewport={camera}
        onViewport={setCamera}
        controls={controls}
        recipeStates={states.current}
      />
      {node?.type === 'group' && (
        <div className="method-alternatives">
          <p>Choose one of these alternatives:</p>
          {node.alternatives.map((id: string) => (
            <Button key={id} onClick={() => inspect(id)}>
              {index.byId.get(id)?.name ?? id}
            </Button>
          ))}
        </div>
      )}
      {(scene.hiddenChoices > 0 || scene.hiddenOutputs > 0) && (
        <p className="muted">
          Diagram omits {scene.hiddenChoices} alternatives and{' '}
          {scene.hiddenOutputs} outputs. Inspect input groups and the source
          record for all entries.
        </p>
      )}
    </>
  )
}
