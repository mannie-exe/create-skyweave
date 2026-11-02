import { createReviewIndex } from './resourcepack-index'

const search = document.querySelector<HTMLInputElement>('#pack-search')!
const decision = document.querySelector<HTMLSelectElement>('#pack-status')!
const category = document.querySelector<HTMLSelectElement>('#pack-category')!
const cards = [...document.querySelectorAll<HTMLElement>('[data-candidate]')]
const count = document.querySelector('#pack-count')!
const empty = document.querySelector<HTMLElement>('#pack-empty')!
const reviewIndex = createReviewIndex(cards)

function filter(updateUrl = true) {
  const term = search.value.trim().toLowerCase()
  let visible = 0
  for (const card of cards) {
    card.hidden =
      !card.dataset.search?.includes(term) ||
      (!!decision.value && card.dataset.status !== decision.value) ||
      (!!category.value && card.dataset.category !== category.value)
    if (card.hidden) card.querySelector('video')?.pause()
    if (!card.hidden) visible++
  }
  count.textContent = `${visible} of ${cards.length} project reviews`
  empty.hidden = visible !== 0
  reviewIndex.refresh()
  if (updateUrl) {
    const url = new URL(location.href)
    for (const [key, value] of [
      ['q', search.value],
      ['decision', decision.value],
      ['scope', category.value],
    ]) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    history.replaceState(null, '', url)
  }
}
const params = new URLSearchParams(location.search)
search.value = params.get('q') || ''
decision.value = params.get('decision') || ''
category.value = params.get('scope') || ''
for (const input of [search, decision, category])
  input.addEventListener('input', () => filter())
document.querySelector('#pack-reset')!.addEventListener('click', () => {
  search.value = decision.value = category.value = ''
  filter()
})
filter(false)

// A cross-reference should reveal its target even when the current filters hide it.
function revealHash() {
  const card = cards.find((card) => `#${card.id}` === location.hash)
  if (card?.hidden) {
    search.value = decision.value = category.value = ''
    filter()
  }
  if (card) reviewIndex.reveal(card.id)
  card?.scrollIntoView({ block: 'start' })
}
window.addEventListener('hashchange', revealHash)
if (location.hash) revealHash()

const viewer = document.querySelector<HTMLDialogElement>('#image-viewer')!
let activeGallery: HTMLElement | null = null
let activeIndex = 0

