// Route coverage is independent of depth, review notes and operation status.
export const coverageStates = {
  mapped: { label: 'Mapped route', token: '--coverage-mapped' },
  blocked: { label: 'Blocked prerequisites', token: '--coverage-blocked' },
  unknown: { label: 'Source not classified', token: '--coverage-unmapped' },
  unmapped: { label: 'No acquisition adapter', token: '--coverage-unmapped' },
  excluded: { label: 'Internal / creative', token: '--coverage-neutral' },
  unified: { label: 'Unified variant', token: '--coverage-neutral' },
}

/** @param {string} status @returns {keyof typeof coverageStates} */
export function coverageStatus(status) {
  return Object.hasOwn(coverageStates, status)
    ? /** @type {keyof typeof coverageStates} */ (status)
    : 'unmapped'
}
