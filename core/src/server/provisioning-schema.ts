import type { CouchDBDesignDocument, CouchDBSecurityObject } from './operations'

export interface ProvisioningPolicy {
  database: string
  security: CouchDBSecurityObject
  designs?: CouchDBDesignDocument[]
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function invalid(field: string): never {
  throw new Error(`Invalid provisioning ${field}`)
}
/** Pure structural validation; CouchDB remains responsible for design compilation. */
export function validateProvisioningPolicy(
  value: unknown,
): asserts value is ProvisioningPolicy {
  if (!record(value)) invalid('policy')
  for (const key of Object.keys(value))
    if (!['database', 'security', 'designs'].includes(key))
      invalid(`policy field: ${key}`)
  if (
    typeof value.database !== 'string' ||
    !/^[a-z][a-z0-9_$()+/-]*$/.test(value.database)
  )
    invalid('database: expected a non-system database name')
  if (!record(value.security)) invalid('security')
  for (const kind of ['admins', 'members']) {
    const group = value.security[kind]
    if (!record(group)) invalid(`security.${kind}`)
    for (const field of ['names', 'roles'])
      if (
        !Array.isArray(group[field]) ||
        !group[field].every((entry) => typeof entry === 'string')
      )
        invalid(`security.${kind}.${field}: expected string array`)
  }
  if (value.designs === undefined) return
  if (!Array.isArray(value.designs)) invalid('designs: expected array')
  const designIds = new Set<string>()
  for (const design of value.designs) {
    if (!record(design)) invalid('design document')
    if (typeof design._id !== 'string') invalid('design._id')
    const name = design._id.replace(/^_design\//, '')
    if (
      !name.trim() ||
      name.startsWith('_') ||
      /[\u0000-\u001f\u007f]/.test(name)
    )
      invalid('design._id')
    if (designIds.has(name)) invalid('duplicate design._id')
    designIds.add(name)
    if (typeof design.language !== 'string' || !design.language.trim())
      invalid('design.language')
    if (!record(design.views)) invalid('design.views')
    for (const view of Object.values(design.views)) {
      if (!record(view) || !(typeof view.map === 'string' || record(view.map)))
        invalid('design view.map')
      if (view.reduce !== undefined && typeof view.reduce !== 'string')
        invalid('design view.reduce')
    }
  }
}
