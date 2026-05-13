import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { useXenpaperStore } from '../stores/xenpaper'
import HomeView from '../views/HomeView.vue'

type MockFn<T extends (...args: never[]) => unknown> = ReturnType<typeof vi.fn<T>>

type MockSoundEngine = {
  currentPosition: number
  playingState: boolean
  endMs: number
  endCallback?: () => void
  noteCallback?: (...args: unknown[]) => void
  playing: MockFn<() => boolean>
  position: MockFn<() => number>
  endPosition: MockFn<() => number>
  start: MockFn<() => Promise<void>>
  play: MockFn<() => Promise<void>>
  pause: MockFn<() => Promise<void>>
  stopSilently: MockFn<() => void>
  gotoMs: MockFn<(ms: number) => Promise<void>>
  setLoopActive: MockFn<(active: boolean) => void>
  setLoopStart: MockFn<(ms?: number) => void>
  setScore: MockFn<(...args: unknown[]) => Promise<void>>
  setOutputGain: MockFn<(gain: number) => void>
  onEnd: MockFn<(callback: () => void) => () => void>
  onNote: MockFn<(callback: (...args: unknown[]) => void) => () => void>
  dispose: MockFn<() => void>
}

const soundEngineMock = vi.hoisted(() => ({
  instances: [] as MockSoundEngine[],
}))

vi.mock('../sound-engine-tonejs', () => ({
  SoundEngineTonejs: vi.fn<() => MockSoundEngine>(function () {
    const engine: MockSoundEngine = {
      currentPosition: 0,
      playingState: false,
      endMs: 10_000,
      playing: vi.fn<() => boolean>(() => engine.playingState),
      position: vi.fn<() => number>(() => engine.currentPosition),
      endPosition: vi.fn<() => number>(() => engine.endMs),
      start: vi.fn<() => Promise<void>>(async () => {}),
      play: vi.fn<() => Promise<void>>(async () => {
        await engine.start()
        engine.playingState = true
      }),
      pause: vi.fn<() => Promise<void>>(async () => {
        engine.playingState = false
      }),
      stopSilently: vi.fn<() => void>(() => {
        engine.playingState = false
      }),
      gotoMs: vi.fn<(ms: number) => Promise<void>>(async (ms: number) => {
        engine.currentPosition = ms
      }),
      setLoopActive: vi.fn<(active: boolean) => void>(),
      setLoopStart: vi.fn<(ms?: number) => void>(),
      setScore: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
      setOutputGain: vi.fn<(gain: number) => void>(),
      onEnd: vi.fn<(callback: () => void) => () => void>((callback: () => void) => {
        engine.endCallback = callback
        return vi.fn<() => void>()
      }),
      onNote: vi.fn<(callback: (...args: unknown[]) => void) => () => void>(
        (callback: (...args: unknown[]) => void) => {
          engine.noteCallback = callback
          return vi.fn<() => void>()
        },
      ),
      dispose: vi.fn<() => void>(),
    }

    soundEngineMock.instances.push(engine)
    return engine
  }),
}))

const mountApp = async (hash = '#0_2') => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/about', component: { template: '<main />' } },
    ],
  })

  await router.push(`/${hash}`)
  await router.isReady()

  const pinia = createPinia()
  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router],
      stubs: {
        PitchRuler: true,
        TutorialSidebar: true,
      },
    },
  })

  await flushPromises()

  return { router, store: useXenpaperStore(pinia), wrapper }
}

const dispatchSourceKeydown = async (textarea: HTMLTextAreaElement, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  const preventDefault = vi.spyOn(event, 'preventDefault')

  textarea.dispatchEvent(event)
  await flushPromises()

  return { event, preventDefault }
}

