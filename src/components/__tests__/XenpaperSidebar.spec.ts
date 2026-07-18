import { createHash } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import XenpaperSidebar from '../XenpaperSidebar.vue'
import TutorialSidebar from '../TutorialSidebar.vue'

const TUTORIAL_SIDEBAR_TEXT_SHA256 = 'ffe77002fc0e2903afe5e5c66c3520bdfa3c25c309a630592084e7c81c7ef1ca'

const hashText = (text: string) => createHash('sha256').update(text).digest('hex')

const mountSidebar = () =>
  mount(XenpaperSidebar, {
    props: {
      sidebarMode: 'info',
      shareUrl: 'https://example.com/#0',
      embedCode: '<iframe src="https://example.com/embed/#0"></iframe>',
      embedUrl: 'https://example.com/embed/#0',
      sourceCodes: ['0 4 7'],
      renderCacheKey: 'test-render-cache-key',
      renderSongToWavBlob: vi.fn(async () => new Blob()),
    },
  })

describe('XenpaperSidebar info mode', () => {
  it('renders unchanged v1 tutorial sidebar content', () => {
    const wrapper = mountSidebar()
    const tutorial = wrapper.findComponent(TutorialSidebar)

    expect(tutorial.exists()).toBe(true)
    expect(hashText(tutorial.text())).toBe(TUTORIAL_SIDEBAR_TEXT_SHA256)
    expect(tutorial.get('#tutorial-title').text()).toBe('Xenpaper 2')
    expect(tutorial.text()).toContain('Text-based microtonal sequencer.')
    expect(tutorial.text()).toContain(
      'Typing a number will create a note. Notes can be separated by spaces or commas.',
    )
    expect(tutorial.text()).toContain('0 4 7 12')
    expect(tutorial.text()).toContain(
      'Notes can be written as scale degrees, ratios, cents, octave divisions, octave divisions with custom sizes, or cycles per second.',
    )
    expect(tutorial.text()).toContain('0 7 1/1 3/2 0c 702c')
    expect(tutorial.text()).toContain(
      'Find anything broken, or have some ideas you want to share? Visit the issue tracker on GitHub to file bugs or discuss future features.',
    )
    expect(tutorial.get('a').attributes('href')).toBe(
      'https://github.com/frostburn/xenpaper2/issues',
    )
  })
})
