import { useEffect, useRef, useState } from 'react'
import Field from '../ui/Field'
import Button from '../ui/Button'
import Feedback from '../ui/Feedback'
import Disclosure from '../ui/Disclosure'
import ObjectScene from './ObjectScene'
import type { ModelPreview } from '../../lib/model-preview'
import LayerStackEditor from './LayerStackEditor'
import {
  comparisonProfiles,
  type ObjectCatalogue,
  type ResourceObject,
  type ObjectScene as Scene,
} from '../../lib/object-resources'
import '../../styles/object-authoring.css'
import { requestJSON } from '../../lib/http'
import { objectLocation, writeObjectLocation } from '../../lib/object-location'

async function read(url: string) {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Preview request failed: ${response.status}`)
  return response.json()
}
export default function ObjectWorkbench() {
  const [inspectorFlow, setInspectorFlow] = useState(false)
  useEffect(() => {
    setInspectorFlow(
      new URLSearchParams(location.search).get('workbench') === 'inspector',
    )
  }, [])
  const stackRequest = useRef(0)
  const cameras = useRef(
    new Map<string, ReturnType<ModelPreview['cameraState']>>(),
  )
  const [refreshing, setRefreshing] = useState(false),
    [refreshStatus, setRefreshStatus] = useState('')
  const [editing, setEditing] = useState<'models' | 'textures'>()
  const [compact, setCompact] = useState(false),
    [browserOpen, setBrowserOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [previewToolsOpen, setPreviewToolsOpen] = useState(false)
  useEffect(() => {
    const query = matchMedia('(max-width:700px)')
    const update = () => setCompact(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const [catalogue, setCatalogue] = useState<ObjectCatalogue>(),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [origin, setOrigin] = useState(''),
    [kind, setKind] = useState(''),
    [source, setSource] = useState(''),
    [support, setSupport] = useState(''),
    [authored, setAuthored] = useState(''),
    [changed, setChanged] = useState(true)
  const [selected, setSelected] = useState(''),
    [caseId, setCase] = useState(''),
    [mode, setMode] = useState<'models' | 'textures'>('models'),
    [left, setLeft] = useState('native'),
    [right, setRight] = useState('pack')
  const [scenes, setScenes] = useState<(Scene | undefined)[]>([]),
    [sceneBusy, setBusy] = useState(false),
    [stackBusy, setStackBusy] = useState(false),
    [custom, setCustom] = useState<string[]>(),
    [customScene, setCustomScene] = useState<Scene>()
  const busy = sceneBusy || stackBusy
  useEffect(() => {
    let active = true
    read('/generated/objects/index.json')
      .then((data: ObjectCatalogue) => {
        if (!active) return
        setCatalogue(data)
        const params = new URLSearchParams(window.location.search)
        setSearch(params.get('find') ?? '')
        setOrigin(params.get('origin') ?? '')
        setKind(params.get('kind') ?? '')
        setSource(params.get('source') ?? '')
        setSupport(params.get('support') ?? '')
        setAuthored(params.get('authored') ?? '')
        setChanged(params.get('changed') !== 'all')
        const location = objectLocation(
          data,
          new URLSearchParams(window.location.search),
        )
        if (!location.entry || !location.variant) {
          setError(
            'No registered object previews. Refresh previews to build the catalogue.',
          )
          return
        }
        setSelected(location.entry.id)
        setCase(location.variant.id)
        setEditing(location.editor)
        setMode(location.mode)
        setLeft(location.left)
        setRight(location.right)
      })
      .catch((reason) => setError(String(reason)))
    return () => {
      active = false
    }
  }, [])
  const object = catalogue?.objects.find((entry) => entry.id === selected),
    variant =
      object?.cases.find((entry) => entry.id === caseId) ?? object?.cases[0]
  const options = object && variant ? comparisonProfiles(variant) : []
  useEffect(() => {
    if (!object || !variant) return
    writeObjectLocation(object, variant, editing)
    const available = comparisonProfiles(variant)
    if (!available.includes(left)) setLeft(available[0])
    if (!available.includes(right))
      setRight(available.find((id) => id !== 'native') ?? available[0])
    stackRequest.current++
    setCustomScene(undefined)
    setCustom(undefined)
  }, [selected, variant?.id])
  useEffect(() => {
    if (!variant) return
    let active = true
    setBusy(true)
    setError('')
    Promise.all(
      [left, right].map((profile) =>
        variant.previews[profile]?.url
          ? read(variant.previews[profile].url!)
          : Promise.resolve(undefined),
      ),
    )
      .then((result) => {
        if (active) setScenes(result)
      })
      .catch((reason) => {
        if (active) setError(String(reason))
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
  }, [variant, left, right])
  useEffect(() => {
    if (!object || !variant) return
    const url = new URL(location.href)
    for (const [key, value] of Object.entries({
      find: search,
      origin,
      kind,
      source,
      support,
      authored,
      changed: changed ? '' : 'all',
      artifact: mode === 'textures' ? 'textures' : '',
      a: left,
      b: right,
    })) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    history.replaceState(null, '', url)
  }, [
    search,
    origin,
    kind,
    source,
    support,
    authored,
    changed,
    mode,
    left,
    right,
  ])
  function closeEditor() {
    setEditing(undefined)
    window.dispatchEvent(new Event('resource-object-edit-close'))
    if (object && variant) writeObjectLocation(object, variant)
  }
  function edit(
    event: React.MouseEvent,
    kind: 'models' | 'textures',
    id: string,
  ) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    openSource(kind, id)
  }
  function openSource(kind: 'models' | 'textures', id: string) {
    const key = kind === 'models' ? 'recipe' : 'textureResource'
    const target = catalogue?.objects.find((entry) =>
      entry.cases.some((value) => value[key] === id),
    )
    const next = target?.cases.find((value) => value[key] === id)
    if (!target || !next) return
    writeObjectLocation(target, next, kind, true)
    setSelected(target.id)
    setCase(next.id)
    setEditing(kind)
  }
  useEffect(() => {
    if (!editing || !variant) return
    const id = editing === 'models' ? variant.recipe : variant.textureResource
    if (!id) {
      closeEditor()
      return
    }
    requestAnimationFrame(() =>
      window.dispatchEvent(
        new CustomEvent('resource-object-edit', {
          detail: { kind: editing, id },
        }),
      ),
    )
  }, [selected, variant?.id, editing])
  useEffect(() => {
    const request = (event: Event) => {
      const { kind, id } = (
        event as CustomEvent<{ kind: 'models' | 'textures'; id: string }>
      ).detail
      openSource(kind, id)
    }
    window.addEventListener('resource-object-edit-request', request)
    return () =>
      window.removeEventListener('resource-object-edit-request', request)
  }, [catalogue])
  useEffect(() => {
    if (!catalogue) return
    const update = () => {
      const next = objectLocation(
        catalogue,
        new URLSearchParams(location.search),
      )
      if (!next.entry || !next.variant) return
      if (editing && !next.editor)
        window.dispatchEvent(new Event('resource-object-edit-close'))
      const params = new URLSearchParams(location.search)
      setSearch(params.get('find') ?? '')
      setOrigin(params.get('origin') ?? '')
      setKind(params.get('kind') ?? '')
      setSource(params.get('source') ?? '')
      setSupport(params.get('support') ?? '')
      setAuthored(params.get('authored') ?? '')
      setChanged(params.get('changed') !== 'all')
      setSelected(next.entry.id)
      setCase(next.variant.id)
      setEditing(next.editor)
      setMode(next.mode)
      setLeft(next.left)
      setRight(next.right)
    }
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [catalogue, editing])

  async function previewLayers(names: string[]) {
    if (!object || !variant) return
    const request = ++stackRequest.current
    setStackBusy(true)
    setError('')
    try {
      const response = await fetch('/__atlas/objects/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          object: object.id,
          case: variant.id,
          layers: names,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Preview failed')
      if (request !== stackRequest.current) return
      setCustomScene(result)
      setCustom(names)
    } catch (reason) {
      if (request === stackRequest.current) setError(String(reason))
    } finally {
      setStackBusy(false)
    }
  }
  async function refresh(exportModels: boolean, download = false) {
    stackRequest.current++
    setCustomScene(undefined)
    setCustom(undefined)
    setRefreshing(true)
    setError('')
    setRefreshStatus(
      exportModels ? 'Exporting static models…' : 'Refreshing previews…',
    )
    try {
      if (download) await requestJSON('/__atlas/objects/inputs', {})
      if (exportModels) await requestJSON('/__atlas/objects/export', {})
      await requestJSON('/__atlas/objects/generate', {})
      setCatalogue(await read('/generated/objects/index.json'))
      setRefreshStatus(
        'Previews refreshed. Authored sources and installed instances were not changed.',
      )
    } catch (reason) {
      setError(String(reason))
      setRefreshStatus(String(reason))
    } finally {
      setRefreshing(false)
    }
  }
  function selectObject(entry: ResourceObject) {
    const next = entry.cases[0]
    if (!next) return
    setSelected(entry.id)
    setCase(next.id)
    setBrowserOpen(false)
    writeObjectLocation(entry, next, editing, true)
  }
  function selectCase(id: string) {
    const next = object?.cases.find((value) => value.id === id)
    if (!object || !next) return
    setCase(id)
    writeObjectLocation(object, next, editing, true)
  }
  function artifact(kind: 'models' | 'textures') {
    setMode(kind)
    if (!editing) return
    const id = kind === 'models' ? variant?.recipe : variant?.textureResource
    if (!id) {
      closeEditor()
      return
    }
    setEditing(kind)
    requestAnimationFrame(() =>
      window.dispatchEvent(
        new CustomEvent('resource-object-edit', { detail: { kind, id } }),
      ),
    )
  }

  if (!catalogue)
    return (
      <div className="object-authoring content-stack">
        <Feedback tone={error ? 'error' : 'neutral'}>
          {error || 'Loading resource objects…'}
        </Feedback>
        {error && (
          <div className="action-row">
            <Button disabled={refreshing} onClick={() => void refresh(false)}>
              Refresh previews
            </Button>
            <Button
              disabled={refreshing}
              onClick={() => void refresh(false, true)}
            >
              Fetch candidate inputs
            </Button>
          </div>
        )}
      </div>
    )
  const matches = catalogue.objects.filter(
    (entry) =>
      (!changed || entry.changed) &&
      (!origin || entry.origin.id === origin) &&
      (!kind || entry.kind === kind) &&
      (!source || entry.contributors.includes(source)) &&
      (!support || entry.supported === (support === 'supported')) &&
      (!authored ||
        entry.cases.some((value) =>
          authored === 'models'
            ? Boolean(value.recipe)
            : authored === 'approved'
              ? value.approval === 'approved'
              : authored === 'included'
                ? value.included
                : value.sourceEnabled,
        )) &&
      `${entry.label} ${entry.registryId} ${entry.contributors ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const current = scenes[0],
    comparison = customScene ?? scenes[1]
  const caseControl = object && variant && (
    <Field label="Object part / material case">
      {(attributes) => (
        <select
          {...attributes}
          value={variant.id}
          onChange={(event) => selectCase(event.target.value)}
        >
          {object.cases.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
  const editLinks = variant && (
    <div className="action-row">
      {variant.recipe && (
        <a
          href={`/resource-authoring?view=models&recipe=${encodeURIComponent(variant.recipe)}`}
          onClick={(event) => edit(event, 'models', variant.recipe!)}
        >
          Edit model
        </a>
      )}
      {variant.textureResource && (
        <a
          href={`/resource-authoring?view=textures&texture=${encodeURIComponent(variant.textureResource)}`}
          onClick={(event) => edit(event, 'textures', variant.textureResource!)}
        >
          Edit texture
        </a>
      )}
    </div>
  )
  const resourceContext = object && variant && (
    <>
      {(variant.recipe || variant.textureResource) && (
        <p data-text-role="caption">
          {[
            variant.sourceEnabled !== undefined
              ? `Model source ${variant.sourceEnabled ? 'enabled' : 'disabled'}`
              : '',
            variant.approval ? `Artwork: ${variant.approval}` : '',
            variant.included !== undefined
              ? `Artwork ${variant.included ? 'included in generated pack' : 'preview only'}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <details className="disclosure" open={!compact}>
        <summary>Effective resources</summary>
        <div className="content-stack object-provenance">
          {(comparison?.evidence ?? [])
            .filter((entry) => entry.winner)
            .map((entry) => (
              <details key={entry.path} className="disclosure">
                <summary>
                  <span>{entry.path}</span>
                  <small>{entry.winner}</small>
                </summary>
                <div className="content-stack">
                  <ol>
                    {entry.contributors.map((contributor) => (
                      <li key={contributor.id}>
                        <Button
                          disabled={busy}
                          onClick={() => {
                            const names =
                              custom ?? object.profiles[right]?.layers ?? []
                            const index = names.indexOf(contributor.id)
                            if (index >= 0)
                              void previewLayers(names.slice(0, index + 1))
                          }}
                        >
                          {contributor.label}
                        </Button>
                        <small title={contributor.sha256}>
                          {contributor.version
                            ? `${contributor.version} · `
                            : ''}
                          {contributor.sha256.slice(0, 12)}
                        </small>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            ))}
        </div>
      </details>
      <details className="disclosure">
        <summary>Comparison B layers</summary>
        <div className="content-stack">
          <LayerStackEditor
            layers={catalogue.layers}
            value={custom ?? object.profiles[right]?.layers ?? []}
            busy={busy}
            onPreview={(names) => void previewLayers(names)}
          />
        </div>
      </details>
      {Boolean(object.profiles[right]?.status) && (
        <p data-text-role="caption">
          <a href={object.profiles[right].url} target="_blank" rel="noreferrer">
            {object.profiles[right].version}
          </a>{' '}
          ·{' '}
          {object.profiles[right].status === 'selected'
            ? 'Selected features.'
            : object.profiles[right].status === 'defer'
              ? 'Deferred.'
              : 'Preview only.'}{' '}
          {object.profiles[right].note}
        </p>
      )}
      {(comparison?.notes ?? []).map((note) => (
        <p key={note} data-text-role="caption">
          {note}
        </p>
      ))}
    </>
  )
  const artifactPanel = object && variant && (
    <aside className="content-stack object-inspector">
      {caseControl}
      {editLinks}
      {resourceContext}
    </aside>
  )
  return (
    <div
      className="object-authoring content-stack"
      data-layout="a"
      data-flow={inspectorFlow ? 'inspector' : 'current'}
    >
      <div className="object-toolbar">
        <Field label="Find object">
          {(attributes) => (
            <input
              {...attributes}
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setBrowserOpen(true)
              }}
            />
          )}
        </Field>

        <div className="action-row">
          <Button
            disabled={refreshing || busy}
            onClick={() => void refresh(false)}
          >
            Refresh previews
          </Button>
          <Button
            aria-expanded={previewToolsOpen}
            aria-controls="object-preview-tools"
            onClick={() => setPreviewToolsOpen(!previewToolsOpen)}
          >
            Preview tools
          </Button>
        </div>
      </div>
      <div
        id="object-preview-tools"
        className="action-row"
        role="group"
        aria-label="Preview tools"
        hidden={!previewToolsOpen}
      >
        <Button
          disabled={refreshing || busy}
          onClick={() => void refresh(true)}
        >
          Export static models
        </Button>
        <Button
          disabled={refreshing || busy}
          onClick={() => void refresh(false, true)}
        >
          Fetch candidate inputs
        </Button>
      </div>
      <details
        className="disclosure object-filter-disclosure"
        open={filtersOpen}
        onToggle={(event) => {
          setFiltersOpen(event.currentTarget.open)
        }}
      >
        <summary>Filters</summary>
        <div className="object-filters">
          <Field label="Origin">
            {(attributes) => (
              <select
                {...attributes}
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
              >
                <option value="">All origins</option>
                {Array.from(
                  new Set(catalogue.objects.map((entry) => entry.origin.id)),
                )
                  .sort()
                  .map((id) => (
                    <option key={id}>{id}</option>
                  ))}
              </select>
            )}
          </Field>
          <Field label="Object kind">
            {(attributes) => (
              <select
                {...attributes}
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="">Blocks and mobs</option>
                <option value="block">Blocks</option>
                <option value="entity">Mobs</option>
              </select>
            )}
          </Field>
          <Field label="Change source">
            {(attributes) => (
              <select
                {...attributes}
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                <option value="">All contributors</option>
                {Array.from(
                  new Set(
                    catalogue.objects.flatMap((value) => value.contributors),
                  ),
                )
                  .sort()
                  .map((id) => (
                    <option key={id}>{id}</option>
                  ))}
              </select>
            )}
          </Field>
          <Field label="Preview support">
            {(attributes) => (
              <select
                {...attributes}
                value={support}
                onChange={(event) => setSupport(event.target.value)}
              >
                <option value="">Any support</option>
                <option value="supported">Some supported cases</option>
                <option value="unsupported">No supported cases</option>
              </select>
            )}
          </Field>
          <Field label="Authored work">
            {(attributes) => (
              <select
                {...attributes}
                value={authored}
                onChange={(event) => setAuthored(event.target.value)}
              >
                <option value="">All work</option>
                <option value="models">Editable models</option>
                <option value="enabled">Enabled model sources</option>
                <option value="approved">Approved artwork</option>
                <option value="included">Included artwork</option>
              </select>
            )}
          </Field>
          <label className="inline-field">
            <input
              type="checkbox"
              checked={changed}
              onChange={(event) => setChanged(event.target.checked)}
            />
            Known changes only
          </label>
        </div>
      </details>
      {refreshStatus && (
        <Feedback tone={error ? 'error' : 'neutral'} role="status">
          {refreshStatus}
        </Feedback>
      )}
      <div className="object-workspace">
        <details
          className="object-browser"
          open={!compact || browserOpen}
          onToggle={(event) => {
            if (compact) setBrowserOpen(event.currentTarget.open)
          }}
        >
          <summary>Browse objects · {matches.length}</summary>
          <div className="entry-list" aria-label="Resource objects">
            {matches.map((entry) => (
              <Button
                key={entry.id}
                aria-current={entry.id === selected}
                onClick={() => selectObject(entry)}
              >
                {entry.label}
                <small>
                  {entry.origin.id} · {entry.kind}
                  {!entry.supported ? ' · needs renderer' : ''}
                </small>
              </Button>
            ))}
          </div>
        </details>
        {object && variant && (
          <section className="content-stack object-detail">
            <header className="section-heading">
              <div>
                {editing && (
                  <Button onClick={closeEditor}>Back to object</Button>
                )}
                <h1 data-text-role="item-title">{object.label}</h1>
                <p data-text-role="caption">
                  {object.registryId} ·{' '}
                  {object.origin.kind === 'vanilla'
                    ? 'Minecraft'
                    : object.origin.id}
                </p>
              </div>
              <div
                className="action-row"
                role="group"
                aria-label="Object artifacts"
              >
                <Button
                  aria-pressed={
                    editing ? editing === 'models' : mode === 'models'
                  }
                  onClick={() => artifact('models')}
                >
                  Models
                </Button>
                <Button
                  aria-pressed={
                    editing ? editing === 'textures' : mode === 'textures'
                  }
                  onClick={() => artifact('textures')}
                >
                  Textures
                </Button>
              </div>
            </header>
            {error && <Feedback tone="error">{error}</Feedback>}
            {(!editing || !inspectorFlow) && (
              <div className="object-stage-controls">
                <Field label="Comparison A">
                  {(attributes) => (
                    <select
                      {...attributes}
                      value={left}
                      onChange={(event) => setLeft(event.target.value)}
                    >
                      {options.map((id) => (
                        <option key={id} value={id}>
                          {object.profiles[id].label}
                          {!variant.previews[id]?.supported
                            ? ' · unsupported'
                            : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Comparison B">
                  {(attributes) => (
                    <select
                      {...attributes}
                      value={right}
                      onChange={(event) => {
                        stackRequest.current++
                        setRight(event.target.value)
                        setCustomScene(undefined)
                        setCustom(undefined)
                      }}
                    >
                      {options.map((id) => (
                        <option key={id} value={id}>
                          {object.profiles[id].label}
                          {!variant.previews[id]?.supported
                            ? ' · unsupported'
                            : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            )}
            {(!editing || !inspectorFlow) &&
              [left, right].map(
                (profile, index) =>
                  !variant.previews[profile]?.supported && (
                    <Feedback key={index} tone="error">
                      {object.profiles[profile]?.label}:{' '}
                      {variant.previews[profile]?.reason}
                    </Feedback>
                  ),
              )}
            {editing ? (
              <div className="content-stack">
                <div className="action-row">
                  <span data-text-role="caption">
                    {editing === 'models'
                      ? 'Model source'
                      : 'Texture resources'}
                  </span>
                </div>
                {inspectorFlow ? (
                  <div className="object-edit-navigation">
                    {caseControl}
                    <div className="action-row">{editLinks}</div>
                  </div>
                ) : (
                  artifactPanel
                )}
                <div id="object-inline-editor" />
                {inspectorFlow && (
                  <Disclosure
                    className="object-context"
                    summary="Object resources"
                  >
                    <div className="object-inspector">{resourceContext}</div>
                  </Disclosure>
                )}
              </div>
            ) : (
              <div className="object-content">
                <ObjectScene
                  context={object.id + '/' + variant.id}
                  cameras={cameras.current}
                  left={current}
                  right={comparison}
                  loading={busy}
                  mode={mode}
                  leftLabel={object.profiles[left]?.label ?? left}
                  single={!customScene && left === right}
                  rightLabel={
                    customScene
                      ? 'Custom stack'
                      : (object.profiles[right]?.label ?? right)
                  }
                />
                {artifactPanel}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
