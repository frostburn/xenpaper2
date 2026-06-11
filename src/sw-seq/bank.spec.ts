import { describe, expect, it, vi } from 'vitest'

import { Bank } from './bank'

const createAudioParam = () => ({
  cancelScheduledValues: vi.fn<(time: number) => void>(),
  setValueAtTime: vi.fn<(value: number, time: number) => void>(),
})

type MockAudioParam = ReturnType<typeof createAudioParam>

type MockOscillator = {
  detune: MockAudioParam
  frequency: MockAudioParam
  connect: ReturnType<typeof vi.fn<(destination: unknown) => void>>
  start: ReturnType<typeof vi.fn<(time?: number) => void>>
}

type MockGain = {
  gain: MockAudioParam
  connect: ReturnType<typeof vi.fn<(destination: unknown) => void>>
  disconnect: ReturnType<typeof vi.fn<() => void>>
}

class MockAudioContext {
  currentTime = 12.5
  destination = {}
  oscillators: MockOscillator[] = []
  gains: MockGain[] = []

  createOscillator(): MockOscillator {
    const oscillator = {
      detune: createAudioParam(),
      frequency: createAudioParam(),
      connect: vi.fn<(destination: unknown) => void>(),
      start: vi.fn<(time?: number) => void>(),
    }
    this.oscillators.push(oscillator)
    return oscillator
  }

  createGain(): MockGain {
    const gain = {
      gain: createAudioParam(),
      connect: vi.fn<(destination: unknown) => void>(),
      disconnect: vi.fn<() => void>(),
    }
    this.gains.push(gain)
    return gain
  }
}

describe('Bank', () => {
  it('silences a recycled oscillator before reconnecting it', () => {
    const context = new MockAudioContext()
    const bank = new Bank(context as unknown as AudioContext, 1)

    const oscillator = bank.allocateOscillator()
    expect(oscillator).not.toBeNull()
    bank.freeOscillator(oscillator!)

    const reusedGain = context.gains[0]!.gain
    reusedGain.setValueAtTime.mockClear()

    expect(bank.allocateOscillator()).toBe(oscillator)

    expect(reusedGain.cancelScheduledValues).toHaveBeenCalledWith(context.currentTime)
    expect(reusedGain.setValueAtTime).toHaveBeenCalledWith(0, context.currentTime)
  })
})
