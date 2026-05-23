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
  readonly context: BaseAudioContext
  seconds = 0
  loop = false
  loopStart = 0
  loopEnd = 0
  state: 'started' | 'stopped' = 'stopped'

  private interval: number
  private lookAhead: number
  private active: boolean
  private startTime: number
  private lastTick: number
  private eventsById: Map<number, ParametricEvent | TransportEvent>
  private parametricQueue: ParametricEvent[]
  private eventQueue: TransportEvent[]
  private nextEventId: number

  constructor(context: BaseAudioContext, interval = 0.1, lookAhead = 0.2) {
    this.context = context
    this.interval = interval
    this.lookAhead = lookAhead
    this.active = false
    this.startTime = NaN
    this.lastTick = NaN
    this.eventsById = new Map()
    this.parametricQueue = []
    this.eventQueue = []
    this.nextEventId = 1
  }

  start() {
    this.startTime = this.context.currentTime - this.seconds
    this.parametricQueue = []
    this.eventQueue = []
    this.eventsById.forEach((event) => {
      if ('callback' in event && event.callback.length >= 2) {
        this.parametricQueue.push({ ...(event as ParametricEvent), when: event.when + this.startTime })
      } else {
        this.eventQueue.push({ ...(event as TransportEvent), when: event.when + this.startTime })
      }
    })
    this.parametricQueue.sort((a, b) => a.when - b.when)
    this.eventQueue.sort((a, b) => a.when - b.when)
    this.active = true
    this.state = 'started'
    this.lastTick = this.context.currentTime
    this.onInterval()
  }

  private onInterval() {
    if (!this.active) return

    const ticker = this.context.createConstantSource()
    ticker.onended = this.onInterval.bind(this)
    ticker.start(this.context.currentTime)
    ticker.stop(this.lastTick + this.interval)
    this.lastTick += this.interval
    this.seconds = this.lastTick - this.startTime

    while (this.parametricQueue.length && this.parametricQueue[0]!.when < this.lastTick) {
      const event = this.parametricQueue.shift()!
      if (!this.eventsById.has(event.id)) continue
      event.callback(event.when + this.lookAhead)
      this.eventsById.delete(event.id)
    }

    while (this.eventQueue.length && this.eventQueue[0]!.when < this.lastTick) {
      const event = this.eventQueue.shift()!
      if (!this.eventsById.has(event.id)) continue
      const timer = this.context.createConstantSource()
      timer.onended = () => {
        if (!this.eventsById.has(event.id)) return
        event.callback()
        this.eventsById.delete(event.id)
      }
      timer.start(this.context.currentTime)
      timer.stop(event.when + this.lookAhead)
    }
  }

  stop() {
    this.active = false
    this.state = 'stopped'
  }

  clear(id: number) {
    this.eventsById.delete(id)
    this.parametricQueue = this.parametricQueue.filter((event) => event.id !== id)
    this.eventQueue = this.eventQueue.filter((event) => event.id !== id)
  }

  clearAll() {
    this.eventsById.clear()
    this.parametricQueue = []
    this.eventQueue = []
  }

  scheduleParametric(callback: (time: number) => void, when: number) {
    const id = this.nextEventId++
    this.eventsById.set(id, { id, callback, when })
    return id
  }

  scheduleEvent(callback: () => void, when: number) {
    const id = this.nextEventId++
    this.eventsById.set(id, { id, callback, when })
    return id
  }
}
