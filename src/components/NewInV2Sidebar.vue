<script setup lang="ts">
import type { DemoTune, SidebarSection } from '../types'
import { formatDemoTune, getKeyboardModifierKeyLabel } from '../utils'

const emit = defineEmits<{
  setTune: [tune: DemoTune]
}>()

const modifierKey = getKeyboardModifierKeyLabel()

const newInV2Sections: SidebarSection[] = [
  {
    title: 'Source tabs',
    demos: [
      {
        description:
          'Use the + tab button to add another source. Every live tab plays together, so tabs are useful for layering bass lines, chords, percussion-like pulses, or alternate scales.',
        tune: [
          `(osc:fatwarm2)(env:1754)(bpm:96){r\`0}
0--- 0--- | 5--- 7--- ||`,
          `(osc:semisine)(env:2245)(bpm:96)
[0,4,7]-- [5,9,12]-- [3,7,10]--
[2,7,12]-- [0,4,7,11,12]---`,
          `(osc:gold)(env:1233)(bpm:96)(4){r'0}
5 . 7  . 10 7 5 . 7  . 12 . 10 7 5  . |
0 . 10 . 7  5 7 . 12 5 7  . 10 . 12 . ||`,
        ],
      },
      {
        description:
          'Tab names come from the first non-empty line. Close tabs with ×, then restore them from Recently closed while you keep sketching.',
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
(osc:boethius)0 4 7.`,
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
          'Aperiodic oscillator names create inharmonic spectra that can make the same pitches feel metallic, bell-like, or gamelan-like. Metallic timbres include tin, bronze, steel, silver and platinum organized by how bunched up the partials are.',
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
          'Harmonium and the gamelan timbres gender, jegogan, jublag, and ugal pair well with scales from their respective regions.',
        tune: `(osc:ugal)(env:1716)(4)
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
  <aside class="sidebar" aria-labelledby="new-v2-title">
    <header class="header">
      <h1 id="new-v2-title">New in v2</h1>
      <p>Tabs, shortcuts, and expanded oscillator colors.</p>
    </header>

    <div class="content">
      <section v-for="section in newInV2Sections" :key="section.title" class="section">
        <h2>{{ section.title }}</h2>

        <article
          v-for="demo in section.demos"
          :key="`${section.title}-${demo.description}`"
          class="demo"
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

<style scoped src="../assets/info-sidebar.css"></style>
