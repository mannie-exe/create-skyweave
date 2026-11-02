import type {
  ObjectCatalogue,
  ResourceObject,
  ObjectCase,
} from './object-resources'
const previousRecipes: Record<string, string> = {
  'lootr-barrel-material-study': 'lootr-barrel-clasps',
  'lootr-barrel-looted-material-study': 'lootr-barrel-looted-clasps',
}
export function objectLocation(
  catalogue: ObjectCatalogue,
  params: URLSearchParams,
) {
  const view = params.get('view')
  const editor: 'models' | 'textures' | undefined =
    view === 'models' || view === 'textures' ? view : undefined
  const input =
    params.get('recipe') ??
    (editor === 'models' ? catalogue.defaultRecipe : '') ??
    ''
  const recipe = previousRecipes[input] ?? input
  const texture =
    params.get('texture') ??
    (editor === 'textures' ? catalogue.defaultTexture : '') ??
    ''
  const find = (predicate: (entry: ResourceObject) => boolean) =>
    catalogue.objects.find(predicate)
  const entry =
    find((entry) => entry.id === params.get('object')) ??
    find((entry) => entry.recipes.includes(recipe)) ??
    find((entry) => entry.textures.includes(texture)) ??
    find((entry) => entry.changed && entry.supported) ??
    catalogue.objects[0]
  const variant =
    entry?.cases.find((value) => value.id === params.get('case')) ??
    entry?.cases.find(
      (value) => editor === 'models' && value.recipe === recipe,
    ) ??
    entry?.cases.find(
      (value) => editor === 'textures' && value.textureResource === texture,
    ) ??
    entry?.cases[0]
  const available =
    variant &&
    (editor === 'models'
      ? variant.recipe
      : editor === 'textures'
        ? variant.textureResource
        : undefined)
  return {
    entry,
    variant,
    editor: available ? editor : undefined,
    mode:
      params.get('artifact') === 'textures'
        ? ('textures' as const)
        : ('models' as const),
    left: params.get('a') ?? 'native',
    right: params.get('b') ?? 'pack',
  }
}
export function writeObjectLocation(
  entry: ResourceObject,
  variant: ObjectCase,
  editor?: 'models' | 'textures',
  push = false,
) {
  const url = new URL(location.href)
  url.searchParams.delete('layout')
  url.searchParams.set('object', entry.id)
  url.searchParams.set('case', variant.id)
  if (editor) {
    url.searchParams.set('view', editor)
    if (editor === 'models' && variant.recipe)
      url.searchParams.set('recipe', variant.recipe)
    if (editor === 'textures' && variant.textureResource)
      url.searchParams.set('texture', variant.textureResource)
  } else
    for (const key of ['view', 'recipe', 'texture'])
      url.searchParams.delete(key)
  history[push ? 'pushState' : 'replaceState'](null, '', url)
}
