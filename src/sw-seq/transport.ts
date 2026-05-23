type ParametricEvent = { id: number; callback: (time: number, transport: Transport) => void; when: number }
type TransportEvent = { id: number; callback: (transport: Transport) => void; when: number }

/**
 * Transport using look-ahead scheduling.
 */
export class Transport {
  private context: BaseAudioContext
  private interval: number
  private lookAhead: number
  private active: boolean
  private startTime: number
  private lastTick: number
  private parametricEvents: ParametricEvent[]
  private parametricQueue: ParametricEvent[]
  private events: TransportEvent[]
  private eventQueue: TransportEvent[]
  private nextEventId: number

  constructor(context: BaseAudioContext, interval = 0.1, lookAhead = 0.2) {
    this.context = context
    this.interval = interval
    this.lookAhead = lookAhead

    this.startTime = NaN
    this.lastTick = NaN
    this.parametricEvents = []
    this.parametricQueue = []
    this.events = []
    this.eventQueue = []
    this.active = false
    this.nextEventId = 1
  }

  start() {
    this.startTime = this.context.currentTime
    this.parametricQueue = this.parametricEvents.map((e) => ({ ...e, when: e.when + this.startTime }))
    this.eventQueue = this.events.map((e) => ({ ...e, when: e.when + this.startTime }))
    this.active = true
    this.lastTick = this.startTime
    this.onInterval()
  }

  private onInterval() {
    if (!this.active) {
      return
    }
    const ticker = this.context.createConstantSource()
    ticker.onended = this.onInterval.bind(this)
    ticker.start(this.context.currentTime)
    ticker.stop(this.lastTick + this.interval)
    this.lastTick += this.interval
    while (this.parametricQueue.length && this.parametricQueue[0]!.when < this.lastTick) {
      const event = this.parametricQueue.shift()!
      event.callback(event.when + this.lookAhead, this)
    }
    while (this.eventQueue.length && this.eventQueue[0]!.when < this.lastTick) {
      const event = this.eventQueue.shift()!
      const timer = this.context.createConstantSource()
      timer.onended = () => event.callback(this)
      timer.start(this.context.currentTime)
      timer.stop(event.when + this.lookAhead)
    }
  }

  stop() {
    this.active = false
  }

  clear(id: number) {
    this.parametricEvents = this.parametricEvents.filter((event) => event.id !== id)
    this.parametricQueue = this.parametricQueue.filter((event) => event.id !== id)
    this.events = this.events.filter((event) => event.id !== id)
    this.eventQueue = this.eventQueue.filter((event) => event.id !== id)
  }

  clearAll() {
    this.parametricEvents = []
    this.parametricQueue = []
    this.events = []
    this.eventQueue = []
  }

  scheduleParametric(callback: (time: number) => void, when: number) {
    const id = this.nextEventId++
    this.parametricEvents.push({ id, callback, when })
    this.parametricEvents.sort((a, b) => a.when - b.when)
    return id
  }

  scheduleEvent(callback: () => void, when: number) {
    const id = this.nextEventId++
    this.events.push({ id, callback, when })
    this.events.sort((a, b) => a.when - b.when)
    return id
  }
}
