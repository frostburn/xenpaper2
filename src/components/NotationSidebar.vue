<script setup lang="ts">
import type { DemoTune, SidebarSection } from '../types'
import { formatDemoTune } from '../utils'

const emit = defineEmits<{
  setTune: [tune: DemoTune]
}>()

const notationSections: SidebarSection[] = [
  {
    title: 'Diatonic notation',
    demos: [
      {
        description:
          'By default Xenpaper tunes the A above middle C to 440 Hz and has a Pythagorean i.e. 3-limit minor scale on `A aligned with the 0 note.',
        tune: `# Ascending Pythagorean minor
\`A- \`B C D E F G A-
# Descending Pythagorean minor
16/9 128/81 3/2 4/3 32/27 9/8 1/1--
..
# Ascending 12edo minor
0- 2 3 5 7 8 10 12-- 
`,
      },
      {
        description: 'Upper-case nominals are followed by notes in lower-case an octave higher.',
        tune: `# Major pentatonic
C D F G A c d f g a 'c-`,
      },
      {
        description:
          'The sharp sign ♯ or hash # raises the pitch by 2187/2048 while the flat sign ♭ or b lowers the pitch by the same amount. By default the natural sign ♮ or underscore _ does nothing.',
        tune: `# Not as Uematsu intended
A_. A.  A Ab A♮-
A A A#- A A  A♯-`,
      },
    ],
  },
  {
    title: 'Tempering',
    demos: [
      {
        description:
          'Tuning using an equal temperament like {31edo} automatically affects diatonic notation: `A is aligned with the 0 note, E becomes whatever is the closest approximation to 3/2 and the circle of fifths continues from there.',
        tune: `{31edo}
# ii-V-I
[D F A C]--. [D F G B]--. [C E G c]--.`,
      },
      {
        description:
          'If the fifth is tuned very flat the process unfortunately swaps the directions of sharp and flat.',
        tune: `{23edo}
# Anti-minor sounds majorish
[\`A C  E]--.
# Anti-major has a narrow third
[\`A C# E]--.`,
      },
      {
        description:
          'It is recommended to use Ups and Downs i.e. the caret ^ and v when sharps and flats can be confusing.',
        tune: `{16edo}
# Anti-minor
[C E  G]--.
# Anti-major using a sensible inflection
[C vE G]--.`,
      },
    ],
  },
  {
    title: 'Key signatures',
    demos: [
      {
        description:
          'Key signatures can be set with `(key:G Major)` or another major/minor key. Plain nominals receive the signature accidentals, while an explicit natural sign ♮ or underscore _ restores the unaltered nominal.',
        tune: `# G major sharpens F and Zet
(key:G Major)
F Zet F_ Zet_ G A B c`,
      },
    ],
  },
  { title: 'FJS inflections (upcoming...)', demos: [] },
  {
    title: 'Semi-intervals',
    demos: [
      {
        description:
          'Every even equal temperament of the octave contains the semioctave √2 (i.e. 1\\2 or 600c) while every odd edo (besides 1edo) has a good approximation to either the neutral third √3/√2 or the semifourth 2/√3.',
      },
      {
        description: 'Neutral chords fall exactly between minor and major.',
        tune: `[1/1 32/27    3/2]--.  # Pythagorean minor
[1/1 6/5      3/2]--.  # 5-limit minor
[1/1 11/9     3/2]--.  # 11-limit neutral
[1/1 1\\2<3/2> 3/2]--.  # true neutral
[1/1 5/4      3/2]--.  # 5-limit major
[1/1 81/64    3/2]--.  # Pythagorean major`,
      },
      {
        description: 'Semiquartal chords can be fun to mess around with.',
        tune: `[1/1 8/7      4/3]--.  # inverted 6:7:8
[1/1 1\\2<4/3> 4/3]--.  # true semiquartal
[1/1 7/6      4/3]--.  # 6:7:8`,
      },
      {
        description:
          'The semi-octave is familiar from 12edo but can be used in other contexts as well.',
        tune: `4:5:6:7--.                # harmonic 7th
[0 5/4 3/2 1\\2<25/8>]--.  # true √2 against the third`,
      },
    ],
  },
  {
    title: 'Neutral tunings',
    demos: [
      {
        description:
          'When the closest approximation to 3/2 spans an even number of edosteps it often makes sense to use half-sharps (𝄲, ‡ or t) and half-flats (𝄳 or d) to reach the neutral third.',
        tune: `{10edo}
# All 10 notes (and the octave)
C Ct D Ed F F𝄲 G G‡ A B𝄳 c
`,
      },
      {
        tune: `{17edo}
# All 17 notes (and the octave)
C Ct Dd D Dt Ed E F Ft Gd G Gt Ad A At Bd B c`,
      },
    ],
  },
  {
    title: 'Even tunings',
    demos: [
      {
        description: '12edo hides scales that repeats twice every octave.',
        tune: `{12edo}
C D E F Gam Del Eps Zet c
..
C Eta D Alp E F Gam G Del A Eps Zet c`,
      },
      {
        description:
          'Unfortunately a semioctave above C falls exactly between F and G so we need a new nominal Gam (Gamma) for this purpose. (The fifthwards tritone F# may be tuned unpredictably and rarely matches the fourthwards tritone Gb.) Every interordinal nominal is related to a Latin nominal by a semioctave. Alp is a 1\\2 below A, Bet is a 1\\2 below B, Gam is a 1\\2 above C, etc. to stay within the C to c range.',
      },
      {
        description:
          'The scales retain much of their character in 22edo. Highlight colors help to differentiate Greek script from Latin.',
        tune: `{22edo}
C D E F Γ Δ Ε Ζ c
..
C Η D Α E F Γ G Δ A Ε Ζ c`,
      },
    ],
  },

  {
    title: 'Semiquartal tunings',
    demos: [
      {
        description:
          'When the closest approximation to 4/3 spans an even number of edosteps you may combine half-accidentals with interordinals to reach the semifourth.',
        tune: `{19edo}
C D Alpd Betd F G Deld Epsd Bb c`,
      },
      {
        tune: `{53edo}
# Barbados[9]
c d αd βd f g δd εd bb 'c
`,
      },
    ],
  },

  {
    title: 'Recovering 3-limit',
    demos: [
      {
        description: 'Automatic tempering can be undone by setting the scale to {Pythagorean}.',
        tune: `{5edo}
C D F G A c
{Pythagorean}
C D F G A c`,
      },
      {
        description:
          '5-limit intervals are available using syntonic accidentals 𝄬, 𝄭, 𝄮, 𝄯, 𝄰 and 𝄱 which adjust pitch by 81/80.',
        tune: `# 4:5:6 on C
[C E𝄯 G]--`,
      },
      {
        description:
          '7-limit intervals use the jubilismic √(50/49) lift slash / and the drop backslash \\ to turn interordinals back into just intonation.',
        tune: `# 5:6:7 on C
[C E𝄬 /Gam]--`,
      },
      {
        description:
          '11-limit intervals go through neutrals using the rastmic √(243/242) up caret ^ and the down v.',
        tune: `# 9:10:11 on C
[C D𝄯 vEd]--`,
      },
    ],
  },
]
</script>

<template>
  <aside class="sidebar" aria-labelledby="notation-title">
    <header class="header">
      <h1 id="notation-title">Notation</h1>
      <p>
        Write your scores using familiar standard C, D, E, F, G, A, B pitches or extended
        Pythagorean notation.
      </p>
    </header>

    <div class="content">
      <section v-for="section in notationSections" :key="section.title" class="section">
        <h2>{{ section.title }}</h2>

        <article
          v-for="demo in section.demos"
          :key="`${section.title}-${demo.description}`"
          class="demo"
        >
          <p v-if="demo.description">{{ demo.description }}</p>

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
