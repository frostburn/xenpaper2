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
0- 2 3 5 7 8 10 12--`,
      },
      {
        description: 'Upper-case nominals are followed by notes in lower-case an octave higher.',
        tune: `# Major pentatonic
C D F G A c d f g a 'c`,
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
    title: 'Root nominal association',
    demos: [
      {
        description:
          'Root setters normally change only the frequency used by ratio and edo-degree pitches. Add `as` with an absolute nominal to make staff-style notes treat that same frequency as a named pitch.',
        tune: `# Make middle C the root frequency
{r261.6256Hz as C}
C E G 0`,
      },
      {
        description: 'You can also associate the current root with a nominal.',
        tune: `# Keep the current 220 Hz root, but call it F
{r as F}
F A C 0`,
      },
      {
        description: 'Include octave marks when the named pitch is above or below the root octave.',
        tune: `# Set a new root and nominal together
{r216Hz as \`A}
\`A A 0`,
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
          'Key signatures can be set with `(key:G Major)` or modal names like `(key:D Dorian)`. Plain nominals receive the signature accidentals, while an explicit natural sign ♮ or underscore _ restores the unaltered nominal.',
        tune: `# G major sharpens F
(key:G Major)
G- A B c d e f g-
# Flat seventh to tonic
f_- g--`,
      },
      {
        description:
          'Custom key signatures allow you to attach ups, lifts, accidentals and inflections (see below) to plain nominals. A natural sign restores the original nominal.',
        tune: `# 5-limit Phrygian
(sig: Bbv5 Cv5 Fv5 Gv5)
\`A \`B C D E F G A- B_ A-`,
      },
      {
        description:
          'Use the pythagorean accidentals p/q (a.k.a. po and qu from Color notation) to jump between named pitches.',
        tune: `# Against root A,
# B becomes 10/9 while
# c takes the place of 9/8.
(sig: B^5 Cbp)
\`A \`B C D E F G A-`,
      },
    ],
  },
  {
    title: 'FJS inflections',
    demos: [
      {
        description:
          'The Functional Just System lets you spell just intonation by tweaking the Pythagorean spine with small inflections. E.g. A Pythagorean minor third 32/27 can be turned into 6/5 by multiplying it by the syntonic inflection 81/80. The "five" is in the denominator so in FJS the "arrow" v points down.',
        tune: `1/1 6/5 4/3 3/2 9/5 2/1 . .
\`A  Cv5 D   E   Gv5 A   . .`,
      },
      {
        description:
          'On the other hand that 81/80 goes up in pitch so in HEJI the arrow ^ points up.',
        tune: `# Sharpen C and G a bit
\`A  C^5h D E G^5h A`,
      },
      {
        description:
          "There's a plethora of different inflection commas used for different purposes. Xenpaper inherits from SonicWeave but syntax-wise only ^ and v are allowed. E.g. 48/35 against root A has to be spelled Dv5v7.",
        tune: `{8::16}
0  1  2     3      4  5      6     7     8 . .
# FJS
\`A \`B C#^5  D^11   E  F^13   G^7   G#^5  A . .
# HEJI
\`A \`B C#v5h D^11h  E  F^13h  Gv7h  G#v5h A ..
# Neutral FJS
\`A \`B C‡^5n D‡^11n E  F‡^13n G‡^7n G‡^5n A . .`,
        link: 'List of comma flavors',
        href: 'https://github.com/xenharmonic-devs/sonic-weave/blob/main/documentation/commas.md',
      },
      {
        description: 'Inflections respond to tempering.',
        tune: `# Harmonic seventh in JI
[G B^5 d f^7]-- .

# Harmonic seventh in 19-TET
{19edo}
[G B^5 d f^7]-- .
# i.e.
[16 22 27 31]-- .`,
      },
    ],
  },
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
      {
        description: 'Key signatures support quartertones.',
        tune: `(key: C Locrian)
C F B e a 'd 'g
(key: Cd Locrian)
C F B e a 'd 'g
(key: Cb Locrian)
C F B e a 'd 'g
(key: Cdb Locrian)
C F B e a 'd 'g`,
      },
    ],
  },
  {
    title: 'Even tunings',
    demos: [
      {
        description: '12edo hides scales that repeat twice every octave.',
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
      {
        description: 'Key signatures translate across semioctaves.',
        tune: `(key: F major)
F Zet G eta A alp
# Both B and Bet become flat
B bet

c gam d del e eps f Zet F-`,
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
    title: 'Notes outside the edo',
    demos: [
      {
        description:
          'When equal tempering causes a written pitch to land between edosteps, Xenpaper marks it as an invalid pitch so you can respell it with an available degree or switch to a finer edo.',
        tune: `{12edo}
C D E F G A B c
# Ct falls halfway between 12edo steps
Ct-`,
      },
    ],
  },
  {
    title: 'Custom Ups or Lifts',
    demos: [
      {
        description: 'The Ups-and-Downs inflection is customizable.',
        tune: `# Make ups septimal
(^: 64/63)
# Down-minor is 6:7:9
[\`A vC E]-- .
# Up-major is 14:18:21
[\`A ^C# E]-- .`,
      },
      {
        description: 'By default a tempered lift is worth 5 ups, but can be configured separately.',
        tune: `{311edo}
# Make lifts septendecimal
(/: 4\\311)
# ~9:12:16:17
[\`A D G /Ab]---`,
      },
      {
        description: 'Ups and lifts attach to numeric scale degrees too.',
        tune: `(^:1\\24;/:5\\25)
0 ^0 1 v2 2 /0`,
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
  {
    title: 'Custom mappings',
    demos: [
      {
        description:
          'Custom mappings set the prime mapping directly. Step entries derive the step size from the equave by default, so {<17 27 40]} maps primes 2, 3, and 5 to 17, 27, and 40 steps of 17c val.',
        tune: `# This progression would drift with plain
# {17edo} so we use the 17c val instead.
{<17 27 40]}
(1) |:(x10)
[\`A Cv5 E]
[Cv5 E Gv5]
[\`B Dv5 Gv5]
[\`Av5 Dv5 F#]
{r\`Av5} :|`,
      },
      {
        description:
          'Cent entries set the mapping in cents and use a one-cent step size. For step entries, add an anchor such as @3 to derive the step size from the 3-prime instead of the equave; for example {<12 19 28]@3}.',
        tune: `# Generator climb in WE tuned tetracot
{<1199.559c 1903.939c 2784.414c]}
\`A    E     F     |
\`B^5  E     D^5   |
C#^25 D^5   F^5   |
D#^125-     E^125 |
E#^5^5^5^5- C^5   |
[E A]---          |`,
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
          <a v-if="demo.href" :href="demo.href">{{ demo.link }}</a>
        </article>
      </section>
    </div>
  </aside>
</template>

<style scoped src="../assets/info-sidebar.css"></style>
