import { createRoot } from 'react-dom/client'
import AcquisitionMethods from '../components/map/AcquisitionMethods'
import { requestJSON } from './http'
import { routeData, routeIndex } from './route-data'
import { filterRoots } from './availability.mjs'
export async function mountAcquisition(
  host: HTMLElement,
  items: any[],
  detail: any,
  itemId: string,
  inspect: (id: string) => void,
  openProgression: () => void,
  dimensions: Record<string, any> = {},
) {
  const [{ routes, recipes }, authored] = await Promise.all([
    routeData(),
    requestJSON('/generated/authored.json'),
  ])
  const declaredRoots = authored
    ? [
        ...authored.progression.roots,
        ...authored.acquisition.records.flatMap((r: any) => r.roots ?? []),
      ]
    : []
  const roots = filterRoots(
    declaredRoots,
    Object.fromEntries(
      Object.values(dimensions).map((dimension) => [dimension.gate, dimension]),
    ),
  )
  if (!host.isConnected) return { destroy() {}, setPolicy(_policy: string) {} }
  const root = createRoot(host)
  const index = routeIndex(items, routes),
    recipeMap = new Map(recipes.map((r) => [r.id, r]))
  function setPolicy(policy: string) {
    root.render(
      <AcquisitionMethods
        policy={policy}
        detail={detail}
        roots={roots}
        itemId={itemId}
        index={index}
        recipes={recipeMap}
        inspect={inspect}
        openProgression={openProgression}
      />,
    )
  }
  setPolicy(
    (document.getElementById('progression-policy') as HTMLSelectElement)
      ?.value ?? 'planned',
  )
  return {
    setPolicy,
    destroy() {
      root.unmount()
    },
  }
}
