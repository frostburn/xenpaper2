const NOISE_GENERATOR_PROCESSOR_NAME = 'sw-seq-noise-generator'

export type NoiseGeneratorType = 'white' | 'pink' | 'brown' | 'blue' | 'violet'

const NOISE_GENERATOR_TYPES = new Set<string>(['white', 'pink', 'brown', 'blue', 'violet'])

export function isNoiseGeneratorType(noise: string): noise is NoiseGeneratorType {
  return NOISE_GENERATOR_TYPES.has(noise)
}

export function isOfflineAudioContext(context: BaseAudioContext): context is OfflineAudioContext {
  return (
    (typeof OfflineAudioContext !== 'undefined' && context instanceof OfflineAudioContext) ||
    context.constructor.name === 'OfflineAudioContext'
  )
}

const NOISE_GENERATOR_WORKLET_JS = `
const PINK_OCTAVE_COUNT = 10
const PINK_GAIN = 1 / Math.sqrt(PINK_OCTAVE_COUNT)

class SWSeqNoiseGenerator extends AudioWorkletProcessor {
  constructor() {
    super()
    this.phase = 1
    this.noise = 'white'
    this.currentSample = 0
    this.previousWhiteSample = 0
    this.previousPinkSample = 0
    this.brownSample = 0
    this.pinkOctaveSamples = new Float64Array(PINK_OCTAVE_COUNT)
    this.pinkOctaveCountdowns = new Uint32Array(PINK_OCTAVE_COUNT)

    this.port.onmessage = (event) => {
      if (event.data?.type !== 'noise') return
      if (
        event.data.noise !== 'white' &&
        event.data.noise !== 'pink' &&
        event.data.noise !== 'brown' &&
        event.data.noise !== 'blue' &&
        event.data.noise !== 'violet'
      ) {
        return
      }
      this.noise = event.data.noise
      this.currentSample = 0
      this.previousWhiteSample = 0
      this.previousPinkSample = 0
      this.brownSample = 0
      this.pinkOctaveSamples.fill(0)
      this.pinkOctaveCountdowns.fill(0)
      this.phase = 1
    }
  }

  nextPinkSample() {
    let pinkSample = 0

    for (let octave = 0; octave < PINK_OCTAVE_COUNT; octave++) {
      if (this.pinkOctaveCountdowns[octave] === 0) {
        this.pinkOctaveSamples[octave] = Math.random() * 2 - 1
        this.pinkOctaveCountdowns[octave] = 1 << octave
      }

      pinkSample += this.pinkOctaveSamples[octave]
      this.pinkOctaveCountdowns[octave]--
    }

    return pinkSample * PINK_GAIN
  }

  nextSample() {
    if (this.noise === 'pink') {
      return this.nextPinkSample()
    }

    if (this.noise === 'blue') {
      const pinkSample = this.nextPinkSample()
      const blueSample = pinkSample - this.previousPinkSample
      this.previousPinkSample = pinkSample
      return blueSample
    }

    const whiteSample = Math.random() * 2 - 1

    if (this.noise === 'brown') {
      this.brownSample = this.brownSample * 0.95 + whiteSample * 0.8
      this.brownSample = Math.max(-2, Math.min(2, this.brownSample))
      return this.brownSample
    }

    if (this.noise === 'violet') {
      const violetSample = (whiteSample - this.previousWhiteSample) * 0.66
      this.previousWhiteSample = whiteSample
      return violetSample
    }

    return whiteSample
  }

  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, automationRate: 'a-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'a-rate' },
    ]
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]
    const frequencies = parameters.frequency
    const detunes = parameters.detune
    const frameCount = output[0]?.length ?? 0

    for (let sampleIndex = 0; sampleIndex < frameCount; sampleIndex++) {
      const frequency = frequencies.length === 1 ? frequencies[0] : frequencies[sampleIndex]
      const detune = detunes.length === 1 ? detunes[0] : detunes[sampleIndex]
      const effectiveFrequency = Math.max(0, frequency * Math.pow(2, detune / 1200))

      this.phase += effectiveFrequency / sampleRate
      if (this.phase >= 1) {
        this.currentSample = this.nextSample()
        this.phase -= Math.floor(this.phase)
      }

      for (let channelIndex = 0; channelIndex < output.length; channelIndex++) {
        output[channelIndex][sampleIndex] = this.currentSample
      }
    }

    return true
  }
}

registerProcessor('${NOISE_GENERATOR_PROCESSOR_NAME}', SWSeqNoiseGenerator)
`

const registrationPromises = new WeakMap<BaseAudioContext, Promise<void>>()

export function registerNoiseGeneratorWorklet(context: BaseAudioContext): Promise<void> {
  const cached = registrationPromises.get(context)
  if (cached !== undefined) return cached

  const audioWorklet = context.audioWorklet
  if (audioWorklet === undefined) {
    return Promise.reject(
      new Error(
        'AudioWorklet is not available in this context. Try running under HTTPS or localhost.',
      ),
    )
  }

  const blob = new Blob([NOISE_GENERATOR_WORKLET_JS], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  const promise = audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url))
  registrationPromises.set(context, promise)
  return promise
}

export type NoiseGeneratorNode = GainNode &
  Pick<OscillatorNode, 'detune' | 'frequency'> & {
    type: NoiseGeneratorType
  }

export function createNoiseGeneratorNode(context: BaseAudioContext): NoiseGeneratorNode {
  const worklet = new AudioWorkletNode(context, NOISE_GENERATOR_PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  })
  const output = context.createGain() as NoiseGeneratorNode
  output.gain.setValueAtTime(0, context.currentTime)
  worklet.connect(output)

  let type: NoiseGeneratorType = 'white'

  Object.defineProperties(output, {
    detune: { value: worklet.parameters.get('detune') },
    frequency: { value: worklet.parameters.get('frequency') },
    source: { value: worklet },
    type: {
      get: () => type,
      set: (value: NoiseGeneratorType) => {
        if (!isNoiseGeneratorType(value)) {
          throw new Error(`"${value}" is not a valid noise generator.`)
        }
        type = value
        worklet.port.postMessage({ type: 'noise', noise: value })
      },
    },
  })

  return output
}
