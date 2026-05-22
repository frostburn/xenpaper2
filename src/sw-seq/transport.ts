type ParametricEvent = {callback: (time: number, transport: Transport) => void, when: number};
type TransportEvent = {callback: (transport: Transport) => void, when: number};


/**
 * Transport using look-ahead scheduling.
 */
export class Transport {
  private context: BaseAudioContext;
  private interval: number;
  private lookAhead: number;
  private active: boolean;
  private startTime: number;
  private lastTick: number;
  private parametricEvents: ParametricEvent[];
  private parametricQueue: ParametricEvent[];
  private events: TransportEvent[];
  private eventQueue: TransportEvent[];

  constructor(context: BaseAudioContext, interval = 0.1, lookAhead = 0.2) {
    this.context = context;
    this.ticker = null;
    this.interval = interval;
    this.lookAhead = lookAhead;

    this.startTime = NaN;
    this.lastTick = NaN;
    this.parametricEvents = [];
    this.parametricQueue = [];
    this.events = [];
    this.eventQueue = [];
    this.active = false;
  }

  start() {
    this.startTime = this.context.currentTime;
    this.parametricQueue = this.parametricEvents.map((e) => ({callback: e.callback, when: e.when + this.startTime}));
    this.eventQueue = this.events.map((e) => ({callback: e.callback, when: e.when + this.startTime}));
    this.active = true;
    this.lastTick = this.startTime;
    this.onInterval();
  }

  private onInterval() {
    if (!this.active) {
      // this.onEnded();
      return;
    }
    const ticker = this.context.createConstantSource();
    ticker.onended = this.onInterval.bind(this);
    ticker.start(this.context.currentTime);
    ticker.stop(this.lastTick + this.interval);
    this.lastTick += this.interval;
    while (this.parametricQueue.length && this.parametricQueue[0].when < this.lastTick) {
      const event = this.parametricQueue.shift();
      event.callback(event.when + this.lookAhead, this);
    }
    while (this.eventQueue.length && this.eventQueue[0].when < this.lastTick) {
      const event = this.eventQueue.shift();
      const timer = this.context.createConstantSource();
      timer.onended = () => event.callback(this);
      timer.start(this.context.currentTime);
      timer.stop(event.when + this.lookAhead);
    }
  }

  stop() {
    // Schedule cleanup for the next tick.
    this.active = false;
  }

  /**
   * Schedule an event that can synchronize with AudioContext time.
   * @param callback Event to be scheduled.
   * @param when Time in seconds since transport start.
   */
  scheduleParametric(callback: (time: number) => void, when: number) {
    this.parametricEvents.push({callback, when});
    this.parametricEvents.sort((a, b) => a.when - b.when);
  }

  /**
   * Schedule an event that has no inherent support for AudioContext time.
   * Synchronized using "best effort".
   * @param callback Event to be scheduled.
   * @param when Time in seconds since transport start.
   */
  scheduleEvent(callback: () => void, when: number) {
    this.events.push({callback, when});
    this.events.sort((a, b) => a.when - b.when);
  }
}
