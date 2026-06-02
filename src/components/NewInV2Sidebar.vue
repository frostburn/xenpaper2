<script setup lang="ts">
type DemoTune = string | string[]

type SidebarDemo = {
  description: string
  tune?: DemoTune
}

type SidebarSection = {
  title: string
  demos: SidebarDemo[]
}

const emit = defineEmits<{
  setTune: [tune: DemoTune]
}>()

const isApplePlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false

  const platform = navigator.platform.toLowerCase()
  return (
    platform.includes('mac') ||
    platform.includes('iphone') ||
    platform.includes('ipad') ||
    platform.includes('ipod')
  )
}

const modifierKey = isApplePlatform() ? 'Command' : 'Ctrl'

const formatDemoTune = (tune: DemoTune): string =>
  Array.isArray(tune)
    ? tune
        .map(
          (source, index) => `# Tab ${index + 1}
${source}`,
        )
        .join('\n\n')
    : tune

const newInV2Sections: SidebarSection[] = [
  {
    title: 'Source tabs',
    demos: [
      {
        description:
          'Use the + tab button to add another source. Every live tab plays together, so tabs are useful for layering bass lines, chords, percussion-like pulses, or alternate scales.',
        tune: [
          `(osc:fatwarm2)(env:0754)(bpm:96)0--- 0--- 5--- 7---`,
          `(osc:semisine)(env:0245)(bpm:96)(2)[0,4,7]-- [5,9,12]-- [3,7,10]-- [4,7,11]--`,
          `(osc:tin)(env:1112)(bpm:96)(4)0 . 7 . 10 7 5 . 7 . 12 . 10 7 5 .`,
        ],
      },
      {
        description:
          'Tab names come from the first line. Close tabs with ×, then restore them from Recently closed while you keep sketching.',
      },
      {
        description: `Shift-click a tab to mute it. ${modifierKey}-click a tab to solo it; Alt+${modifierKey}-click adds or removes it from the current solo set.`,
      },
      {
        description:
          'Use Share to export or import all open tabs as one .xenpaper file, or to create a share link / embed that preserves the whole multi-tab project.',
      },
    ],
  },
  {
    title: 'Keyboard shortcuts',
    demos: [
      {
        description: `${modifierKey}+Enter restarts playback from the beginning of the active tab.`,
      },
      {
        description: `${modifierKey}+Space restarts playback from the line containing the text cursor. The > markers beside the editor also choose the restart line.`,
      },
      {
        description: `${modifierKey}+Z undoes edits in the active tab. ${modifierKey}+Shift+Z or ${modifierKey}+Y redoes them.`,
      },
    ],
  },
  {
    title: 'New harmonic oscillators',
    demos: [
      {
        description:
          'Named harmonic oscillator colors add ready-made periodic spectra beyond the old sine, triangle, square, sawtooth, AM, and FM sounds.',
        tune: `(osc:warm1)0 4 7.
(osc:warm4)0 4 7.
(osc:harmonicbell)0 4 7.`,
      },
      {
        description:
          'Generated harmonic oscillators include semisine, rich, slender, didacus, bohlen, glass, boethius, gold, parabolic, and -classic variants.',
        tune: `(osc:semisine)0 4 7.
(osc:bohlen)0 4 7.
(osc:parabolic)0 4 7.`,
      },
      {
        description: 'Most harmonic colors can also be made fat for a detuned unison effect.',
        tune: `(osc:fatwarm2)0 4 7.
(osc:fatgold)0 4 7.
(osc:fatglass-classic)0 4 7.`,
      },
    ],
  },
  {
    title: 'Aperiodic oscillators',
    demos: [
      {
        description:
          'Aperiodic oscillator names create inharmonic spectra that can make the same pitches feel metallic, bell-like, or gamelan-like.',
        tune: `(osc:tin)0 4 7.
(osc:bronze)0 4 7.
(osc:steel)0 4 7.`,
      },
      {
        description:
          'Try the generated metal and temperament colors for bright non-harmonic arpeggios.',
        tune: `(osc:silver)0 3 7 10.
(osc:platinum)0 3 7 10.
(osc:12-tet)0 3 7 10.`,
      },
      {
        description:
          'Harmonium and the gamelan timbres jegogan, jublag, and ugal pair well with scales from their respective regions.',
        tune: `(osc:ugal) (env:1716) (4)
# Average of 30 measured slendro gamelans
{0c 231c 474c 717c 955c 1208c'}
[0 3]---      [1 4]---   |
[0 3]---      [1 4]---   |
[2 5]- [3 6]- [4 7]- 8 9 |
[3 6]- 7 6    [0 5 10]-----. ||`,
      },
      {
        description:
          'L-system spectra are also available as long oscillator names for denser inharmonic clouds: L-system-golden-dense-A, L-system-golden-dense-B, L-system-golden-sparse-A, L-system-golden-sparse-B, L-system-plastic, L-system-silver, and L-system-supergolden.',
        tune: `(osc:L-system-golden-sparse-B)0 2 4 7.
(osc:L-system-silver)0 2 4 7.
(osc:L-system-plastic)0 2 4 7.`,
      },
    ],
  },
]
</script>

