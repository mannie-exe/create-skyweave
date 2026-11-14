/** Supported author inputs; native Empack remains the semantic validator. */
export function currentEmpackAuthor(value) {
  if (value?.schema !== 6 || !Number.isInteger(value.runtime?.java?.preferred))
    throw new Error(
      'Empack 0.8.5-beta author schema 6 with runtime.java.preferred is required',
    )
  return value
}

export function currentEmpackLock(value) {
  if (value?.schema !== 3)
    throw new Error('Empack 0.8.5-beta lock schema 3 is required')
  return value
}
