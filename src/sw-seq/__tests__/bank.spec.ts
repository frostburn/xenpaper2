import { describe, expect, it, vi } from 'vitest'

import { Bank } from '../bank'

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
    expect(context.gains[0]!.disconnect).toHaveBeenCalledTimes(1)
  })

  it('does not recycle an oscillator before its scheduled free time', () => {
    const context = new MockAudioContext()
    const bank = new Bank(context as unknown as AudioContext, 1)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const oscillator = bank.allocateOscillator(1)
    expect(oscillator).not.toBeNull()
    bank.freeOscillator(oscillator!, 3)

    expect(bank.allocateOscillator(2)).toBeNull()
    expect(bank.allocateOscillator(3)).toBe(oscillator)
    expect(warn).toHaveBeenCalledTimes(1)

    warn.mockRestore()
  })

  it('resets recycled oscillator automation at the scheduled reuse time', () => {
    const context = new MockAudioContext()
    const bank = new Bank(context as unknown as AudioContext, 1)

    const oscillator = bank.allocateOscillator(1)
    expect(oscillator).not.toBeNull()
    bank.freeOscillator(oscillator!, 2)

    const reusedGain = context.gains[0]!.gain
    reusedGain.setValueAtTime.mockClear()

    expect(bank.allocateOscillator(2.5)).toBe(oscillator)

    expect(reusedGain.cancelScheduledValues).toHaveBeenCalledWith(2.5)
    expect(reusedGain.setValueAtTime).toHaveBeenCalledWith(0, 2.5)
  })
})
