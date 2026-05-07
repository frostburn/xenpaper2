import type { XenpaperAST } from './grammar-to-chars'

export function parse(input: string, options?: { grammarSource?: string }): XenpaperAST
