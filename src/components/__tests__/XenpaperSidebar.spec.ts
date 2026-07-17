import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import XenpaperSidebar from '../XenpaperSidebar.vue'
import TutorialSidebar from '../TutorialSidebar.vue'

const TUTORIAL_SIDEBAR_SHA256 = 'f9fa18be593ab2bef9198ccec3df74a44bd611dd9b956a126c3d84f4369633f3'

const tutorialSidebarHash = () =>
  createHash('sha256')
    .update(readFileSync(join(process.cwd(), 'src/components/TutorialSidebar.vue')))
    .digest('hex')

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
  it('keeps TutorialSidebar.vue unchanged', () => {
    expect(tutorialSidebarHash()).toBe(TUTORIAL_SIDEBAR_SHA256)
  })

  it('renders the v1 tutorial sidebar content', () => {
    const wrapper = mountSidebar()
    const tutorial = wrapper.getComponent(TutorialSidebar)

    expect(tutorial.exists()).toBe(true)
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
