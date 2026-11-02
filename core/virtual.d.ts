declare module '#core-options' {
  const options: import('./src/shared/types').ResolvedOptions
  export default options
}
declare module '#core-email-delivery' {
  const deliver: (input: {
    email: string
    code: string
    expiresAt: string
    appSlug: string
    tokenDocumentId: string
  }) => Promise<void>
  export default deliver
}
