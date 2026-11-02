import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { comparisons, comparisonRun } from '../src/lib/resource-comparisons.mjs'

const hash = (value) => createHash('sha256').update(value).digest('hex')
const evidence = hash(JSON.stringify(comparisons))
const recordKey = (feature) => `${comparisonRun}/${feature}`
const object = (value) =>
  value && typeof value === 'object' && !Array.isArray(value)

function validateReview(review, feature, checkChoices = true) {
  const preferences = new Set([
    '',
    'defer',
    ...feature.captures.flatMap((capture) =>
      capture.originals.map((item) => item.id),
    ),
  ])
  if (
    !object(review) ||
    Object.keys(review).sort().join() !== 'notes,preference' ||
    typeof review.preference !== 'string' ||
    review.preference.length > 80 ||
    (checkChoices && !preferences.has(review.preference)) ||
    typeof review.notes !== 'string' ||
    review.notes.length > 4000
  )
    throw new Error(
      'Choose a listed preference and notes of at most 4,000 characters',
    )
}

export function resourceReviews(root) {
  const file = path.join(root, 'data/authored/resource-reviews.json')
  async function source() {
    if ((await fs.realpath(file)) !== file)
      throw new Error('Resource review symlinks are not supported')
    const text = await fs.readFile(file, 'utf8')
    if (Buffer.byteLength(text) > 1000000)
      throw new Error('Review file exceeds 1 MiB')
    const document = JSON.parse(text)
    if (!object(document) || document.schema !== 1 || !object(document.reviews))
      throw new Error('Invalid resource reviews document')
    // Older dated reviews remain in the source even when their catalogue is retired.
    for (const feature of comparisons) {
      const review = document.reviews[recordKey(feature.id)]
      if (!review) continue
      validateReview(
        { preference: review.preference, notes: review.notes },
        feature,
        false,
      )
      if (typeof review.evidence !== 'string')
        throw new Error('Missing review evidence')
    }
    return { document, revision: hash(text), evidence }
  }
  return {
    read: source,
    async save(input) {
      if (
        !object(input) ||
        Object.keys(input).sort().join() !== 'evidence,feature,review,revision'
      )
        throw new Error(
          'Expected feature, review and source/evidence revisions',
        )
      const feature = comparisons.find((item) => item.id === input.feature)
      if (!feature) throw new Error('Unknown comparison feature')
      validateReview(input.review, feature)
      const current = await source()
      if (input.revision !== current.revision || input.evidence !== evidence)
        throw new Error(
          'Reviews or evidence changed. Reload saved reviews before saving again.',
        )
      const document = {
        ...current.document,
        reviews: {
          ...current.document.reviews,
          [recordKey(feature.id)]: { ...input.review, evidence },
        },
      }
      const text = JSON.stringify(document, null, 2) + '\n'
      if (Buffer.byteLength(text) > 1000000)
        throw new Error('Review file exceeds 1 MiB')
      await fs.writeFile(file + '.tmp', text, { flag: 'wx' })
      let staged = true
      try {
        if ((await source()).revision !== current.revision)
          throw new Error(
            'Reviews changed while saving. Reload saved reviews before saving again.',
          )
        await fs.rename(file + '.tmp', file)
        staged = false
      } finally {
        if (staged) await fs.rm(file + '.tmp', { force: true })
      }
      return { document, revision: hash(text), evidence }
    },
  }
}
