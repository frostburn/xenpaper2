import { EnvelopedAperiodicOscillator, EnvelopedOscillator, EnvelopedUnison } from './nodes'
import { createNoiseGeneratorNode, type NoiseGeneratorNode } from './noise-worklet'

/**
 * Bank of re-usable enveloped oscillator nodes.
 *
 * Web Audio API gives the impression that disconnected and stopped audio nodes are garbage collected,
 * but that's not always true unfortunately.
 */
export class Bank {
  readonly context: AudioContext
  private maxPolyphony: number
  // Negative age indicates that the node is reserved
  private oscillators: { node: EnvelopedOscillator; age: number }[]
  private unisons: { node: EnvelopedUnison; age: number }[]
  private aperiodics: { node: EnvelopedAperiodicOscillator; age: number }[]
  private noiseGenerators: { node: NoiseGeneratorNode; age: number }[]

  constructor(context: AudioContext, maxPolyphony = 32) {
    this.context = context
    this.maxPolyphony = maxPolyphony
    this.oscillators = []
    this.unisons = []
    this.aperiodics = []
    this.noiseGenerators = []
  }

  allocateOscillator() {
    if (this.oscillators.length < this.maxPolyphony) {
      const osc = { node: new EnvelopedOscillator(this.context), age: -1 }
      osc.node.start(this.context.currentTime)
      this.oscillators.push(osc)
      return osc.node
    }
    const maxAge = this.oscillators.reduce((a, b) => Math.max(a, b.age), -1)
    if (maxAge < 0) {
      console.warn('Maximum polyphony reached.')
      return null
    }
    const osc = this.oscillators.find((o) => o.age === maxAge)
    if (!osc) {
      return null
    }
    osc.age = -1
    osc.node.detune.cancelScheduledValues(this.context.currentTime)
    osc.node.frequency.cancelScheduledValues(this.context.currentTime)
    osc.node.gain.cancelScheduledValues(this.context.currentTime)
    osc.node.gain.setValueAtTime(0, this.context.currentTime)
    osc.node.disconnect()
    return osc.node
  }

  freeOscillator(node: EnvelopedOscillator) {
    const osc = this.oscillators.find((o) => o.node === node)
    if (osc === undefined) {
      throw new Error('Attempting to free unallocated oscillator.')
    }
    osc.age = 0
    this.oscillators.forEach((o) => {
      if (o.age >= 0) {
        o.age++
      }
    })
  }

  allocateUnison() {
    if (this.unisons.length < this.maxPolyphony) {
      const osc = {
        node: new EnvelopedUnison(this.context, { spread: 5, numberOfVoices: 3 }, 'detune'),
        age: -1,
      }
      osc.node.start(this.context.currentTime)
      this.unisons.push(osc)
      return osc.node
    }
    const maxAge = this.unisons.reduce((a, b) => Math.max(a, b.age), -1)
    if (maxAge < 0) {
      console.warn('Maximum polyphony reached.')
      return null
    }
    const osc = this.unisons.find((o) => o.age === maxAge)
    if (!osc) {
      return null
    }
    osc.age = -1
    osc.node.spread.cancelScheduledValues(this.context.currentTime)
    osc.node.detune.cancelScheduledValues(this.context.currentTime)
    osc.node.frequency.cancelScheduledValues(this.context.currentTime)
    osc.node.gain.cancelScheduledValues(this.context.currentTime)
    osc.node.gain.setValueAtTime(0, this.context.currentTime)
    osc.node.disconnect()
    return osc.node
  }

  freeUnison(node: EnvelopedUnison) {
    const osc = this.unisons.find((o) => o.node === node)
    if (osc === undefined) {
      throw new Error('Attempting to free unallocated unison oscillator.')
    }
    osc.age = 0
    this.unisons.forEach((o) => {
      if (o.age >= 0) {
        o.age++
      }
    })
  }

