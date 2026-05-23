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
  seconds = 0
  loop = false
  loopStart = 0
  loopEnd = 0

  private interval: number
  private lookAhead: number
  private startTime: number
  private lastTick: number
  private parametricEventsById: Map<number, ParametricEvent>
  private eventsById: Map<number, TransportEvent>
  private parametricQueue: ParametricEvent[]
  private eventQueue: TransportEvent[]
  private nextEventId: number

  constructor(context: AudioContext, interval = 0.1, lookAhead = 0.2) {
    this.context = context
    this.interval = interval
    this.lookAhead = lookAhead
    this.active = false
    this.startTime = NaN
    this.lastTick = NaN
    this.parametricEventsById = new Map()
    this.eventsById = new Map()
    this.parametricQueue = []
    this.eventQueue = []
    this.nextEventId = 1
  }

  start() {
    this.startTime = this.context.currentTime - this.seconds
    this.parametricQueue = []
    this.eventQueue = []
    this.parametricEventsById.forEach((event) => {
      this.parametricQueue.push({ ...event, when: event.when + this.startTime })
    })
    this.eventsById.forEach((event) => {
      this.eventQueue.push({ ...event, when: event.when + this.startTime })
    })
    this.parametricQueue.sort((a, b) => a.when - b.when)
    this.eventQueue.sort((a, b) => a.when - b.when)
    this.active = true
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
      if (!this.parametricEventsById.has(event.id)) continue
      event.callback(event.when + this.lookAhead)
    }

    while (this.eventQueue.length && this.eventQueue[0]!.when < this.lastTick) {
      const event = this.eventQueue.shift()!
      if (!this.eventsById.has(event.id)) continue
      const timer = this.context.createConstantSource()
      timer.onended = () => {
        if (!this.eventsById.has(event.id)) return
        event.callback()
      }
      timer.start(this.context.currentTime)
      timer.stop(event.when + this.lookAhead)
    }
  }

  stop() {
    this.active = false
  }

  clear(id: number) {
    this.parametricEventsById.delete(id)
    this.eventsById.delete(id)
    this.parametricQueue = this.parametricQueue.filter((event) => event.id !== id)
    this.eventQueue = this.eventQueue.filter((event) => event.id !== id)
  }

  clearAll() {
    this.parametricEventsById.clear()
    this.eventsById.clear()
    this.parametricQueue = []
    this.eventQueue = []
  }

  scheduleParametric(callback: (time: number) => void, when: number) {
    const id = this.nextEventId++
    this.parametricEventsById.set(id, { id, callback, when })

    if (this.active) {
      this.parametricQueue.push({id, callback, when: when + this.startTime })
      this.parametricQueue.sort((a, b) => a.when - b.when)
    }

    return id
  }

  scheduleEvent(callback: () => void, when: number) {
    const id = this.nextEventId++
    this.eventsById.set(id, { id, callback, when })

    if (this.active) {
      this.eventQueue.push({id, callback, when: when + this.startTime})
      this.eventQueue.sort((a, b) => a.when - b.when)
    }

    return id
  }
}
