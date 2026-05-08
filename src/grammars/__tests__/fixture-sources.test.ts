import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import * as parserModule from '../grammar.generated.js'

const repositoryRoot = process.cwd()
const dataDirectory = resolve(repositoryRoot, 'src/grammars/__tests__/data')

const xenpaperSourceFiles = (directory: string): string[] =>
  readdirSync(directory)
    .flatMap((entry) => {
      const path = resolve(directory, entry)

      if (statSync(path).isDirectory()) {
        return xenpaperSourceFiles(path)
      }

      return path.endsWith('.xenpaper') ? [path] : []
    })
    .sort((left, right) => left.localeCompare(right))

const sourceFiles = xenpaperSourceFiles(dataDirectory).map((path) => ({
  path,
  sourceName: relative(repositoryRoot, path),
}))

describe('grammar source fixtures', () => {
  it('finds checked-in xenpaper source fixtures', () => {
    expect(sourceFiles.length).toBeGreaterThan(0)
  })

  it.each(sourceFiles)('parses $sourceName', ({ path, sourceName }) => {
    const source = readFileSync(path, 'utf8')
    const ast = parserModule.parse(source, { grammarSource: sourceName }) as { type?: unknown }

    expect(ast.type).toBe('XenpaperGrammar')
  })
})
