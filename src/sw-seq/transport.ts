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
  loop: boolean
  onended = () => {
    /* empty */
  }

  private interval: number
  private _lookAhead: number
  private startTime: number
  private lastTick: number
  private _endTime: number
  private _loopStart: number
  private _loopEnd: number
  private parametricEventsById: Map<number, ParametricEvent>
  private eventsById: Map<number, TransportEvent>
  private nextEventId: number

  constructor(context: AudioContext, interval = 0.1, lookAhead = 0.2) {
    this.context = context
    this.interval = round(interval * context.sampleRate)
    this._lookAhead = round(lookAhead * context.sampleRate)
    this.active = false
    this.loop = false
    this.startTime = NaN
    this.lastTick = NaN
    this._endTime = Infinity
    this._loopStart = 0
    this._loopEnd = 0
    this.parametricEventsById = new Map()
    this.eventsById = new Map()
    this.nextEventId = 1
  }

  get lookAhead() {
    return this._lookAhead / this.context.sampleRate
  }

  get position() {
    let pos = this.lastTick - this.startTime
    const loopLength = this._loopEnd - this._loopStart
    if (this.loop && loopLength > 0) {
      while (pos >= this._loopEnd) {
        pos -= loopLength
      }
    }

    return pos / this.context.sampleRate
  }

  get endTime() {
    return this._endTime / this.context.sampleRate
  }

  set endTime(value: number) {
    this._endTime = round(value * this.context.sampleRate)
  }

  get loopStart() {
    return this._loopStart / this.context.sampleRate
  }

  set loopStart(value: number) {
    this._loopStart = round(value * this.context.sampleRate)
  }

  get loopEnd() {
    return this._loopEnd / this.context.sampleRate
  }

  set loopEnd(value: number) {
    this._loopEnd = round(value * this.context.sampleRate)
  }

  start(offset = 0) {
    this.startTime = round((this.context.currentTime - offset) * this.context.sampleRate)
    this.active = true
    this.lastTick = round(this.context.currentTime * this.context.sampleRate)
    this.onInterval()
  }

  /**
   * Compute the audio context time for an event that should fire.
   */
  private contextTime(event: ParametricEvent | TransportEvent) {
    let end = this.lastTick - this.startTime
    let start = end - this.interval

    const loopLength = this._loopEnd - this._loopStart
    let loopCount = 0
    if (this.loop && loopLength > 0) {
      // XXX: Currently it's not possible to wrap e.g. note-off events across the loop boundary
      while (start >= this._loopEnd) {
        start -= loopLength
        loopCount++
      }
      while (end >= this._loopEnd) {
        end -= loopLength
      }
      if (start > end) {
        // Check from start to boundary if needed (intentionally include boundary)
        if (event.when >= start && event.when <= this._loopEnd) {
          return (
            (this.startTime + this._lookAhead + event.when + loopCount * loopLength) /
            this.context.sampleRate
          )
        }
        start = this._loopStart
      }
    }
    if (event.when < start) return NaN
    if (event.when >= end) return NaN
    return (
      (this.startTime + this._lookAhead + event.when + loopCount * loopLength) /
      this.context.sampleRate
    )
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

    for (const event of this.parametricEventsById.values()) {
      const time = this.contextTime(event)
      if (!isNaN(time)) {
        event.callback(time)
      }
    }

    for (const event of this.eventsById.values()) {
      const time = this.contextTime(event)
      if (isNaN(time)) {
        continue
      }
      const timer = this.context.createConstantSource()
      timer.onended = () => {
        if (!this.eventsById.has(event.id)) return
        event.callback()
      }
      timer.start(this.context.currentTime)
      timer.stop(time)
    }

    if (this.loop && this._loopStart < this._loopEnd) {
      return
    }
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
    this.parametricEventsById.set(id, { id, callback, when: round(when * this.context.sampleRate) })

    return id
  }

  scheduleEvent(callback: () => void, when: number) {
    const id = this.nextEventId++
    this.eventsById.set(id, { id, callback, when: round(when * this.context.sampleRate) })

    return id
  }
}
