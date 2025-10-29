export function splitWords(input: string) {
  return (input || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter(Boolean)
}

export function kebabCase(input: string) {
  return splitWords(input)
    .map(word => word.toLowerCase())
    .join('-')
}

export function pascalCase(input: string) {
  return splitWords(input)
    .map((word) => {
      const lower = word.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}
