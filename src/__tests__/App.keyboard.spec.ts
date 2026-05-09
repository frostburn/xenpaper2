import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { useXenpaperStore } from '../stores/xenpaper'
import HomeView from '../views/HomeView.vue'

type MockSoundEngine = {
  currentPosition: number
  playingState: boolean
  endMs: number
  endCallback?: () => void
  noteCallback?: (...args: unknown[]) => void
  playing: ReturnType<typeof vi.fn>
  position: ReturnType<typeof vi.fn>
  endPosition: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  gotoMs: ReturnType<typeof vi.fn>
  setLoopActive: ReturnType<typeof vi.fn>
  setLoopStart: ReturnType<typeof vi.fn>
  setScore: ReturnType<typeof vi.fn>
  onEnd: ReturnType<typeof vi.fn>
  onNote: ReturnType<typeof vi.fn>
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
      play: vi.fn<() => Promise<void>>(async () => {
        engine.playingState = true
      }),
      pause: vi.fn<() => Promise<void>>(async () => {
        engine.playingState = false
      }),
      gotoMs: vi.fn<(ms: number) => Promise<void>>(async (ms: number) => {
        engine.currentPosition = ms
      }),
      setLoopActive: vi.fn<(active: boolean) => void>(),
      setLoopStart: vi.fn<(ms?: number) => void>(),
      setScore: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
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
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
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
    expect(store.routeHash).toBe('#tabs:first:second%_tab')
    await vi.waitFor(() => expect(router.currentRoute.value.hash).toBe('#tabs:first:second%_tab'))

    const { store: restoredStore } = await mountApp('#tabs:first:second%_tab:third')

    expect(restoredStore.sourceCodes).toEqual(['first', 'second_tab', 'third'])
    expect(restoredStore.sourceTabs).toHaveLength(3)
  })

  it('resets playback state when closing a tab during playback', async () => {
    const { store, wrapper } = await mountApp('#0_2')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await flushPromises()

    store.selectSourceCodeTab(0)
    await store.restartPlaybackFromStart()
    expect(store.isPlaying).toBe(true)
    expect(wrapper.get('.play-pause-button').text()).toContain('Pause')

    await store.closeSourceCodeTab(1)
    await flushPromises()

    expect(store.isPlaying).toBe(false)
    expect(store.playbackPositionMs).toBe(-1)
    expect(wrapper.get('.play-pause-button').text()).toContain('Play')
  })

  it('resets the project to one source tab when selecting a demo', async () => {
    const { store, wrapper } = await mountApp('#0_2')

    await wrapper.get('button[aria-label="Add source code"]').trigger('click')
    await flushPromises()

    expect(store.sourceTabs).toHaveLength(2)

    await store.setDemoTune('4 5')
    await flushPromises()

    expect(store.sourceTabs).toHaveLength(1)
    expect(store.sourceCode).toBe('4 5')
    expect(store.activeSourceCodeTabIndex).toBe(0)
    expect(store.isPlaying).toBe(true)
  })
})
