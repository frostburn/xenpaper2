const NOISE_GENERATOR_PROCESSOR_NAME = 'sw-seq-noise-generator'

const NOISE_GENERATOR_WORKLET_JS = `
class SWSeqNoiseGenerator extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, automationRate: 'a-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'a-rate' },
      { name: 'gain', defaultValue: 0, automationRate: 'a-rate' },
    ]
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]
    const gains = parameters.gain
    for (let channelIndex = 0; channelIndex < output.length; channelIndex++) {
      const channel = output[channelIndex]
      for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex++) {
        const gain = gains.length === 1 ? gains[0] : gains[sampleIndex]
        channel[sampleIndex] = (Math.random() * 2 - 1) * gain
      }
    }
    return true
  }
}

registerProcessor('${NOISE_GENERATOR_PROCESSOR_NAME}', SWSeqNoiseGenerator)
`

const registrationPromises = new WeakMap<BaseAudioContext, Promise<void>>()

export const getNoiseGeneratorProcessorName = () => NOISE_GENERATOR_PROCESSOR_NAME

export function registerNoiseGeneratorWorklet(context: BaseAudioContext): Promise<void> {
  const cached = registrationPromises.get(context)
  if (cached !== undefined) return cached

  const audioWorklet = context.audioWorklet
  if (audioWorklet === undefined) {
    return Promise.reject(new Error('AudioWorklet is not available in this browser.'))
  }

  const blob = new Blob([NOISE_GENERATOR_WORKLET_JS], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  const promise = audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url))
  registrationPromises.set(context, promise)
  return promise
}

export type NoiseGeneratorNode = AudioWorkletNode & GainNode & OscillatorNode

export function createNoiseGeneratorNode(context: BaseAudioContext): NoiseGeneratorNode {
  const node = new AudioWorkletNode(context, getNoiseGeneratorProcessorName(), {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  }) as NoiseGeneratorNode

  Object.defineProperties(node, {
    detune: { value: node.parameters.get('detune') },
    frequency: { value: node.parameters.get('frequency') },
    gain: { value: node.parameters.get('gain') },
    onended: { value: null, writable: true },
    setPeriodicWave: { value: () => undefined },
    start: { value: () => undefined },
    stop: { value: () => undefined },
    type: { value: 'sine', writable: true },
  })

  return node
}
