import Disclosure from '../ui/Disclosure'
import Button from '../ui/Button'
import Field from '../ui/Field'
import { outcomeLabel } from '../../lib/acquisition-facts.mjs'
import { useEffect, useMemo, useState } from 'react'
import type { Method } from './AcquisitionMethods'
import {
  compareMethods,
  methodTraceLabels,
} from '../../lib/method-comparison.mjs'

const sessions = new WeakMap<object, Filters>()
type Filters = {
  query: string
  type: string
  sort: string
  tracing: string
  role: string
}
const empty: Filters = {
  query: '',
  type: '',
  sort: 'planned',
  tracing: '',
  role: '',
}
export function MethodChooser({
  methods,
  selected,
  choose,
  sessionKey,
}: {
  methods: Method[]
  selected: string
  choose: (id: string) => void
  sessionKey: object
}) {
  const [filters, setFilters] = useState(
    () => sessions.get(sessionKey) ?? empty,
  )
  useEffect(() => {
    sessions.set(sessionKey, filters)
  }, [sessionKey, filters])
  const change = (key: keyof Filters, value: string) =>
    setFilters((previous) => ({ ...previous, [key]: value }))
  const types = useMemo(
    () => [...new Set(methods.map((m) => m.type))].sort(),
    [methods],
  )
  const visible: Method[] = compareMethods(methods, filters)
  const groups =
    filters.sort === 'type'
      ? types
      : filters.sort === 'chance'
        ? [
            ...new Set(
              visible.map((m) => m.metrics?.outcome?.unit ?? 'Unknown trial'),
            ),
          ].sort()
        : Object.values(methodTraceLabels)
  const filtered = Boolean(
    filters.query || filters.type || filters.tracing || filters.role,
  )
  return (
    <>
      <h3 data-text-role="group-title">
        Acquisition methods · {methods.length}
      </h3>
      <input
        className="method-search"
        type="search"
        aria-label="Find an acquisition method"
        placeholder="Find a method…"
        value={filters.query}
        onChange={(e) => change('query', e.target.value)}
      />
      <div className="method-controls">
        <Field label={<>Compare by</>}>
          {(field) => (
            <select
              {...field}
              aria-label="Compare by"
              value={filters.sort}
              onChange={(e) => change('sort', e.target.value)}
            >
              <option value="planned">Planned first access</option>
              <option value="chance">Chance per attempt</option>
              <option value="fewest">Fewest graph steps</option>
              <option value="most">Most graph steps</option>
              <option value="type">Method type</option>
            </select>
          )}
        </Field>
        <Field label={<>Method type</>}>
          {(field) => (
            <select
              {...field}
              aria-label="Method type"
              value={filters.type}
              onChange={(e) => change('type', e.target.value)}
            >
              <option value="">All types</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type} · {methods.filter((m) => m.type === type).length}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Disclosure className="method-filters" summary={<>More filters</>}>
        <div className="method-controls">
          <Field label={<>Prerequisites</>}>
            {(field) => (
              <select
                {...field}
                aria-label="Prerequisites"
                value={filters.tracing}
                onChange={(e) => change('tracing', e.target.value)}
              >
                <option value="">All evidence</option>
                {Object.entries(methodTraceLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={<>Output role</>}>
            {(field) => (
              <select
                {...field}
                aria-label="Output role"
                value={filters.role}
                onChange={(e) => change('role', e.target.value)}
              >
                <option value="">All outputs</option>
                <option value="primary">Primary, non-conversion</option>
                <option value="conversion">Conversions</option>
                <option value="secondary">Secondary outputs</option>
              </select>
            )}
          </Field>
        </div>
      </Disclosure>
      <div className="method-results">
        <span role="status">
          {visible.length} of {methods.length} methods
        </span>
        {filtered && (
          <Button onClick={() => setFilters({ ...empty, sort: filters.sort })}>
            Clear filters
          </Button>
        )}
      </div>
      <Disclosure
        className="method-ranking-help"
        summary={<>How are methods compared?</>}
      >
        <p>
          Planned access prefers fewer opportunistic-source stages, then fewer
          stages with uncalculated odds, then fewer chance-based stages, then
          depth. Quality counts include prerequisite branches; shared earlier
          setup can count more than once. They are not resource or work budgets.
          This is an explicit planning preference, not a difficulty score.
        </p>
        <p>
          Chance compares eligible attempts within the same unit. Conditions and
          source availability still apply. Unknown odds stay unranked; a recipe
          execution and a chest search are not equivalent amounts of work.
        </p>
        <p>
          Depth is the longest prerequisite branch under the selected policy,
          plus this method. Parallel branch depths are not added together.
        </p>
        <p>
          First-supply routes are traced without any method that already
          produces this item. Existing-supply routes use the full graph and are
          compared in their own group. Missing prerequisites stay unranked.
        </p>
        <p>
          Fewest / most steps use earliest-possible prerequisite depths. Fewer
          steps can suggest an earlier route. They do not measure travel,
          rarity, quantities, machine setup or playtime. “Most” compares these
          minimum depths, not the longest possible chain.
        </p>
      </Disclosure>
      <div className="method-list" aria-label="Choose an acquisition method">
        {groups.map((group) => {
          const rows = visible.filter((m) =>
            filters.sort === 'type'
              ? m.type === group
              : filters.sort === 'chance'
                ? (m.metrics?.outcome?.unit ?? 'Unknown trial') === group
                : methodTraceLabels[m.metrics!.status] === group,
          )
          return rows.length ? (
            <section key={group}>
              <h4 data-text-role="caption">
                {group} · {rows.length}
              </h4>
              {rows.map((m) => (
                <Button
                  key={m.id}
                  data-method-id={m.id}
                  data-method-depth={
                    (['fewest', 'most'].includes(filters.sort)
                      ? m.metrics?.earliestDepth
                      : m.metrics?.depth) ?? 'unranked'
                  }
                  title={m.id}
                  aria-pressed={selected === m.id}
                  onClick={() => choose(m.id)}
                >
                  <span>{m.label}</span>
                  {methods.filter((other) => other.label === m.label).length >
                    1 && (
                    <small className="method-source">
                      {typeof m.route.source === 'string'
                        ? m.route.source
                        : m.id}
                    </small>
                  )}
                  <small>
                    {m.metrics?.depth !== null
                      ? `${(['fewest', 'most'].includes(filters.sort) ? m.metrics?.earliestDepth : m.metrics?.depth) ?? m.metrics?.depth} steps deep · ${m.metrics?.inputCount} required input${m.metrics?.inputCount === 1 ? '' : 's'}`
                      : m.metrics?.mappedDepth !== null
                        ? `${m.metrics?.mappedDepth} steps in full graph · existing supply`
                        : methodTraceLabels[m.metrics!.status]}
                    {' · '}
                    {outcomeLabel(m.metrics?.outcome)}
                    {m.secondary
                      ? ' · Secondary output'
                      : m.conversion
                        ? ' · Conversion'
                        : ''}
                    {m.route.scenario ? ' · Scenario' : ''}
                  </small>
                </Button>
              ))}
            </section>
          ) : null
        })}
        {!visible.length && <p>No matching methods.</p>}
      </div>
      {!visible.some((m) => m.id === selected) && (
        <p className="method-selection-note" data-text-role="caption">
          The selected method is outside these filters. Its details remain
          below.
        </p>
      )}
    </>
  )
}
