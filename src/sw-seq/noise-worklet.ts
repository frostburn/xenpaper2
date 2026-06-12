const NOISE_GENERATOR_PROCESSOR_NAME = 'sw-seq-noise-generator'

const NOISE_GENERATOR_WORKLET_JS = `
class SWSeqNoiseGenerator extends AudioWorkletProcessor {
  constructor() {
    super()
    this.phase = 1
    this.currentSample = 0
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
        this.currentSample = Math.random() * 2 - 1
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
  Pick<OscillatorNode, 'detune' | 'frequency'>

export function createNoiseGeneratorNode(context: BaseAudioContext): NoiseGeneratorNode {
  const node = new AudioWorkletNode(context, NOISE_GENERATOR_PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  }) as NoiseGeneratorNode

  Object.defineProperties(node, {
    detune: { value: node.parameters.get('detune') },
    frequency: { value: node.parameters.get('frequency') },
    gain: { value: node.parameters.get('gain') },
  })

  return node
}