<template>
  <aside class="new-v2-sidebar" aria-labelledby="new-v2-title">
    <header class="sidebar-header">
      <h1 id="new-v2-title">New in v2</h1>
      <p>Tabs, shortcuts, and expanded oscillator colors.</p>
    </header>

    <div class="sidebar-content">
      <section v-for="section in newInV2Sections" :key="section.title" class="new-v2-section">
        <h2>{{ section.title }}</h2>

        <article
          v-for="demo in section.demos"
          :key="`${section.title}-${demo.description}`"
          class="new-v2-demo"
        >
          <p>{{ demo.description }}</p>

          <div v-if="demo.tune" class="example">
            <span class="example-label">e.g.</span>
            <pre>{{ formatDemoTune(demo.tune) }}</pre>
            <button type="button" @click="emit('setTune', demo.tune)">Demo</button>
          </div>
        </article>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.new-v2-sidebar {
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: var(--xenpaper-bg-light);
  color: var(--xenpaper-text);
  font-family: var(--xenpaper-font-copy);
  animation: 0.3s ease-out on-show;
}

@keyframes on-show {
  from {
    opacity: 0;
    transform: translateY(0.25rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sidebar-header {
  padding: 2rem 2rem 1.5rem;
  background: var(--xenpaper-bg);
}

.sidebar-header h1 {
  margin: 0 0 0.5rem;
  font-size: 2.5rem;
  line-height: 2rem;
  font-weight: 400;
  text-transform: lowercase;
}

.sidebar-header p {
  margin: 0;
  color: var(--xenpaper-placeholder);
  font-style: italic;
  line-height: 1.3rem;
}

.sidebar-content {
  padding: 2rem;
}

.new-v2-section + .new-v2-section {
  margin-top: 2.5rem;
}

.new-v2-section h2 {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  line-height: 1.2;
  font-weight: 400;
}

.new-v2-demo {
  margin-bottom: 2rem;
}

.new-v2-demo p {
  margin: 0;
}

.example {
  display: flex;
  align-items: stretch;
  margin-top: 1rem;
  padding: 0.5rem;
  background: var(--xenpaper-bg);
  font-family: var(--xenpaper-font-mono);
  line-height: 2em;
}

.example-label {
  flex: 0 0 auto;
  color: var(--xenpaper-placeholder);
  font-style: italic;
  padding: 0 1rem 0 0.6rem;
}

.example pre {
  flex: 1 1 auto;
  width: 0;
  margin: 0;
  padding-right: 0.5rem;
  color: var(--xenpaper-cyan);
  font: inherit;
  line-height: 1.4em;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.example button {
  flex: 0 0 auto;
  border: 0;
  display: block;
  padding: 0.5rem;
  cursor: pointer;
  background: #ff541e;
  color: var(--xenpaper-bg);
  outline: none;
  opacity: 0.7;
  transition: opacity 0.2s ease-out;
}

.example button:hover,
.example button:focus,
.example button:active {
  opacity: 1;
}
</style>