  allocateAperiodicOscillator() {
    if (this.aperiodics.length < this.maxPolyphony) {
      const osc = { node: new EnvelopedAperiodicOscillator(this.context), age: -1 }
      osc.node.start(this.context.currentTime)
      this.aperiodics.push(osc)
      return osc.node
    }
    const maxAge = this.aperiodics.reduce((a, b) => Math.max(a, b.age), -1)
    if (maxAge < 0) {
      console.warn('Maximum polyphony reached.')
      return null
    }
    const osc = this.aperiodics.find((o) => o.age === maxAge)
    if (!osc) {
      return null
    }
    osc.age = -1
    osc.node.detune.cancelScheduledValues(this.context.currentTime)
    osc.node.frequency.cancelScheduledValues(this.context.currentTime)
    osc.node.gain.cancelScheduledValues(this.context.currentTime)
    osc.node.gain.setValueAtTime(0, this.context.currentTime)
    osc.node.disconnect()
    return osc.node
  }

  freeAperiodicOscillator(node: EnvelopedAperiodicOscillator) {
    const osc = this.aperiodics.find((o) => o.node === node)
    if (osc === undefined) {
      throw new Error('Attempting to free unallocated aperiodic oscillator.')
    }
    osc.age = 0
    this.aperiodics.forEach((o) => {
      if (o.age >= 0) {
        o.age++
      }
    })
  }

  allocateNoiseGenerator() {
    const audioWorklet = this.context.audioWorklet
    if (audioWorklet === undefined) {
      return null
    }
    if (this.noiseGenerators.length < this.maxPolyphony) {
      const osc = { node: createNoiseGeneratorNode(this.context), age: -1 }
      this.noiseGenerators.push(osc)
      return osc.node
    }
    const maxAge = this.noiseGenerators.reduce((a, b) => Math.max(a, b.age), -1)
    if (maxAge < 0) {
      console.warn('Maximum polyphony reached.')
      return null
    }
    const osc = this.noiseGenerators.find((o) => o.age === maxAge)
    if (!osc) {
      return null
    }
    osc.age = -1
    osc.node.detune.cancelScheduledValues(this.context.currentTime)
    osc.node.frequency.cancelScheduledValues(this.context.currentTime)
    osc.node.gain.cancelScheduledValues(this.context.currentTime)
    osc.node.gain.setValueAtTime(0, this.context.currentTime)
    osc.node.disconnect()
    return osc.node
  }

  freeNoiseGenerator(node: NoiseGeneratorNode) {
    const osc = this.noiseGenerators.find((o) => o.node === node)
    if (osc === undefined) {
      throw new Error('Attempting to free unallocated noise generator.')
    }
    osc.age = 0
    this.noiseGenerators.forEach((o) => {
      if (o.age >= 0) {
        o.age++
      }
    })
  }

  stop() {
    this.oscillators.forEach((o) => {
      o.node.detune.cancelScheduledValues(this.context.currentTime)
      o.node.frequency.cancelScheduledValues(this.context.currentTime)
      o.node.gain.cancelScheduledValues(this.context.currentTime)
      o.node.gain.setValueAtTime(0, this.context.currentTime)
      o.node.disconnect()
      o.age = 1
    })

    this.unisons.forEach((o) => {
      o.node.spread.cancelScheduledValues(this.context.currentTime)
      o.node.detune.cancelScheduledValues(this.context.currentTime)
      o.node.frequency.cancelScheduledValues(this.context.currentTime)
      o.node.gain.cancelScheduledValues(this.context.currentTime)
      o.node.gain.setValueAtTime(0, this.context.currentTime)
      o.node.disconnect()
      o.age = 1
    })

    this.aperiodics.forEach((o) => {
      o.node.detune.cancelScheduledValues(this.context.currentTime)
      o.node.frequency.cancelScheduledValues(this.context.currentTime)
      o.node.gain.cancelScheduledValues(this.context.currentTime)
      o.node.gain.setValueAtTime(0, this.context.currentTime)
      o.node.disconnect()
      o.age = 1
    })

    this.noiseGenerators.forEach((o) => {
      o.node.detune.cancelScheduledValues(this.context.currentTime)
      o.node.frequency.cancelScheduledValues(this.context.currentTime)
      o.node.gain.cancelScheduledValues(this.context.currentTime)
      o.node.gain.setValueAtTime(0, this.context.currentTime)
      o.node.disconnect()
      o.age = 1
    })
  }
}
