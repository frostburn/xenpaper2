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
    if (destination instanceof AudioParam) {
      this.gainNode.connect(destination, output ?? 0)
      return
    }
    return this.gainNode.connect(destination, output, input)
  }

  disconnect(output?: number): void
  disconnect(destinationNode?: AudioNode, output?: number, input?: number): void
  disconnect(destinationParam?: AudioParam, output?: number): void
  disconnect(
    destinationOrOutput?: AudioNode | AudioParam | number,
    output?: number,
    input?: number,
  ) {
    if (
      destinationOrOutput === undefined ||
      typeof destinationOrOutput === 'number' ||
      destinationOrOutput instanceof AudioNode ||
      destinationOrOutput instanceof AudioParam
    ) {
      ;(this.gainNode.disconnect as any)(destinationOrOutput, output, input)
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

  set onended(value: ((this: AudioScheduledSourceNode, ev: Event) => any) | null) {
    this.oscillator.onended = value
  }

  addEventListener<K extends keyof AudioScheduledSourceNodeEventMap>(
    type: K,
    listener: (this: AudioScheduledSourceNode, ev: AudioScheduledSourceNodeEventMap[K]) => any,
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
    listener: (this: AudioScheduledSourceNode, ev: AudioScheduledSourceNodeEventMap[K]) => any,
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
