import * as parser from './grammar.generated.js';

export type XenpaperAST = any;

export const XenpaperGrammarParser = (input: string): XenpaperAST => parser.parse(input);
