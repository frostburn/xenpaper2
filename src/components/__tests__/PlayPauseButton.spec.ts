import { describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'
import PlayPauseButton from '../PlayPauseButton.vue'

describe('PlayPauseButton', () => {
  it('shows the triangle play icon when playback is paused', () => {
    const wrapper = mount(PlayPauseButton, { props: { playing: false } })

    expect(wrapper.text()).toContain('Play')
    expect(wrapper.findAll('path')).toHaveLength(1)
    expect(wrapper.find('path').attributes('d')).toBe('M 0 0 L 12 6 L 0 12 Z')
  })

  it('shows the pause icon when playback is playing', () => {
    const wrapper = mount(PlayPauseButton, { props: { playing: true } })

    expect(wrapper.text()).toContain('Pause')
    expect(wrapper.findAll('path').map((path) => path.attributes('d'))).toEqual([
      'M 0 0 L 4 0 L 4 12 L 0 12 Z',
      'M 8 0 L 12 0 L 12 12 L 8 12 Z',
    ])
  })

  it('emits toggle when clicked', async () => {
    const wrapper = mount(PlayPauseButton, { props: { playing: false } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })
})
