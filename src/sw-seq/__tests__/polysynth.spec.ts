import { describe, expect, it, vi } from 'vitest'

import type { Bank } from '../bank'
import type { NoiseGeneratorType } from '../noise-worklet'
import { PolySynth, type SynthParams } from '../polysynth'

const createAudioParam = () => ({
  cancelScheduledValues: vi.fn<(time: number) => void>(),
  exponentialRampToValueAtTime: vi.fn<(value: number, endTime: number) => void>(),
  linearRampToValueAtTime: vi.fn<(value: number, endTime: number) => void>(),
  setValueCurveAtTime: vi.fn<(values: Float32Array, startTime: number, duration: number) => void>(),
  setTargetAtTime: vi.fn<(target: number, startTime: number, timeConstant: number) => void>(),
  setValueAtTime: vi.fn<(value: number, startTime: number) => void>(),
})

type MockAudioParam = ReturnType<typeof createAudioParam>

type MockOscillator = {
  detune: MockAudioParam
  frequency: MockAudioParam
  gain: MockAudioParam
  type: NoiseGeneratorType | OscillatorType
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
      allocateOscillator: vi.fn<(_time?: number) => MockOscillator | null>(() => {
        const oscillator = oscillators.shift() ?? null
        if (oscillator !== null) allocated.push(oscillator)
        return oscillator
      }),
      freeOscillator: vi.fn<(oscillator: MockOscillator, freeAt?: number) => void>(),
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

  it('uses the shared source path for noise generator frequencies', () => {
    const noise = createOscillator()
    const bank = {
      context: {},
      allocateNoiseGenerator: vi.fn<(_time?: number) => MockOscillator | null>(() => noise),
      freeNoiseGenerator: vi.fn<(oscillator: MockOscillator, freeAt?: number) => void>(),
    } as unknown as Bank
    const synth = new PolySynth(bank, {} as AudioNode)

    const note = synth.trigger({
      frequency: 440,
      velocity: 0.5,
      synth: {
        type: 'noise',
        noise: 'white',
        interpolation: 'constant',
        periodicity: 'noise',
        periodicWave: null,
        aperiodicWave: null,
      },
      envelope: {
        attack: 0.01,
        decay: 0.25,
        sustain: 0.5,
        release: 0.5,
      },
    })

    note.noteOn(1)

    expect(bank.allocateNoiseGenerator).toHaveBeenCalledTimes(1)
    expect(noise.frequency.setValueAtTime).toHaveBeenCalledWith(440, 1)
  })

  it('sets noise generator type through the shared type interface', () => {
    const noise = createOscillator()
    const bank = {
      context: {},
      allocateNoiseGenerator: vi.fn<(_time?: number) => MockOscillator | null>(() => noise),
      freeNoiseGenerator: vi.fn<(oscillator: MockOscillator, freeAt?: number) => void>(),
    } as unknown as Bank
    const synth = new PolySynth(bank, {} as AudioNode)

    const note = synth.trigger({
      frequency: 330,
      velocity: 0.5,
      synth: {
        type: 'noise',
        noise: 'violet',
        interpolation: 'linear',
        periodicity: 'noise',
        periodicWave: null,
        aperiodicWave: null,
      },
      envelope: {
        attack: 0.01,
        decay: 0.25,
        sustain: 0.5,
        release: 0.5,
      },
    })

    note.noteOn(1)

    expect(noise.type).toBe('violet')
  })

  it('ramps frequency linearly when requested', () => {
    const oscillator = createOscillator()
    const bank = {
      context: {},
      allocateOscillator: vi.fn<(_time?: number) => MockOscillator | null>(() => oscillator),
      freeOscillator: vi.fn<(oscillator: MockOscillator, freeAt?: number) => void>(),
    } as unknown as Bank
    const synth = new PolySynth(bank, {} as AudioNode)

    const note = synth.trigger({
      frequency: 220,
      frequencyEnd: 440,
      pitchInterpolation: 'linear',
      duration: 3,
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
    })

    note.noteOn(1)

    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(220, 1)
    expect(oscillator.detune.setValueAtTime).toHaveBeenCalledWith(0, 1)
    expect(oscillator.detune.linearRampToValueAtTime).toHaveBeenCalledWith(1200, 4)
    expect(oscillator.frequency.linearRampToValueAtTime).not.toHaveBeenCalled()
  })

  it('uses CSS easing curves for detune automation', () => {
    const oscillator = createOscillator()
    const bank = {
      context: {},
      allocateOscillator: vi.fn<(_time?: number) => MockOscillator | null>(() => oscillator),
      freeOscillator: vi.fn<(oscillator: MockOscillator, freeAt?: number) => void>(),
    } as unknown as Bank
    const synth = new PolySynth(bank, {} as AudioNode)

    const note = synth.trigger({
      frequency: 220,
      frequencyEnd: 440,
      pitchInterpolation: 'ease-in-out',
      duration: 3,
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
    })

    note.noteOn(1)

    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(220, 1)
    expect(oscillator.detune.setValueCurveAtTime).toHaveBeenCalledOnce()
    const [curve, startTime, duration] = oscillator.detune.setValueCurveAtTime.mock.calls[0]!
    expect(curve[0]).toBeCloseTo(0)
    expect(curve[curve.length - 1]).toBeCloseTo(1200)
    expect(startTime).toBe(1)
    expect(duration).toBe(3)
    expect(oscillator.frequency.linearRampToValueAtTime).not.toHaveBeenCalled()
  })
  it('reserves synth voices until their release tails finish', () => {
    const oscillator = createOscillator()
    const bank = {
      context: {},
      allocateOscillator: vi.fn<(_time?: number) => MockOscillator | null>(() => oscillator),
      freeOscillator: vi.fn<(oscillator: MockOscillator, freeAt?: number) => void>(),
    } as unknown as Bank
    const synth = new PolySynth(bank, {} as AudioNode)

    const note = synth.trigger({
      frequency: 440,
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
    })

    note.noteOn(1)
    note.noteOff(2)

    expect(bank.allocateOscillator).toHaveBeenCalledWith(1, {
      type: 'sine',
      periodicity: 'harmonic',
      periodicWave: null,
      aperiodicWave: null,
    })
    expect(bank.freeOscillator).toHaveBeenCalledWith(oscillator, 2.5)
  })
})
