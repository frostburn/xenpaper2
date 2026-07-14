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
    title: 'Repeats and jumps',
    demos: [
      {
        description:
          'Alternate endings and D.S. al Coda markings let a single tab sketch compact song forms with first/second endings and a jump back to the segno before the coda.',
        tune: `(bpm:132)(osc:warm2)(env:1624)
{1/1 16/15 9/8 6/5 5/4 4/3 7/5 3/2 8/5 5/3 16/9 15/8}
[0,4,7]- 2 |  5  4  2 |
(Segno)    |: 0  4  7 | 5 4 2 |(^1) 0 2 4 :|(^2) 7 9 11 |
(To Coda)  |  12 11 9 | 7 4 2 |     5 7 9  |     4-  2  |
(D.S. al Coda)

(Coda) | [0,2,7]-- | [5,7,12]-- | [0,4,7,12]--- ||`,
      },
      {
        description:
          'D.C. al Fine returns to the beginning and stops at Fine; this 4/4 example uses superscript alternate endings with |¹ and :|².',
        tune: `(bpm:112)(osc:semisine)(env:1624)
# square little 4/4 tune
|: 0 2 4 5 |¹ 7 5 4 2 :|² 7 11 12- |
(Fine) 12 11 9 7 | 5 4 2 \`11 |
(D.C. al Fine)`,
      },
    ],
  },
  {
    title: 'Ruler',
    demos: [
      {
        description:
          'Ruler plots can now show nominal families explicitly: use (plot:Latin), (plot:Greek), or (plot:MOS) to add Latin, Greek, or MOS nominal guide pitches while plain (plot) still plots the current numbered scale.',
        tune: `(plot:Latin){r as C}(plot:Greek)
MOS{5L2s}(plot:MOS)`,
      },
    ],
  },
  {
    title: 'More forgiving notation',
    demos: [
      {
        description:
          'Chords now allow relaxed whitespace after [ and before ], optional commas when spaces already separate pitches, and holds that continue through barlines.',
        tune: `[ 0, 4, 7 ]--|---|
[ '0 4 7 ]--- [ 0 3 7 10 ]---`,
      },
      {
        description:
          'Octave-division pitch literals can divide custom octave sizes inline. Use compact forms like 5\\13<3> or spaced forms like 7\\13 ed 3.',
        tune: '5\\13<3> 7\\13 ed 3 9\\13 < 3 > 13\\13 ed 3.',
      },
    ],
  },
  {
    title: 'Glissando',
    demos: [
      {
        description:
          'Use (gliss) to slide legato into the next note and hold the target. Linear glissando is the default.',
        tune: '(gliss)0--- 7',
      },
      {
        description:
          'Use ? on the target to make it zero-duration. Easing modes are linear, ease, ease-in, ease-out, and ease-in-out.',
        tune: `(gliss ease-in-out)11--- 12--
..
(gliss ease-in)0--- 7?
..
(gliss ease-out)9--- 5-`,
      },
      {
        description: 'Chord glissandi pair voices by index, so each chord tone slides legato.',
        tune: `(gliss)[0 3 7]--(gliss)[0 3 7]
(gliss)[0 3 9]--(gliss)[0 3 9]
[2 7 10]---`,
      },
    ],
  },
  {
    title: 'Grace notes',
    demos: [
      {
        description:
          'Use a grace setter before a note to make that note borrow a short duration from the following note. Repeat the ? marker to apply the same grace duration to multiple notes.',
        tune: `(bpm:90)(env:1624)
(8?) 5 3- (16?) 7 5-
(8??) 7 10 8--
(grace:4) 10 12--`,
      },
    ],
  },
  {
    title: 'Inverted chords',
    demos: [
      {
        description:
          'Prefix a ratio chord with / to invert the written ratios. For example /6:5:4 expands as 6/6, 6/5, 6/4 as opposed to 4/4, 5/4, 6/4.',
        tune: `(bpm:72;env:1734)
4:5:6-- /6:5:4--
4::7--  /7::4--`,
      },
      {
        description:
          'The same inversion prefix can be used in scale braces, so numbered scale degrees walk through the inverted chord.',
        tune: `{/6:5:4}
0 1 2 1 0--`,
      },
    ],
  },
  {
    title: 'Enumerated chord expansion',
    demos: [
      {
        description:
          'Inside square brackets, an enumerated ratio segment expands from the previous pitch. This lets you shift the root first and then write compact ratio chords, such as a 4:5:6 triad rooted on 4/3.',
        tune: `(bpm:70;env:1734)
[4/3 4:5:6]--
[3/2 4:5:6]--
[5/4 /6:5:4]--`,
      },
      {
        description:
          'You can stack multiple enumerated segments in the same chord. Each later segment continues from the last expanded pitch, so compact segments can build larger chained sonorities.',
        tune: `(bpm:70)(env:1734)
[4:5:6 5:6:7]--
[3/2 5:6:7 /11::8]--`,
      },
    ],
  },
  {
    title: 'Enumerated scale expansion',
    demos: [
      {
        description:
          'Scale braces also expand enumerated ratio segments from the previous scale pitch. After defining the expanded scale, ordinary numbered degrees select the generated pitches.',
        tune: `{1/1 4/3 5:6:7}
0 1 2 3 4 2 1 0--`,
      },
    ],
  },
  {
    title: 'Dynamics and volume',
    demos: [
      {
        description:
          'Synth velocity can be controlled using dynamic markers like (f) and (pp) or by directly specifying the velocity.',
        tune: `(mf) 0--  # 50% (default)
(f) 1--  # 60%
(ff) 2--  # 80%
(fff) 3--  # 100%

(vel:70%) 1--  # Fine-grained control

(mp) 0--  # 40%
(p) \`11--  # 30%
(pp) \`10--  # 20%
(ppp) \`9--  # 10%`,
      },
      {
        description: 'Tab volume can be adjusted in decibels.',
        tune: `(env:1198)
0 . 5
(vol:-10db).(vol:0db).
(vol:-10db).(vol:+5db).
(vol:-10db).(vol:+5db).
(vol:-10db).(vol:+5db).
(vol:-10db).(vol:+5db).
...`,
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
    title: 'Noise and percussion',
    demos: [
      {
        description:
          'Noise generators use (noise:white), (noise:pink), (noise:brown), (noise:blue), or (noise:violet). White is flat, pink and brown are progressively darker, while blue and violet are progressively brighter.',
      },
      {
        description:
          'Use ! for a note whose noise clock runs at the audio context sample rate. With short envelopes it works well for hi-hats; 0 can drive lower pitched noise as kicks, and octave-shifted "0 notes can cut through as snares.',
        tune: `(bpm:200)(noise:violet)(env:0600)
[0!] ! ["0!] !    [0!] !    ["0! ] ! |
[0!] ! ["0!] [0!] !    [0!] [0"0!] . ||`,
      },
      {
        description: 'For softer noise, specify the interpolation type.',
        tune: `(mp)(noise: white constant)
 '0---
 "0---
'"0---
....
(f)(noise: white linear)
 '0---
 "0---
'"0---`,
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
          'Harmonium, piano and the gamelan timbres gender, jegogan, jublag, and ugal pair well with scales from their respective regions.',
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
  {
    title: 'Drones',
    demos: [
      {
        description:
          'You can start a long-running note or chord in the background that runs until the next drone, when you turn the drone off or when the score ends.',
        tune: `(drone:[1/4 2/4])
4/4- 6/4   5/4  | 7/4-      8/4  10/4   |
9/4  13/4- 11/4 | 14/4 15/4 16/4 .      |
(drone:3/8)
17/4 16/4 15/4 14/4 | 11/4 10/4- 9/4 |
(drone:off)
[2/4 8/4]---        ||`,
      },
    ],
  },
  {
    title: 'Groove',
    demos: [
      {
        description:
          'Set an uneven groove to play with a swung feel. Even divisions of the same span will be cyclically mapped to match it.',
        tune: `# Straight
0 0 4 4 7 7 9 9 10 10 9 9 7 7 4 4 |
# Triplet swing
(groove:(3)!-!)
0 0 4 4 7 7 9 9 10 10 9 9 7 7 4 4 |
# Quintuplet swing
(groove:(5)!--!-)
0 0 4 4 7 7 9 9 10 10 9 9 7 7 4 4 |
# Back to straight rhythm
(groove:!!)
0 0 4 4 7 7 9 9 '0---     . . . . ||`,
      },
      {
        description: 'More complex grooves can be set by using more than two notes.',
        tune: `(groove:(4)!--!-!)
0 1 2   5 4 3 |
2 1\`11 \`7 7 . |
5 4 5   . . . |
4 3 4   . . . |
(4) 3  2 1 0 \`11-
   \`9 \`8-- \`7-|
0----- ...... ||`,
      },
    ],
  },
]
</script>

<template>
  <aside class="sidebar" aria-labelledby="new-v2-title">
    <header class="header">
      <h1 id="new-v2-title">New in v2</h1>
      <p>Tabs, shortcuts, notation, expanded oscillator colors, and noise percussion.</p>
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
