import { describe, expect, it, vi } from 'vitest'

describe('main app bootstrap', () => {
  it('waits for the router initial route before mounting the app', async () => {
    let resolveRouterReady: () => void = () => {}
    const routerReady = new Promise<void>((resolve) => {
      resolveRouterReady = resolve
    })
    const app = {
      mount: vi.fn<(selector: string) => void>(),
      use: vi.fn<() => unknown>(),
    }
    const router = {
      isReady: vi.fn<() => Promise<void>>(() => routerReady),
    }

    app.use.mockReturnValue(app)
    vi.resetModules()
    vi.doMock('vue', async () => ({
      ...(await vi.importActual<typeof import('vue')>('vue')),
      createApp: vi.fn<() => typeof app>(() => app),
    }))
    vi.doMock('../App.vue', () => ({ default: {} }))
    vi.doMock('../router', () => ({ default: router }))

    await import('../main')

    expect(app.mount).not.toHaveBeenCalled()

    resolveRouterReady()
    await routerReady
    await Promise.resolve()

    expect(router.isReady).toHaveBeenCalledTimes(1)
    expect(app.mount).toHaveBeenCalledWith('#app')
  })
})
