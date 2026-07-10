import { EnvelopedAperiodicOscillator, EnvelopedOscillator, EnvelopedUnison } from './nodes'
import { createNoiseGeneratorNode, type NoiseGeneratorNode } from './noise-worklet'
import type { SynthType } from './polysynth'

type BankedNode<T> = { node: T; age: number; freeAt: number }
type ReusableNode =
  | EnvelopedOscillator
  | EnvelopedUnison
  | EnvelopedAperiodicOscillator
  | NoiseGeneratorNode

/**
 * Bank of re-usable enveloped oscillator nodes.
 *
 * Web Audio API gives the impression that disconnected and stopped audio nodes are garbage collected,
 * but that's not always true unfortunately.
 */
export class Bank {
  readonly context: BaseAudioContext
  private maxPolyphony: number
  // Negative age indicates that the node is reserved
  private oscillators: BankedNode<EnvelopedOscillator>[]
  private unisons: BankedNode<EnvelopedUnison>[]
  private aperiodics: BankedNode<EnvelopedAperiodicOscillator>[]
  private noiseGenerators: BankedNode<NoiseGeneratorNode>[]

  constructor(context: BaseAudioContext, maxPolyphony = 32) {
    this.context = context
    this.maxPolyphony = maxPolyphony
    this.oscillators = []
    this.unisons = []
    this.aperiodics = []
    this.noiseGenerators = []
  }

  private activateDueNodes<T>(nodes: BankedNode<T>[], time: number) {
    for (const node of nodes) {
      if (node.age < 0 && node.freeAt <= time) {
        node.age = 0
        node.freeAt = -Infinity
      }
    }
  }

  private resetNode(node: ReusableNode, time: number) {
    if ('spread' in node) node.spread.cancelScheduledValues(time)
    node.detune.cancelScheduledValues(time)
    node.frequency.cancelScheduledValues(time)
    node.gain.cancelScheduledValues(time)
    node.gain.setValueAtTime(0, time)
    node.disconnect()
  }

  private allocateExistingNode<T extends ReusableNode>(nodes: BankedNode<T>[], time: number) {
    this.activateDueNodes(nodes, time)
    const maxAge = nodes.reduce((a, b) => Math.max(a, b.age), -1)
    if (maxAge < 0) {
      console.warn('Maximum polyphony reached.')
      return null
    }
    const osc = nodes.find((o) => o.age === maxAge)
    if (!osc) {
      return null
    }
    osc.age = -1
    osc.freeAt = Infinity
    this.resetNode(osc.node, time)
    return osc.node
  }

  private freeNode<T>(nodes: BankedNode<T>[], node: T, freeAt: number, error: string) {
    const osc = nodes.find((o) => o.node === node)
    if (osc === undefined) {
      throw new Error(error)
    }
    osc.freeAt = freeAt
    osc.age = -1
    nodes.forEach((o) => {
      if (o.age >= 0) {
        o.age++
      }
    })
  }

  allocateOscillator(time = this.context.currentTime, _synth?: SynthType) {
    if (this.oscillators.length < this.maxPolyphony) {
      const osc = { node: new EnvelopedOscillator(this.context), age: -1, freeAt: Infinity }
      osc.node.start(this.context.currentTime)
      this.oscillators.push(osc)
      return osc.node
    }
    return this.allocateExistingNode(this.oscillators, time)
  }

  freeOscillator(node: EnvelopedOscillator, freeAt = this.context.currentTime) {
    this.freeNode(this.oscillators, node, freeAt, 'Attempting to free unallocated oscillator.')
  }

  allocateUnison(time = this.context.currentTime, _synth?: SynthType) {
    if (this.unisons.length < this.maxPolyphony) {
      const osc = {
        node: new EnvelopedUnison(this.context, { spread: 5, numberOfVoices: 3 }, 'detune'),
        age: -1,
        freeAt: Infinity,
      }
      osc.node.start(this.context.currentTime)
      this.unisons.push(osc)
      return osc.node
    }
    return this.allocateExistingNode(this.unisons, time)
  }

  freeUnison(node: EnvelopedUnison, freeAt = this.context.currentTime) {
    this.freeNode(this.unisons, node, freeAt, 'Attempting to free unallocated unison oscillator.')
  }

  allocateAperiodicOscillator(time = this.context.currentTime, _synth?: SynthType) {
    if (this.aperiodics.length < this.maxPolyphony) {
      const osc = {
        node: new EnvelopedAperiodicOscillator(this.context),
        age: -1,
        freeAt: Infinity,
      }
      osc.node.start(this.context.currentTime)
      this.aperiodics.push(osc)
      return osc.node
    }
    return this.allocateExistingNode(this.aperiodics, time)
  }

  freeAperiodicOscillator(node: EnvelopedAperiodicOscillator, freeAt = this.context.currentTime) {
    this.freeNode(
      this.aperiodics,
      node,
      freeAt,
      'Attempting to free unallocated aperiodic oscillator.',
    )
  }

