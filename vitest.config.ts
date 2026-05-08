import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

const nodeMajor = Number(process.versions.node.split('.')[0])

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      execArgv: nodeMajor >= 25 ? ['--no-experimental-webstorage'] : [],
      exclude: [...configDefaults.exclude, 'e2e/**', 'reference/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
