import { afterEach, describe, expect, it, vi } from 'vitest'

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

type MockAudioWorkletNode = {
  parameters: Map<string, MockAudioParam>
  port: { postMessage: ReturnType<typeof vi.fn<(message: unknown) => void>> }
  connect: ReturnType<typeof vi.fn<(destination: unknown) => void>>
  disconnect: ReturnType<typeof vi.fn<() => void>>
}

class MockAudioContext {
  currentTime = 12.5
  destination = {}
  oscillators: MockOscillator[] = []
  gains: MockGain[] = []
  audioWorklet = {}

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

class OfflineAudioContext extends MockAudioContext {}

const originalAudioWorkletNode = globalThis.AudioWorkletNode

describe('Bank', () => {
  afterEach(() => {
    globalThis.AudioWorkletNode = originalAudioWorkletNode
  })

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

  it('does not recycle noise generators while scheduling an offline render', () => {
    const createdNodes: MockAudioWorkletNode[] = []
    class MockGlobalAudioWorkletNode {
      parameters = new Map([
        ['detune', createAudioParam()],
        ['frequency', createAudioParam()],
        ['gain', createAudioParam()],
      ])
      port = { postMessage: vi.fn<(message: unknown) => void>() }
      connect = vi.fn<(destination: unknown) => void>()
      disconnect = vi.fn<() => void>()

      constructor() {
        createdNodes.push(this)
      }
    }
    globalThis.AudioWorkletNode = MockGlobalAudioWorkletNode as unknown as typeof AudioWorkletNode

    const context = new OfflineAudioContext()
    const bank = new Bank(context as unknown as BaseAudioContext, 1)

    const first = bank.allocateNoiseGenerator()
    expect(first).not.toBeNull()
    bank.freeNoiseGenerator(first!)

    const second = bank.allocateNoiseGenerator()

    expect(second).not.toBe(first)
    expect(createdNodes).toHaveLength(2)
    expect(createdNodes[0]!.disconnect).not.toHaveBeenCalled()
  })
})
