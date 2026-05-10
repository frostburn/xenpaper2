import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import BlobDownloadLink from '../BlobDownloadLink.vue'

const createObjectURL = vi.fn<(blob: Blob) => string>()
const revokeObjectURL = vi.fn<(url: string) => void>()

describe('BlobDownloadLink', () => {
  beforeEach(() => {
    createObjectURL.mockReset()
    revokeObjectURL.mockReset()
    createObjectURL.mockReturnValue('blob:test-url')

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a downloadable object URL for the provided contents', () => {
    const wrapper = mount(BlobDownloadLink, {
      props: {
        filename: 'scores.xenpaper.json',
        contents: '{"scores":[]}',
        mimeType: 'application/vnd.xenpaper+json',
      },
      slots: {
        default: 'Export scores',
      },
    })

    const link = wrapper.get('a')
    expect(link.text()).toBe('Export scores')
    expect(link.attributes('href')).toBe('blob:test-url')
    expect(link.attributes('download')).toBe('scores.xenpaper.json')
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('revokes object URLs when contents change and when unmounted', async () => {
    createObjectURL.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second')
    const wrapper = mount(BlobDownloadLink, {
      props: {
        filename: 'scores.xenpaper.json',
        contents: 'first',
      },
    })

    await wrapper.setProps({ contents: 'second' })

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first')
    expect(wrapper.get('a').attributes('href')).toBe('blob:second')

    wrapper.unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:second')
  })
})
