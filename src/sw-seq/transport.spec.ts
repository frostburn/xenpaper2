import { describe, expect, it } from 'vitest'

import { Transport } from './transport'

class MockAudioContext {
  currentTime = 0
  sampleRate = 100
  destination = {} as AudioDestinationNode

  createConstantSource() {
    return {
      onended: null as null | (() => void),
      start: (_time?: number) => undefined,
      stop: (_time?: number) => undefined,
    }
  }
}

const tick = (transport: Transport, times = 1) => {
  const inner = transport as unknown as { onInterval: () => void }
  for (let i = 0; i < times; i++) inner.onInterval()
}

describe('Transport scheduleParametricNote', () => {
  it('returns one id and can be cleared atomically', () => {
    const transport = new Transport(new MockAudioContext() as unknown as AudioContext, 1, 0)
    const calls: string[] = []
    transport.start(0)

    const id = transport.scheduleParametricNote(
      {
        noteOn: () => calls.push('on'),
        noteOff: () => calls.push('off'),
      },
      0.25,
      0.75,
    )

    transport.clear(id)
    tick(transport, 2)

    expect(calls).toEqual([])
  })

  it('schedules note callbacks through the note-handle entry', () => {
    const transport = new Transport(new MockAudioContext() as unknown as AudioContext, 1, 0)
    const calls: string[] = []
    transport.start(0)

    transport.scheduleParametricNote(
      {
        noteOn: () => calls.push('on'),
        noteOff: () => calls.push('off'),
      },
      0,
      1,
    )

    tick(transport, 3)

    expect(calls).toContain('off')
  })

  it('clearAll removes scheduled note handles', () => {
    const transport = new Transport(new MockAudioContext() as unknown as AudioContext, 1, 0)
    let called = false
    transport.start(0)

    transport.scheduleParametricNote(
      {
        noteOn: () => {
          called = true
        },
        noteOff: () => {
          called = true
        },
      },
      0,
      1,
    )

    transport.clearAll()
    tick(transport, 3)

    expect(called).toBe(false)
  })
})
