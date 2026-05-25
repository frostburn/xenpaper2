/**
 * OscillatorNode in series with a GainNode.
 */
export class EnvelopedOscillator {
  private oscillator: OscillatorNode
  private _gain: GainNode

  constructor(context: BaseAudioContext) {
    this.oscillator = context.createOscillator()
    this._gain = context.createGain()
    this._gain.gain.setValueAtTime(0, context.currentTime)
    this.oscillator.connect(this._gain)
  }

  get detune() {
    return this.oscillator.detune
  }

  get frequency() {
    return this.oscillator.frequency
  }

  get type() {
    return this.oscillator.type
  }

  set type(value: OscillatorType) {
    this.oscillator.type = value
  }

  get gain() {
    return this._gain.gain
  }

  connect(destination: AudioNode) {
    return this._gain.connect(destination)
  }

  disconnect() {
    this._gain.disconnect()
  }

  start(time?: number) {
    this.oscillator.start(time)
  }

  stop(time?: number) {
    this.oscillator.stop(time)
  }
}

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

  constructor(context: AudioContext, maxPolyphony = 32) {
    this.context = context
    this.maxPolyphony = maxPolyphony
    this.oscillators = []
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

  stop() {
    this.oscillators.forEach((o) => {
      o.node.detune.cancelScheduledValues(this.context.currentTime)
      o.node.frequency.cancelScheduledValues(this.context.currentTime)
      o.node.gain.cancelScheduledValues(this.context.currentTime)
      o.node.disconnect()
      o.age = 1
    })
  }
}
