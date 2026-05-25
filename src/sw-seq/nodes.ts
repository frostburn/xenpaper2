import { UnisonOscillator, type UnisonOscillatorOptions } from 'aperiodic-oscillator'

/**
 * OscillatorNode in series with a GainNode.
 */
export class EnvelopedOscillator implements OscillatorNode, GainNode {
  private oscillator: OscillatorNode
  private gainNode: GainNode

  constructor(context: BaseAudioContext) {
    this.oscillator = context.createOscillator()
    this.gainNode = context.createGain()
    this.gainNode.gain.setValueAtTime(0, context.currentTime)
    this.oscillator.connect(this.gainNode)
  }

  get detune() {
    return this.oscillator.detune
  }

  get frequency() {
    return this.oscillator.frequency
  }

  get gain() {
    return this.gainNode.gain
  }

  get type() {
    return this.oscillator.type
  }

  set type(value: OscillatorType) {
    this.oscillator.type = value
  }

  connect(destinationNode: AudioNode, output?: number, input?: number): AudioNode
  connect(destinationParam: AudioParam, output?: number): void
  connect(destination: AudioNode | AudioParam, output?: number, input?: number) {
    if (input === undefined) {
      const connectNodeOrParam = this.gainNode.connect as (
        destination: AudioNode | AudioParam,
        output?: number,
      ) => void | AudioNode
      return connectNodeOrParam.call(this.gainNode, destination, output)
    }
    return this.gainNode.connect(destination as AudioNode, output, input)
  }

  disconnect(output?: number): void
  disconnect(destinationNode?: AudioNode, output?: number, input?: number): void
  disconnect(destinationParam?: AudioParam, output?: number): void
  disconnect(
    destinationOrOutput?: AudioNode | AudioParam | number,
    output?: number,
    input?: number,
  ) {
    const disconnectNodeOrParam = this.gainNode.disconnect as (
      destination: AudioNode | AudioParam,
      output?: number,
    ) => void
    if (destinationOrOutput === undefined) {
      this.gainNode.disconnect()
    } else if (typeof destinationOrOutput === 'number') {
      this.gainNode.disconnect(destinationOrOutput)
    } else if (input === undefined) {
      disconnectNodeOrParam.call(this.gainNode, destinationOrOutput, output)
    } else {
      if (output === undefined) {
        this.gainNode.disconnect(destinationOrOutput as AudioNode)
      } else {
        this.gainNode.disconnect(destinationOrOutput as AudioNode, output, input)
      }
    }
  }

  start(when?: number) {
    this.oscillator.start(when)
  }

  stop(when?: number) {
    this.oscillator.stop(when)
  }

  setPeriodicWave(periodicWave: PeriodicWave) {
    this.oscillator.setPeriodicWave(periodicWave)
  }

  get numberOfInputs() {
    return this.gainNode.numberOfInputs
  }

  get numberOfOutputs() {
    return this.gainNode.numberOfOutputs
  }

  get channelCount() {
    return this.gainNode.channelCount
  }

  set channelCount(value: number) {
    this.gainNode.channelCount = value
  }

  get channelCountMode() {
    return this.gainNode.channelCountMode
  }

  set channelCountMode(value: ChannelCountMode) {
    this.gainNode.channelCountMode = value
  }

  get channelInterpretation() {
    return this.gainNode.channelInterpretation
  }

  set channelInterpretation(value: ChannelInterpretation) {
    this.gainNode.channelInterpretation = value
  }

  get context() {
    return this.gainNode.context
  }

  get onended() {
    return this.oscillator.onended
  }

  set onended(value: ((this: AudioScheduledSourceNode, ev: Event) => unknown) | null) {
    this.oscillator.onended = value
  }

