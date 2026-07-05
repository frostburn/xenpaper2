const NOISE_GENERATOR_PROCESSOR_NAME = 'sw-seq-noise-generator'

export type NoiseGeneratorType = 'white' | 'pink' | 'brown' | 'blue' | 'violet'

const NOISE_GENERATOR_TYPES = new Set<string>(['white', 'pink', 'brown', 'blue', 'violet'])

export function isNoiseGeneratorType(noise: string): noise is NoiseGeneratorType {
  return NOISE_GENERATOR_TYPES.has(noise)
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
      { name: 'gain', defaultValue: 0, automationRate: 'a-rate' },
    ]
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]
    const frequencies = parameters.frequency
    const detunes = parameters.detune
    const gains = parameters.gain
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

      const gain = gains.length === 1 ? gains[0] : gains[sampleIndex]
      const value = this.currentSample * gain
      for (let channelIndex = 0; channelIndex < output.length; channelIndex++) {
        output[channelIndex][sampleIndex] = value
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

export type NoiseGeneratorNode = AudioWorkletNode &
  GainNode &
  Pick<OscillatorNode, 'detune' | 'frequency'> & {
    type: NoiseGeneratorType
  }

const BUFFERED_NOISE_BASE_FREQUENCY = 440
const BUFFERED_NOISE_SECONDS = 8
const PINK_OCTAVE_COUNT = 10
const PINK_GAIN = 1 / Math.sqrt(PINK_OCTAVE_COUNT)

function createNoiseSampleGenerator(noise: NoiseGeneratorType): () => number {
  let previousWhiteSample = 0
  let previousPinkSample = 0
  let brownSample = 0
  const pinkOctaveSamples = new Float64Array(PINK_OCTAVE_COUNT)
  const pinkOctaveCountdowns = new Uint32Array(PINK_OCTAVE_COUNT)

  const nextPinkSample = () => {
    let pinkSample = 0

    for (let octave = 0; octave < PINK_OCTAVE_COUNT; octave++) {
      if (pinkOctaveCountdowns[octave] === 0) {
        pinkOctaveSamples[octave] = Math.random() * 2 - 1
        pinkOctaveCountdowns[octave] = 1 << octave
      }

      pinkSample += pinkOctaveSamples[octave] ?? 0
      pinkOctaveCountdowns[octave] = (pinkOctaveCountdowns[octave] ?? 1) - 1
    }

    return pinkSample * PINK_GAIN
  }

  return () => {
    if (noise === 'pink') return nextPinkSample()

    if (noise === 'blue') {
      const pinkSample = nextPinkSample()
      const blueSample = pinkSample - previousPinkSample
      previousPinkSample = pinkSample
      return blueSample
    }

    const whiteSample = Math.random() * 2 - 1

    if (noise === 'brown') {
      brownSample = brownSample * 0.95 + whiteSample * 0.8
      brownSample = Math.max(-2, Math.min(2, brownSample))
      return brownSample
    }

    if (noise === 'violet') {
      const violetSample = (whiteSample - previousWhiteSample) * 0.66
      previousWhiteSample = whiteSample
      return violetSample
    }

    return whiteSample
  }
}

function createNoiseBuffer(context: BaseAudioContext, noise: NoiseGeneratorType): AudioBuffer {
  const frameCount = Math.max(1, Math.ceil(context.sampleRate * BUFFERED_NOISE_SECONDS))
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const channel = buffer.getChannelData(0)
  const nextSample = createNoiseSampleGenerator(noise)

  for (let index = 0; index < channel.length; index++) channel[index] = nextSample()

  return buffer
}

export function createBufferedNoiseGeneratorNode(context: BaseAudioContext): NoiseGeneratorNode {
  let type: NoiseGeneratorType = 'white'
  let source: AudioBufferSourceNode
  const frequencySource = context.createConstantSource()
  const playbackRateScaler = context.createGain()
  const gainNode = context.createGain()

  frequencySource.offset.setValueAtTime(BUFFERED_NOISE_BASE_FREQUENCY, context.currentTime)
  playbackRateScaler.gain.setValueAtTime(1 / BUFFERED_NOISE_BASE_FREQUENCY, context.currentTime)
  frequencySource.connect(playbackRateScaler)
  frequencySource.start(context.currentTime)
  gainNode.gain.setValueAtTime(0, context.currentTime)

  const startSource = () => {
    if (source !== undefined) {
      playbackRateScaler.disconnect()
      source.disconnect()
      source.stop(context.currentTime)
    }

    source = context.createBufferSource()
    source.buffer = createNoiseBuffer(context, type)
    source.loop = true
    playbackRateScaler.connect(source.playbackRate)
    source.connect(gainNode)
    source.start(context.currentTime)
  }

  startSource()

  Object.defineProperties(gainNode, {
    detune: { get: () => source.detune },
    frequency: { value: frequencySource.offset },
    type: {
      get: () => type,
      set: (value: NoiseGeneratorType) => {
        if (!isNoiseGeneratorType(value)) {
          throw new Error(`"${value}" is not a valid noise generator.`)
        }
        if (value === type) return
        type = value
        startSource()
      },
    },
  })

  return gainNode as NoiseGeneratorNode
}

export function createNoiseGeneratorNode(context: BaseAudioContext): NoiseGeneratorNode {
  const node = new AudioWorkletNode(context, NOISE_GENERATOR_PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  }) as NoiseGeneratorNode

  let type: NoiseGeneratorType = 'white'

  Object.defineProperties(node, {
    detune: { value: node.parameters.get('detune') },
    frequency: { value: node.parameters.get('frequency') },
    gain: { value: node.parameters.get('gain') },
    type: {
      get: () => type,
      set: (value: NoiseGeneratorType) => {
        if (!isNoiseGeneratorType(value)) {
          throw new Error(`"${value}" is not a valid noise generator.`)
        }
        type = value
        node.port.postMessage({ type: 'noise', noise: value })
      },
    },
  })

  return node
}
