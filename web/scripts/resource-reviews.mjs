import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { comparisons, comparisonRun } from '../src/lib/resource-comparisons.mjs'

const hash = (value) => createHash('sha256').update(value).digest('hex')
const recordKey = (feature) => `${feature.run ?? comparisonRun}/${feature.id}`
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

/** Validation is shared by the static page and the policy-checked service. */
export function reviewSnapshot(text, catalogue = comparisons) {
  if (Buffer.byteLength(text) > 1000000)
    throw new Error('Review file exceeds 1 MB')
  const document = JSON.parse(text)
  if (!object(document) || document.schema !== 1 || !object(document.reviews))
    throw new Error('Invalid resource reviews document')
  // Retired catalogues keep their dated evidence and choices.
  for (const feature of catalogue) {
    const review = document.reviews[recordKey(feature)]
    if (!review) continue
    validateReview(
      { preference: review.preference, notes: review.notes },
      feature,
      false,
    )
    if (typeof review.evidence !== 'string')
      throw new Error('Missing review evidence')
  }
  return {
    document,
    revision: hash(text),
    evidence: hash(JSON.stringify(catalogue)),
  }
}

export function reviewText(current, input, catalogue = comparisons) {
  if (
    !object(input) ||
    Object.keys(input).sort().join() !== 'evidence,feature,review,revision'
  )
    throw new Error('Expected feature, review and source/evidence revisions')
  const feature = catalogue.find((item) => item.id === input.feature)
  if (!feature) throw new Error('Unknown comparison feature')
  validateReview(input.review, feature)
  if (
    input.revision !== current.revision ||
    input.evidence !== current.evidence
  )
    throw new Error(
      'Reviews or evidence changed. Reload saved reviews before saving again.',
    )
  const document = {
    ...current.document,
    reviews: {
      ...current.document.reviews,
      [recordKey(feature)]: { ...input.review, evidence: current.evidence },
    },
  }
  const text = JSON.stringify(document, null, 2) + '\n'
  if (Buffer.byteLength(text) > 1000000)
    throw new Error('Review file exceeds 1 MB')
  return text
}

/** Explicitly public read used only while rendering the open static page. */
export function resourceReviews(root) {
  const file = path.join(root, 'data/authored/resource-reviews.json')
  return {
    async read() {
      if ((await fs.realpath(file)) !== file)
        throw new Error('Resource review symlinks are not supported')
      return reviewSnapshot(await fs.readFile(file, 'utf8'))
    },
  }
}
