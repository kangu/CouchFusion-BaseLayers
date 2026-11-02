import { useState } from '#imports'
/** Set a page-specific shell title from an admin page. */
export function useCouchDBAdminTitle() {
  return useState<string>('couchdb:admin-title', () => '')
}

export const useAdminWorkspaceHeaderTitle = useCouchDBAdminTitle