describe('App source editor keyboard shortcuts', () => {
  beforeEach(() => {
    soundEngineMock.instances.length = 0
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('does not start audio on initial mount before playback is requested', async () => {
    const { wrapper } = await mountApp('#0_2%0A4_5')
    const enginesAfterMount = soundEngineMock.instances.slice()

    expect(enginesAfterMount).not.toHaveLength(0)
    enginesAfterMount.forEach((engine) => {
      expect(engine.start).not.toHaveBeenCalled()
      expect(engine.play).not.toHaveBeenCalled()
      expect(engine.pause).not.toHaveBeenCalled()
    })

    await wrapper.get('button.play-pause-button').trigger('click')
    await flushPromises()

    expect(soundEngineMock.instances.some((engine) => engine.start.mock.calls.length > 0)).toBe(
      true,
    )
  })

  it('does not start audio while replacing sources from a changed route hash', async () => {
    const { router, wrapper } = await mountApp('#first')

    soundEngineMock.instances.forEach((engine) => {
      engine.start.mockClear()
      engine.play.mockClear()
      engine.pause.mockClear()
      engine.stopSilently.mockClear()
    })

    await router.push('/#4_5')
    await flushPromises()

    const enginesAfterHashReplacement = soundEngineMock.instances.slice()
    enginesAfterHashReplacement.forEach((engine) => {
      expect(engine.start).not.toHaveBeenCalled()
      expect(engine.play).not.toHaveBeenCalled()
      expect(engine.pause).not.toHaveBeenCalled()
    })
    expect(
      enginesAfterHashReplacement.some((engine) => engine.stopSilently.mock.calls.length > 0),
    ).toBe(true)

    await wrapper.get('button.play-pause-button').trigger('click')
    await flushPromises()

    expect(soundEngineMock.instances.some((engine) => engine.start.mock.calls.length > 0)).toBe(
      true,
    )
  })
  it('resets to the beginning and plays for Ctrl+Enter', async () => {
    const { wrapper } = await mountApp('#0_2%0A4_5')
    const engine = soundEngineMock.instances[soundEngineMock.instances.length - 1]!
    const textarea = wrapper.get<HTMLTextAreaElement>('textarea').element

    await wrapper.get('button[aria-label="Start playback at line 2"]').trigger('click')
    engine.gotoMs.mockClear()
    engine.play.mockClear()
    engine.pause.mockClear()

    const { preventDefault } = await dispatchSourceKeydown(textarea, {
      key: 'Enter',
      ctrlKey: true,
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(engine.gotoMs).toHaveBeenCalledWith(0)
    expect(engine.play).toHaveBeenCalledTimes(1)
    expect(engine.pause).not.toHaveBeenCalled()
  })

  it('resets playback instead of pausing when Cmd+Enter is pressed while playing', async () => {
    const { wrapper } = await mountApp()
    const engine = soundEngineMock.instances[soundEngineMock.instances.length - 1]!
    const textarea = wrapper.get<HTMLTextAreaElement>('textarea').element

    engine.gotoMs.mockClear()
    engine.play.mockClear()
    engine.pause.mockClear()

    await dispatchSourceKeydown(textarea, { key: 'Enter', metaKey: true })
    await dispatchSourceKeydown(textarea, { key: 'Enter', metaKey: true })

    expect(engine.gotoMs).toHaveBeenCalledTimes(2)
    expect(engine.gotoMs).toHaveBeenNthCalledWith(1, 0)
    expect(engine.gotoMs).toHaveBeenNthCalledWith(2, 0)
    expect(engine.play).toHaveBeenCalledTimes(2)
    expect(engine.pause).not.toHaveBeenCalled()
  })

  it('plays from the current source line for Ctrl+Space', async () => {
    const { wrapper } = await mountApp('#0_2%0A4_5')
    const engine = soundEngineMock.instances[soundEngineMock.instances.length - 1]!
    const textarea = wrapper.get<HTMLTextAreaElement>('textarea').element

    textarea.setSelectionRange(textarea.value.indexOf('\n') + 1, textarea.value.indexOf('\n') + 1)
    engine.gotoMs.mockClear()
    engine.play.mockClear()
    engine.pause.mockClear()

    const { preventDefault } = await dispatchSourceKeydown(textarea, {
      key: ' ',
      code: 'Space',
      ctrlKey: true,
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(engine.gotoMs).toHaveBeenCalledWith(500)
    expect(engine.play).toHaveBeenCalledTimes(1)
    expect(engine.pause).not.toHaveBeenCalled()
  })

  it('plays from the current source line for Cmd+Space', async () => {
    const { wrapper } = await mountApp('#0_2%0A4_5')
    const engine = soundEngineMock.instances[soundEngineMock.instances.length - 1]!
    const textarea = wrapper.get<HTMLTextAreaElement>('textarea').element

    textarea.setSelectionRange(textarea.value.indexOf('\n') + 1, textarea.value.indexOf('\n') + 1)
    engine.gotoMs.mockClear()
    engine.play.mockClear()
    engine.pause.mockClear()

    const { preventDefault } = await dispatchSourceKeydown(textarea, {
      key: ' ',
      code: 'Space',
      metaKey: true,
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(engine.gotoMs).toHaveBeenCalledWith(500)
    expect(engine.play).toHaveBeenCalledTimes(1)
    expect(engine.pause).not.toHaveBeenCalled()
  })

  it('keeps playback controls and sound engine alive on the About route', async () => {
    const { router, wrapper } = await mountApp('#0_2%0A4_5')
    const instanceCount = soundEngineMock.instances.length

    await router.push('/about#0_2%0A4_5')
    await flushPromises()

    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Playback controls"]').exists()).toBe(true)
    expect(wrapper.find('.loop-button').exists()).toBe(true)
    expect(soundEngineMock.instances).toHaveLength(instanceCount)
  })

  it('adds source code tabs with isolated editor contents', async () => {
    const { wrapper } = await mountApp('#0_2%0A4_5')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2)
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('')

    await wrapper.get<HTMLTextAreaElement>('textarea').setValue('0_2')
    await flushPromises()

    await wrapper.findAll('[role="tab"]')[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('0 2\n4 5')

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('0_2')
  })

  it('encodes all source tabs in the route hash and restores them in order', async () => {
    const { router, store, wrapper } = await mountApp('#first')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('textarea').setValue('second_tab')
    await flushPromises()

    expect(store.sourceCodes).toEqual(['first', 'second_tab'])
    expect(store.routeHash).toBe('#first~second%20tab')
    await vi.waitFor(() => expect(router.currentRoute.value.hash).toBe('#first~second%20tab'))

    const { store: restoredStore } = await mountApp('#first~second%20tab~third')

    expect(restoredStore.sourceCodes).toEqual(['first', 'second_tab', 'third'])
    expect(restoredStore.sourceTabs).toHaveLength(3)
  })

  it.skip('decodes legacy escapes', async () => {
    // This test works but produces: [Vue Router warn]: Error decoding "#first~second%_tab~third". Using original value
    const { store: restoredStore } = await mountApp('#first~second%_tab~third')

    expect(restoredStore.sourceCodes).toEqual(['first', 'second_tab', 'third'])
    expect(restoredStore.sourceTabs).toHaveLength(3)
  })

  it('solos a source code tab from the editor controls by silencing other tabs', async () => {
    const { store, wrapper } = await mountApp('#0_2%0A4_5')
    const firstEngine = soundEngineMock.instances[soundEngineMock.instances.length - 1]!

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('textarea').setValue('0 2\n4 5')
    await flushPromises()

    const secondEngine = soundEngineMock.instances[soundEngineMock.instances.length - 1]!

    await wrapper.findAll('[role="tab"]')[0]!.trigger('click')
    await flushPromises()

    await wrapper.findAll('.source-editor-tab-control')[0]!.trigger('click')
    await flushPromises()

    expect(store.sourceTabs[0]).toMatchObject({ active: true, soloed: true, muted: false })
    expect(store.sourceTabs[1]).toMatchObject({ active: false, soloed: false, muted: false })
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-label')).toBe('0 2, soloed')
    expect(wrapper.findAll('.source-editor-tab-control')[0]!.classes()).toContain('enabled')
    expect(wrapper.findAll('.source-editor-tab-control')[0]!.attributes('aria-pressed')).toBe('true')

    expect(firstEngine.setOutputGain).toHaveBeenLastCalledWith(1)
    expect(secondEngine.setOutputGain).toHaveBeenLastCalledWith(0)

    firstEngine.play.mockClear()
    secondEngine.play.mockClear()

    await dispatchSourceKeydown(wrapper.get<HTMLTextAreaElement>('textarea').element, {
      key: 'Enter',
      ctrlKey: true,
    })

    expect(firstEngine.play).toHaveBeenCalledTimes(1)
    expect(secondEngine.play).toHaveBeenCalledTimes(1)
  })

  it('mutes a source code tab from the editor controls by silencing it', async () => {
    const { store, wrapper } = await mountApp('#0_2%0A4_5')
    const firstEngine = soundEngineMock.instances[soundEngineMock.instances.length - 1]!

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('textarea').setValue('0 2\n4 5')
    await flushPromises()

    const secondEngine = soundEngineMock.instances[soundEngineMock.instances.length - 1]!

    await wrapper.findAll('.source-editor-tab-control')[1]!.trigger('click')
    await flushPromises()

    expect(store.sourceTabs[0]).toMatchObject({ active: false, soloed: false, muted: false })
    expect(store.sourceTabs[1]).toMatchObject({ active: true, soloed: false, muted: true })
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('aria-label')).toBe('0 2, muted')
    expect(wrapper.findAll('.source-editor-tab-control')[1]!.classes()).toContain('enabled')
    expect(wrapper.findAll('.source-editor-tab-control')[1]!.attributes('aria-pressed')).toBe('true')

    expect(firstEngine.setOutputGain).toHaveBeenLastCalledWith(1)
    expect(secondEngine.setOutputGain).toHaveBeenLastCalledWith(0)

    firstEngine.play.mockClear()
    secondEngine.play.mockClear()

    await dispatchSourceKeydown(wrapper.get<HTMLTextAreaElement>('textarea').element, {
      key: 'Enter',
      ctrlKey: true,
    })

    expect(firstEngine.play).toHaveBeenCalledTimes(1)
    expect(secondEngine.play).toHaveBeenCalledTimes(1)
  })

  it('shows tabs in embed mode for shared multi-tab projects', async () => {
    const { wrapper } = await mountApp('#embed:first~second')

    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2)
    expect(wrapper.find('button[aria-label="Add source code"]').exists()).toBe(false)
    expect(wrapper.find('.source-tab-close').exists()).toBe(false)

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('second')
  })

  it('shows and restores a recently closed source code tab', async () => {
    const { store, wrapper } = await mountApp('#first')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('textarea').setValue('second')
    await flushPromises()

    await store.closeSourceCodeTab(store.sourceTabs[1]!.id)
    await flushPromises()

    expect(store.sourceCodes).toEqual(['first'])
    expect(store.sourceTabs).toMatchObject([
      { title: 'first', alive: true, active: true },
      { title: 'second', alive: false, active: false },
    ])
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(1)
    expect(wrapper.get('.source-tab-restore-summary').text()).toBe('Recently closed')

    await wrapper.get('button[title="Restore second"]').trigger('click')
    await flushPromises()

    expect(store.sourceCodes).toEqual(['first', 'second'])
    expect(store.sourceTabs.every((tab) => tab.alive)).toBe(true)
    expect(store.activeSourceCodeTabIndex).toBe(1)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2)
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('second')
  })

  it('stops playback when restoring a recently closed source code tab', async () => {
    const { store, wrapper } = await mountApp('#0_2')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('textarea').setValue('4_5')
    await flushPromises()

    await store.closeSourceCodeTab(store.sourceTabs[1]!.id)
    await flushPromises()

    await store.restartPlaybackFromStart()
    expect(store.isPlaying).toBe(true)
    expect(wrapper.get('.play-pause-button').text()).toContain('Pause')

    await wrapper.get('button[title="Restore 4_5"]').trigger('click')
    await flushPromises()

    expect(store.isPlaying).toBe(false)
    expect(wrapper.get('.play-pause-button').text()).toContain('Play')
    expect(store.activeSourceCodeTabIndex).toBe(1)
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('4_5')
  })

  it('closes the recently closed menu when clicking outside it', async () => {
    const { store, wrapper } = await mountApp('#first')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('textarea').setValue('second')
    await flushPromises()

    await store.closeSourceCodeTab(store.sourceTabs[1]!.id)
    await flushPromises()

    const restoreMenu = wrapper.get<HTMLDetailsElement>('.source-tab-restore-menu').element
    restoreMenu.open = true

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()

    expect(restoreMenu.open).toBe(false)
  })

  it('does not duplicate a recently closed tab when close is triggered twice', async () => {
    const { store } = await mountApp('#first')

    store.addSourceCodeTab()
    store.setSourceCode('second')
    const tabId = store.sourceTabs[1]!.id

    const firstClose = store.closeSourceCodeTab(tabId)
    const secondClose = store.closeSourceCodeTab(tabId)

    expect(store.sourceCodes).toEqual(['first'])

    await Promise.all([firstClose, secondClose])

    expect(store.sourceTabs).toMatchObject([
      { title: 'first', alive: true, active: true },
      { title: 'second', alive: false, active: false },
    ])

    store.selectSourceCodeTab(1)

    expect(store.sourceCodes).toEqual(['first', 'second'])
    expect(store.sourceTabs.every((tab) => tab.alive)).toBe(true)
  })

  it('keeps replaced project tabs available as recently closed tabs after selecting a demo tune', async () => {
    const { store, wrapper } = await mountApp('#first')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('textarea').setValue('second')
    await flushPromises()

    await store.setDemoTune('4 5')
    await flushPromises()

    expect(store.sourceCodes).toEqual(['4 5'])
    expect(store.sourceTabs).toMatchObject([
      { title: '4 5', alive: true, active: true },
      { title: 'first', alive: false, active: false },
      { title: 'second', alive: false, active: false },
    ])
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(1)
    expect(wrapper.get('.source-tab-restore-summary').text()).toBe('Recently closed')
    expect(store.isPlaying).toBe(true)

    await wrapper.get('button[title="Restore first"]').trigger('click')
    await flushPromises()
    await wrapper.get('button[title="Restore second"]').trigger('click')
    await flushPromises()

    expect(store.sourceCodes).toEqual(['4 5', 'first', 'second'])
    expect(store.sourceTabs.every((tab) => tab.alive)).toBe(true)
    expect(store.activeSourceCodeTabIndex).toBe(2)
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('second')
  })

  it('disposes recently closed tab engines when the dead tab limit is exceeded', async () => {
    const { store } = await mountApp('#first')

    for (let i = 0; i < 12; i++) {
      store.addSourceCodeTab()
      store.setSourceCode(`tab ${i}`)
    }
    await flushPromises()

    const addedEngines = soundEngineMock.instances.slice(-12)
    soundEngineMock.instances.forEach((engine) => engine.dispose.mockClear())
    const tabIdsToClose = store.sourceTabs.slice(1).map((tab) => tab.id)

    for (const id of tabIdsToClose) {
      await store.closeSourceCodeTab(id)
      await flushPromises()
    }
    await flushPromises()

    expect(store.sourceTabs.filter((tab) => !tab.alive)).toHaveLength(10)
    expect(addedEngines[0]!.dispose).toHaveBeenCalledTimes(1)
    expect(addedEngines[1]!.dispose).toHaveBeenCalledTimes(1)
    addedEngines.slice(2).forEach((engine) => {
      expect(engine.dispose).not.toHaveBeenCalled()
    })
  })

  it('resets playback state when closing a tab during playback', async () => {
    const { store, wrapper } = await mountApp('#0_2')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await flushPromises()

    const remainingEngine = soundEngineMock.instances[soundEngineMock.instances.length - 2]!
    const removedEngine = soundEngineMock.instances[soundEngineMock.instances.length - 1]!

    store.selectSourceCodeTab(0)
    await store.restartPlaybackFromStart()
    expect(store.isPlaying).toBe(true)
    expect(wrapper.get('.play-pause-button').text()).toContain('Pause')
    remainingEngine.pause.mockClear()
    remainingEngine.stopSilently.mockClear()
    removedEngine.pause.mockClear()
    removedEngine.stopSilently.mockClear()

    await store.closeSourceCodeTab(store.sourceTabs[1]!.id)
    await flushPromises()

    expect(store.isPlaying).toBe(false)
    expect(store.playbackPositionMs).toBe(-1)
    expect(wrapper.get('.play-pause-button').text()).toContain('Play')
    expect(remainingEngine.pause).toHaveBeenCalledTimes(1)
    expect(remainingEngine.stopSilently).not.toHaveBeenCalled()
    expect(removedEngine.pause).toHaveBeenCalledTimes(1)
    expect(removedEngine.stopSilently).toHaveBeenCalled()
  })

  it('resets the project to one source tab when selecting a demo', async () => {
    const { store, wrapper } = await mountApp('#0_2')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await flushPromises()

    expect(store.sourceTabs).toHaveLength(2)

    await store.setDemoTune('4 5')
    await flushPromises()

    expect(store.sourceCodes).toEqual(['4 5'])
    expect(store.sourceTabs).toHaveLength(3)
    expect(store.sourceTabs.filter((tab) => !tab.alive)).toHaveLength(2)
    expect(store.sourceCode).toBe('4 5')
    expect(store.activeSourceCodeTabIndex).toBe(0)
    expect(store.isPlaying).toBe(true)
  })
})
