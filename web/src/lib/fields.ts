/** Keep description IDs identical in React, Astro and generated DOM fields. */
export function fieldControl(id: string, { hint = false, error = false } = {}) {
  const descriptions = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')
  return {
    id,
    'aria-describedby': descriptions || undefined,
    'aria-invalid': error ? (true as const) : undefined,
  }
}

/** Generated fields share the same label contract as Astro and React fields. */
export function createField(
  labelText: string,
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
) {
  const element = document.createElement('div')
  element.className = 'field'
  const label = document.createElement('label')
  label.htmlFor = control.id
  label.textContent = labelText
  element.append(label, control)
  return element
}
