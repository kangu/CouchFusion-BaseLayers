import { toHast, fromHast } from 'minimark/hast'
import type { MinimarkNode, MinimarkTree } from 'minimark'
import { visit as minimarkVisit } from 'minimark'
import type { HastRoot, MinimarkLikeTree } from '../types'

export function compressTree(input: HastRoot): MinimarkTree {
  return fromHast(input as unknown as Parameters<typeof fromHast>[0])
}

export function decompressTree(input: MinimarkLikeTree): HastRoot {
  return toHast({ type: 'minimark', value: input.value }) as unknown as HastRoot
}

export function visit(tree: MinimarkLikeTree, checker: (node: MinimarkNode) => boolean, visitor: (node: MinimarkNode) => MinimarkNode | undefined) {
  minimarkVisit({ type: 'minimark', value: tree.value }, checker, visitor)
}
