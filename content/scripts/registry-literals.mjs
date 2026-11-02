// Literal readers shared by the component registry generator.
//
// Babel parses `-8` as a UnaryExpression ('-') around the NumericLiteral 8, not as a numeric
// literal, so a plain `isNumericLiteral` check silently dropped every negative default
// (for example `century: -8`) and every negative number in builderFieldMeta.

/**
 * The number a node stands for: a NumericLiteral, or `-`/`+` applied (possibly repeatedly)
 * to one, e.g. `-8`, `+3`, `-0.5`, `- -2`. `undefined` for anything else.
 */
export const readNumericLiteral = (node, types) => {
  if (!node) return undefined
  if (types.isNumericLiteral(node)) {
    return node.value
  }
  if (types.isUnaryExpression(node) && (node.operator === '-' || node.operator === '+')) {
    const inner = readNumericLiteral(node.argument, types)
    if (inner === undefined) return undefined
    return node.operator === '-' ? -inner : inner
  }
  return undefined
}

/** True when the node is a number literal, signed or not. */
export const isNumericValue = (node, types) => readNumericLiteral(node, types) !== undefined