function buttons(gallery: HTMLElement) {
  return [...gallery.querySelectorAll<HTMLButtonElement>('[data-image]')]
}
function selectImage(gallery: HTMLElement, index: number) {
  const choices = buttons(gallery)
  const selected = choices[index]
  const image = gallery.querySelector<HTMLImageElement>('.gallery-main')!
  const video = gallery.querySelector<HTMLVideoElement>('.gallery-video')!
  const isVideo = selected.dataset.kind === 'video'
  video.pause()
  video.hidden = !isVideo
  gallery.querySelector<HTMLElement>('[data-open-image]')!.hidden = isVideo
  gallery.querySelector<HTMLElement>('[data-open-video]')!.hidden = !isVideo
  gallery.querySelector<HTMLElement>('[data-image-error]')!.hidden = true
  if (isVideo) {
    video.src = selected.dataset.image!
    video.preload = 'metadata'
  } else {
    video.removeAttribute('src')
    video.load()
    image.src = selected.dataset.image!
  }
  image.alt = selected.dataset.caption!
  gallery.querySelector<HTMLAnchorElement>('[data-open-image]')!.href =
    image.src
  gallery.querySelector('[data-caption]')!.textContent = image.alt
  const source = gallery.querySelector<HTMLAnchorElement>(
    '[data-gallery-source]',
  )!
  source.href = selected.dataset.source!
  source.textContent =
    selected.dataset.origin === 'local'
      ? selected.dataset.presentation === 'true'
        ? 'Open comparison sheet'
        : 'Open original capture'
      : 'Author’s source gallery'
  const originals = gallery.querySelector<HTMLElement>(
    '[data-gallery-originals]',
  )!
  const links = JSON.parse(selected.dataset.originals || '[]') as {
    label: string
    url: string
  }[]
  originals.replaceChildren(
    ...links.map((link) => {
      const anchor = document.createElement('a')
      anchor.href = link.url
      anchor.textContent = link.label
      anchor.target = '_blank'
      anchor.rel = 'noreferrer'
      return anchor
    }),
  )
  originals.hidden = links.length === 0
  gallery.querySelector('[data-gallery-credit]')!.textContent =
    selected.dataset.credit!
  choices.forEach((choice, i) =>
    choice.setAttribute('aria-pressed', String(i === index)),
  )
}
function showImage(index: number) {
  if (!activeGallery) return
  const choices = buttons(activeGallery)
  activeIndex = (index + choices.length) % choices.length
  const choice = choices[activeIndex]
  const image = viewer.querySelector('img')!
  const video = viewer.querySelector('video')!
  video.pause()
  const isVideo = choice.dataset.kind === 'video'
  image.hidden = isVideo
  video.hidden = !isVideo
  viewer.querySelector<HTMLElement>('[data-viewer-error]')!.hidden = true
  if (isVideo) {
    video.src = choice.dataset.image!
    video.preload = 'metadata'
  } else {
    video.removeAttribute('src')
    video.load()
    image.src = choice.dataset.image!
  }
  image.alt = choice.dataset.caption!
  viewer.querySelector('[data-viewer-caption]')!.textContent =
    `${activeIndex + 1} / ${choices.length} · ${image.alt}`
  viewer.querySelector('[data-viewer-credit]')!.textContent =
    choice.dataset.credit!
  viewer.querySelector<HTMLAnchorElement>('[data-original]')!.href =
    choice.dataset.image!
  for (const button of viewer.querySelectorAll<HTMLButtonElement>(
    '[data-previous], [data-next]',
  ))
    button.disabled = choices.length < 2
}
for (const gallery of document.querySelectorAll<HTMLElement>(
  '[data-gallery]',
)) {
  buttons(gallery).forEach((button, index) =>
    button.addEventListener('click', () => selectImage(gallery, index)),
  )
  const image = gallery.querySelector<HTMLImageElement>('.gallery-main')!
  const video = gallery.querySelector<HTMLVideoElement>('.gallery-video')!
  const error = gallery.querySelector<HTMLElement>('[data-image-error]')!
  image.addEventListener('error', () => {
    if (video.hidden) error.hidden = false
  })
  image.addEventListener('load', () => {
    if (video.hidden) error.hidden = true
  })
  video.addEventListener('error', () => {
    if (!video.hidden) error.hidden = false
  })
  video.addEventListener('loadedmetadata', () => {
    if (!video.hidden) error.hidden = true
  })
  if (image.complete && image.naturalWidth === 0) error.hidden = false
  for (const open of gallery.querySelectorAll(
    '[data-open-image], [data-open-video]',
  ))
    open.addEventListener('click', (event) => {
      event.preventDefault()
      video.pause()
      activeGallery = gallery
      showImage(
        buttons(gallery).findIndex(
          (button) => button.getAttribute('aria-pressed') === 'true',
        ),
      )
      viewer.showModal()
    })
}
viewer
  .querySelector('[data-close]')!
  .addEventListener('click', () => viewer.close())
viewer.addEventListener('close', () => viewer.querySelector('video')!.pause())
for (const media of viewer.querySelectorAll('img, video'))
  media.addEventListener('error', () => {
    if (!(media as HTMLElement).hidden)
      viewer.querySelector<HTMLElement>('[data-viewer-error]')!.hidden = false
  })
viewer
  .querySelector('[data-previous]')!
  .addEventListener('click', () => showImage(activeIndex - 1))
viewer
  .querySelector('[data-next]')!
  .addEventListener('click', () => showImage(activeIndex + 1))
viewer.addEventListener('keydown', (event) => {
  if ((event.target as Element).closest('video')) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    showImage(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1))
  }
})

const catalogSearch =
  document.querySelector<HTMLInputElement>('#catalog-search')!
const rows = [
  ...document.querySelectorAll<HTMLTableRowElement>('[data-catalog-search]'),
]
catalogSearch.addEventListener('input', () => {
  let visible = 0
  for (const row of rows) {
    row.hidden = !row.dataset.catalogSearch?.includes(
      catalogSearch.value.trim().toLowerCase(),
    )
    if (!row.hidden) visible++
  }
  document.querySelector('#catalog-count')!.textContent =
    `${visible} of ${rows.length} listings`
})

export {}
