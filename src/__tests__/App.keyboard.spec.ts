import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
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
      setScore: vi.fn<() => Promise<void>>(async () => {}),
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

  const wrapper = mount(App, {
    global: {
      plugins: [createPinia(), router],
      stubs: {
        PitchRuler: true,
        PlayPauseButton: true,
        TutorialSidebar: true,
      },
    },
  })

  await flushPromises()

  return { router, wrapper }
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
})