  allocateNoiseGenerator(time = this.context.currentTime, _synth?: SynthType) {
    const audioWorklet = this.context.audioWorklet
    if (audioWorklet === undefined) {
      return null
    }
    if (this.noiseGenerators.length < this.maxPolyphony) {
      const osc = { node: createNoiseGeneratorNode(this.context), age: -1, freeAt: Infinity }
      this.noiseGenerators.push(osc)
      return osc.node
    }
    return this.allocateExistingNode(this.noiseGenerators, time)
  }

  freeNoiseGenerator(node: NoiseGeneratorNode, freeAt = this.context.currentTime) {
    this.freeNode(
      this.noiseGenerators,
      node,
      freeAt,
      'Attempting to free unallocated noise generator.',
    )
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

const objectKeyIds = new WeakMap<object, number>()
let nextObjectKeyId = 1

function objectKey(value: object | null) {
  if (value === null) return 'none'

  const existing = objectKeyIds.get(value)
  if (existing !== undefined) return existing

  const id = nextObjectKeyId++
  objectKeyIds.set(value, id)
  return id
}

function synthQuotaKey(synth: SynthType | undefined, family: string) {
  if (synth === undefined) return family

  if (synth.type === 'noise') return `${family}:${synth.noise}:${synth.interpolation}`
  if (synth.periodicity === 'aperiodic') {
    return `${family}:aperiodic:${objectKey(synth.aperiodicWave)}`
  }
  if (synth.type === 'custom') return `${family}:custom:${objectKey(synth.periodicWave)}`

  return `${family}:${synth.type}`
}

/**
 * Offline bank that keeps a separate reusable-node quota for each synth type.
 *
 * OscillatorNode.type and custom/aperiodic wave assignments are immediate Web Audio properties rather
 * than schedulable AudioParams. During OfflineAudioContext rendering, reusing one node for notes with
 * different timbres can therefore overwrite the timbre of notes that were scheduled earlier. Keeping a
 * per-timbre sub-bank preserves reuse within the same timbre while preventing cross-timbre overwrites.
 */
export class OfflineBank extends Bank {
  private readonly maxPolyphonyPerSynth: number
  private readonly banks = new Map<string, Bank>()
  private readonly owners = new WeakMap<ReusableNode, Bank>()

  constructor(context: BaseAudioContext, maxPolyphonyPerSynth = 32) {
    super(context, 0)
    this.maxPolyphonyPerSynth = maxPolyphonyPerSynth
  }

  private bankFor(synth: SynthType | undefined, family: string) {
    const key = synthQuotaKey(synth, family)
    let bank = this.banks.get(key)
    if (bank === undefined) {
      bank = new Bank(this.context, this.maxPolyphonyPerSynth)
      this.banks.set(key, bank)
    }
    return bank
  }

  private remember<T extends ReusableNode>(node: T | null, bank: Bank) {
    if (node !== null) this.owners.set(node, bank)
    return node
  }

  private ownerFor<T extends ReusableNode>(node: T, error: string) {
    const bank = this.owners.get(node)
    if (bank === undefined) throw new Error(error)
    return bank
  }

  override allocateOscillator(time = this.context.currentTime, synth?: SynthType) {
    const bank = this.bankFor(synth, 'oscillator')
    return this.remember(bank.allocateOscillator(time, synth), bank)
  }

  override freeOscillator(node: EnvelopedOscillator, freeAt = this.context.currentTime) {
    this.ownerFor(node, 'Attempting to free unallocated offline oscillator.').freeOscillator(
      node,
      freeAt,
    )
  }

  override allocateUnison(time = this.context.currentTime, synth?: SynthType) {
    const bank = this.bankFor(synth, 'unison')
    return this.remember(bank.allocateUnison(time, synth), bank)
  }

  override freeUnison(node: EnvelopedUnison, freeAt = this.context.currentTime) {
    this.ownerFor(node, 'Attempting to free unallocated offline unison oscillator.').freeUnison(
      node,
      freeAt,
    )
  }

  override allocateAperiodicOscillator(time = this.context.currentTime, synth?: SynthType) {
    const bank = this.bankFor(synth, 'aperiodic')
    return this.remember(bank.allocateAperiodicOscillator(time, synth), bank)
  }

  override freeAperiodicOscillator(
    node: EnvelopedAperiodicOscillator,
    freeAt = this.context.currentTime,
  ) {
    this.ownerFor(
      node,
      'Attempting to free unallocated offline aperiodic oscillator.',
    ).freeAperiodicOscillator(node, freeAt)
  }

  override allocateNoiseGenerator(time = this.context.currentTime, synth?: SynthType) {
    const bank = this.bankFor(synth, 'noise')
    return this.remember(bank.allocateNoiseGenerator(time, synth), bank)
  }

  override freeNoiseGenerator(node: NoiseGeneratorNode, freeAt = this.context.currentTime) {
    this.ownerFor(
      node,
      'Attempting to free unallocated offline noise generator.',
    ).freeNoiseGenerator(node, freeAt)
  }

  override stop() {
    for (const bank of this.banks.values()) bank.stop()
  }
}
