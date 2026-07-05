import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createNoiseGeneratorNode,
  isNoiseGeneratorType,
  type NoiseGeneratorType,
} from '../noise-worklet'

const NOISE_GENERATOR_TYPES = [
  'white',
  'pink',
  'brown',
  'blue',
  'violet',
] as const satisfies readonly NoiseGeneratorType[]

const createAudioParam = () => ({
  setValueAtTime: vi.fn<(value: number, time: number) => void>(),
})

const originalAudioWorkletNode = globalThis.AudioWorkletNode

describe('noise worklet', () => {
  afterEach(() => {
    globalThis.AudioWorkletNode = originalAudioWorkletNode
  })

  it('recognizes all supported noise colors', () => {
    expect(NOISE_GENERATOR_TYPES.every((noise) => isNoiseGeneratorType(noise))).toBe(true)
  })

  it('rejects unsupported noise colors', () => {
    expect(isNoiseGeneratorType('green')).toBe(false)
  })

  it('routes continuously generated worklet noise through an external gain node', () => {
    const detune = createAudioParam()
    const frequency = createAudioParam()
    const workletConnect = vi.fn<(destination: unknown) => void>()
    const postMessage = vi.fn<(message: unknown) => void>()
    class MockAudioWorkletNode {
      parameters = new Map([
        ['detune', detune],
        ['frequency', frequency],
      ])
      port = { postMessage }
      connect = workletConnect
    }
    globalThis.AudioWorkletNode = MockAudioWorkletNode as unknown as typeof AudioWorkletNode

    const gain = createAudioParam()
    const output = {
      gain,
      connect: vi.fn<(destination: unknown) => void>(),
      disconnect: vi.fn<() => void>(),
    }
    const context = {
      currentTime: 1.25,
      createGain: vi.fn(() => output),
    } as unknown as BaseAudioContext

    const node = createNoiseGeneratorNode(context)
    node.type = 'pink'

    expect(workletConnect).toHaveBeenCalledWith(output)
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 1.25)
    expect(node.gain).toBe(gain)
    expect(node.detune).toBe(detune)
    expect(node.frequency).toBe(frequency)
    expect(postMessage).toHaveBeenCalledWith({ type: 'noise', noise: 'pink' })
  })
})
