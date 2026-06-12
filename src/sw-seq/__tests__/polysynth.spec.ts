import { describe, expect, it, vi } from 'vitest'

import type { Bank } from '../bank'
import { PolySynth, type SynthParams } from '../polysynth'

const createAudioParam = () => ({
  cancelScheduledValues: vi.fn<(time: number) => void>(),
  linearRampToValueAtTime: vi.fn<(value: number, endTime: number) => void>(),
  setTargetAtTime: vi.fn<(target: number, startTime: number, timeConstant: number) => void>(),
  setValueAtTime: vi.fn<(value: number, startTime: number) => void>(),
})

type MockAudioParam = ReturnType<typeof createAudioParam>

type MockOscillator = {
  detune: MockAudioParam
  frequency: MockAudioParam
  gain: MockAudioParam
  type: OscillatorType
  connect: ReturnType<typeof vi.fn<(destination: unknown) => void>>
  disconnect: ReturnType<typeof vi.fn<() => void>>
}

const createOscillator = (): MockOscillator => ({
  detune: createAudioParam(),
  frequency: createAudioParam(),
  gain: createAudioParam(),
  type: 'sine',
  connect: vi.fn<(destination: unknown) => void>(),
  disconnect: vi.fn<() => void>(),
})

describe('PolySynth', () => {
  it('captures each note frequency when creating note handles', () => {
    const allocated: MockOscillator[] = []
    const oscillators = [createOscillator(), createOscillator()]
    const bank = {
      context: {},
      allocateOscillator: vi.fn<() => MockOscillator | null>(() => {
        const oscillator = oscillators.shift() ?? null
        if (oscillator !== null) allocated.push(oscillator)
        return oscillator
      }),
      freeOscillator: vi.fn<(oscillator: MockOscillator) => void>(),
    } as unknown as Bank
    const synth = new PolySynth(bank, {} as AudioNode)
    const patch: SynthParams = {
      frequency: 220,
      velocity: 0.5,
      synth: {
        type: 'sine',
        periodicity: 'harmonic',
        periodicWave: null,
        aperiodicWave: null,
      },
      envelope: {
        attack: 0.01,
        decay: 0.25,
        sustain: 0.5,
        release: 0.5,
      },
    }

    const firstNote = synth.trigger(patch)
    patch.frequency = 330
    const secondNote = synth.trigger(patch)

    firstNote.noteOn(1)
    secondNote.noteOn(2)

    expect(oscillators).toHaveLength(0)
    expect(bank.allocateOscillator).toHaveBeenCalledTimes(2)
    expect(allocated[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(220, 1)
    expect(allocated[1]!.frequency.setValueAtTime).toHaveBeenCalledWith(330, 2)
  })
})
