const round = Math.round

type ParametricEvent = {
  id: number
  callback: (time: number) => void
  when: number
}
type TransportEvent = {
  id: number
  callback: () => void
  when: number
}

/**
 * Transport using look-ahead scheduling.
 */
export class Transport {
  readonly context: AudioContext
  active: boolean
  loop = false
  loopStart = 0
  loopEnd = 0
  onended = () => {/* empty */}

  private interval: number
  private _lookAhead: number
  private startTime: number
  private lastTick: number
  private _endTime: number
  private parametricEventsById: Map<number, ParametricEvent>
  private eventsById: Map<number, TransportEvent>
  private nextEventId: number

  constructor(context: AudioContext, interval = 0.1, lookAhead = 0.2) {
    this.context = context
    this.interval = round(interval * context.sampleRate)
    this._lookAhead = round(lookAhead * context.sampleRate)
    this.active = false
    this.startTime = NaN
    this.lastTick = NaN
    this._endTime = Infinity
    this.parametricEventsById = new Map()
    this.eventsById = new Map()
    this.nextEventId = 1
  }

  get lookAhead() {
    return this._lookAhead / this.context.sampleRate
  }

  get position() {
    return (this.lastTick - this.startTime) / this.context.sampleRate
  }

  get endTime() {
    return this._endTime / this.context.sampleRate
  }

  set endTime(value: number) {
    this._endTime = round(value * this.context.sampleRate)
  }

  start(offset = 0) {
    this.startTime = round((this.context.currentTime - offset) * this.context.sampleRate)
    this.active = true
    this.lastTick = round(this.context.currentTime * this.context.sampleRate)
    this.onInterval()
  }

  // TODO: Loop
  private shouldFire(event: ParametricEvent | TransportEvent) {
    const pos = this.lastTick - this.startTime
    return (event.when >= pos - this.interval) && (event.when < pos)
  }

  private onInterval() {
    if (!this.active) {
      this.onended()
      return
    }

    const ticker = this.context.createConstantSource()
    ticker.onended = this.onInterval.bind(this)
    ticker.start(this.context.currentTime)
    this.lastTick += this.interval
    ticker.stop(this.lastTick / this.context.sampleRate)

    const offset = this.startTime + this._lookAhead

    for (const event of this.parametricEventsById.values()) {
      if (this.shouldFire(event)) {
        event.callback((event.when + offset) / this.context.sampleRate)
      }
    }

    for (const event of this.eventsById.values()) {
      if (!this.shouldFire(event)) {
        continue
      }
      const timer = this.context.createConstantSource()
      timer.onended = () => {
        if (!this.eventsById.has(event.id)) return
        event.callback()
      }
      timer.start(this.context.currentTime)
      timer.stop((event.when + offset) / this.context.sampleRate)
    }

    // Convert from context samples to scheduling samples
    if (this.lastTick - this.startTime > this._endTime) {
      this.active = false
    }
  }

  stop() {
    this.active = false
  }

  clear(id: number) {
    this.parametricEventsById.delete(id)
    this.eventsById.delete(id)
  }

  clearAll() {
    this.parametricEventsById.clear()
    this.eventsById.clear()
  }

  scheduleParametric(callback: (time: number) => void, when: number) {
    const id = this.nextEventId++
    this.parametricEventsById.set(id, { id, callback, when: round(when * this.context.sampleRate)})

    return id
  }

  scheduleEvent(callback: () => void, when: number) {
    const id = this.nextEventId++
    this.eventsById.set(id, { id, callback, when: round(when * this.context.sampleRate) })

    return id
  }
}