  addEventListener<K extends keyof AudioScheduledSourceNodeEventMap>(
    type: K,
    listener: (this: AudioScheduledSourceNode, ev: AudioScheduledSourceNodeEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    this.oscillator.addEventListener(type, listener, options)
  }

  removeEventListener<K extends keyof AudioScheduledSourceNodeEventMap>(
    type: K,
    listener: (this: AudioScheduledSourceNode, ev: AudioScheduledSourceNodeEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) {
    this.oscillator.removeEventListener(type, listener, options)
  }

  dispatchEvent(event: Event): boolean {
    return this.oscillator.dispatchEvent(event)
  }
}

/**
 * UnisonOscillator in series with a GainNode.
 */
export class EnvelopedUnison implements OscillatorNode, GainNode {
  private oscillator: UnisonOscillator
  private gainNode: GainNode

  constructor(
    context: BaseAudioContext,
    opts?: UnisonOscillatorOptions,
    mode: 'frequency' | 'detune' = 'detune',
  ) {
    this.oscillator = new UnisonOscillator(context, opts, mode)
    this.gainNode = context.createGain()
    this.gainNode.gain.setValueAtTime(0, context.currentTime)
    this.oscillator.connect(this.gainNode)
  }

  get numberOfVoices() {
    return this.oscillator.numberOfVoices
  }

  set numberOfVoices(value: number) {
    this.oscillator.numberOfVoices = value
  }

  get spread() {
    return this.oscillator.spread
  }

  get voices() {
    return this.oscillator.voices
  }

  dispose() {
    this.oscillator.dispose()
  }

  get detune() {
    return this.oscillator.detune
  }

  get frequency() {
    return this.oscillator.frequency
  }

  get gain() {
    return this.gainNode.gain
  }

  get type() {
    return this.oscillator.type
  }

  set type(value: OscillatorType) {
    this.oscillator.type = value
  }

  connect(destinationNode: AudioNode, output?: number, input?: number): AudioNode
  connect(destinationParam: AudioParam, output?: number): void
  connect(destination: AudioNode | AudioParam, output?: number, input?: number) {
    if (input === undefined) {
      const connectNodeOrParam = this.gainNode.connect as (
        destination: AudioNode | AudioParam,
        output?: number,
      ) => void | AudioNode
      return connectNodeOrParam.call(this.gainNode, destination, output)
    }
    return this.gainNode.connect(destination as AudioNode, output, input)
  }

  disconnect(output?: number): void
  disconnect(destinationNode?: AudioNode, output?: number, input?: number): void
  disconnect(destinationParam?: AudioParam, output?: number): void
  disconnect(
    destinationOrOutput?: AudioNode | AudioParam | number,
    output?: number,
    input?: number,
  ) {
    const disconnectNodeOrParam = this.gainNode.disconnect as (
      destination: AudioNode | AudioParam,
      output?: number,
    ) => void
    if (destinationOrOutput === undefined) {
      this.gainNode.disconnect()
    } else if (typeof destinationOrOutput === 'number') {
      this.gainNode.disconnect(destinationOrOutput)
    } else if (input === undefined) {
      disconnectNodeOrParam.call(this.gainNode, destinationOrOutput, output)
    } else {
      if (output === undefined) {
        this.gainNode.disconnect(destinationOrOutput as AudioNode)
      } else {
        this.gainNode.disconnect(destinationOrOutput as AudioNode, output, input)
      }
    }
  }

  start(when?: number) {
    this.oscillator.start(when)
  }

  stop(when?: number) {
    this.oscillator.stop(when)
  }

  setPeriodicWave(periodicWave: PeriodicWave) {
    this.oscillator.setPeriodicWave(periodicWave)
  }

  get numberOfInputs() {
    return this.gainNode.numberOfInputs
  }

  get numberOfOutputs() {
    return this.gainNode.numberOfOutputs
  }

  get channelCount() {
    return this.gainNode.channelCount
  }

  set channelCount(value: number) {
    this.gainNode.channelCount = value
  }

  get channelCountMode() {
    return this.gainNode.channelCountMode
  }

  set channelCountMode(value: ChannelCountMode) {
    this.gainNode.channelCountMode = value
  }

  get channelInterpretation() {
    return this.gainNode.channelInterpretation
  }

  set channelInterpretation(value: ChannelInterpretation) {
    this.gainNode.channelInterpretation = value
  }

  get context() {
    return this.gainNode.context
  }

  get onended() {
    return this.oscillator.onended
  }

  set onended(value: ((this: AudioScheduledSourceNode, ev: Event) => unknown) | null) {
    this.oscillator.onended = value
  }

  addEventListener<K extends keyof AudioScheduledSourceNodeEventMap>(
    type: K,
    listener: (this: AudioScheduledSourceNode, ev: AudioScheduledSourceNodeEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    this.oscillator.addEventListener(type, listener, options)
  }

  removeEventListener<K extends keyof AudioScheduledSourceNodeEventMap>(
    type: K,
    listener: (this: AudioScheduledSourceNode, ev: AudioScheduledSourceNodeEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) {
    this.oscillator.removeEventListener(type, listener, options)
  }

  dispatchEvent(event: Event): boolean {
    return this.oscillator.dispatchEvent(event)
  }
}
