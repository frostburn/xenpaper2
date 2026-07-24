<script setup lang="ts">
import type { DemoTune, SidebarSection } from '../types'
import { formatDemoTune } from '../utils'

const emit = defineEmits<{
  setTune: [tune: DemoTune]
}>()

const notationSections: SidebarSection[] = [
  {
    title: 'Non-diatonic notation',
    demos: [
      {
        description:
          'Many equal temperaments lack an interval near a just 3/2, but still contain many useful scales constructed by stacking one generating interval.',
        tune: `# Stacking 8\\11 produces the "Nerevarine" mode
{11edo}{0 2 4 5 7 8 10 11}
0 1 2 3 4 5 6 7-

# The same mode of the "Smitonic" scale
MOS{4L 3s}
J K L M N O P j-`,
      },
      {
        description:
          'Moment of symmetry scales consist of large (L) and small (s) steps mixed as evenly as possible. They use nominals from J onwards and J is always aligned with the root frequency.',
        tune: `# "Dylathian" mode of "Oneirotonic"
MOS{5L3s}
J K L M N O P Q j-
{r333Hz}
J K L M N O P Q j-`,
      },
      {
        description:
          'Modes are selected by specifying an explicit pattern or by using UDP notation.',
        tune: `# "Lorkhanic" of "Smitonic"
MOS{LsLsLLs}
J K L M N O P j-

# "Kagrenacan" of "Smitonic"
# Two scale degrees are bright (i.e. wide)
# while four degrees are dark (i.e. narrow)
# as measured from the root note.
MOS{4L 3s 2|4}
J K L M N O P j-`,
      },
    ],
  },
  {
    title: 'Scale hardness',
    demos: [
      {
        description:
          'The ratio between the sizes of L and s steps is called hardness. It defaults to 2:1 i.e. "basic" hardness. You can either provide the scale pattern in terms of small integers or by specifying L:s after the fact.',
        tune: `# "Anti-Kadathian" of hard "Checkertonic"
MOS{31131131}
J K L M N O P Q j-

# "Anti-locrian" of soft "Anti-diatonic"
MOS{2L 5s 3:2}
J K L M N O P j-`,
      },
      {
        description: 'More complex step ratios require commas between the steps.',
        tune: `# "Salmon" of ultrahard "Pine"
MOS{43, 43, 10, 43, 43, 43, 43, 43}
J K L M N O P Q j-`,
      },
    ],
  },
  {
    title: 'Multi-period scales',
    demos: [
      {
        description:
          'MOS scales that have multiple identical periods per octave have less modes available.',
        tune: `# ssLssL
MOS{2L 4s 0|4(2)}
J K L M N O j-

# sLssLs
MOS{2L 4s 2|2(2)}
J K L M N O j-

# LssLss (period is optional)
MOS{2L 4s 4|0}
J K L M N O j-`,
      },
    ],
  },
  {
    title: 'Accidentals',
    demos: [
      {
        description:
          'Ampersand & (read "am") raises by one chroma (L - s), while at-sign @ (read "at") lowers by one chroma.',
        tune: `MOS{2L 5s}
J J& K L M N@ N O P j-`,
      },
    ],
  },
  {
    title: 'Half-accidentals',
    demos: [
      {
        description:
          'The e and a accidentals (read "semi-am" and "semi-at") raise or lower by half a chroma.',
        tune: `MOS{2L 5s 3:1}
J Je J& K L M N@ Na N O P j-`,
      },
    ],
  },
  {
    title: 'Ups and downs',
    demos: [
      {
        description:
          'Diamond-mos pitches get their own ups and downs from the underlying equal temperament.',
        tune: String.raw`# Minihard Trial implying 17edo
# L = 7\17
# s = 3\17
# & = L-s = 4\17
# e = &/2 = 2\17
# ^ = 1\17 (always one step)
# / = 5\17 (always five steps)
MOS{2L 1s 7:3}
J ^J Je ^Je J& /J vK K`,
      },
      {
        description:
          'Hardness declarations are not reduced. 8:4 implies basic hardness but finer octave division.',
        tune: `# 12edo Lydian but ups are 1\\48
MOS{5L 2s 8:4}
J ^J Je vJ& J&`,
      },
      {
        description: 'MOS ups and lifts are customizable.',
        tune: `MOS{7L 1s 43:10 3|4 ^4 /12}
[J vL /N O ^Q j k]---`,
      },
    ],
  },
  {
    title: 'Other equaves',
    demos: [
      {
        description: 'MOS equave is set by enclosing it in angle brackets.',
        tune: `# "Cassiopeian" of "Lambda (Bohlen-Pierce)"
MOS{4L5s<3> 5|3}
J K L M N O P Q R j-`,
      },
      {
        tune: `# 9edf is acceptable for Carlos Alpha
# "Dionian" of hard "Saturnian"
MOS{2L3s<3/2> 2|2 3:1}
J K L M N j-`,
      },
    ],
  },
  {
    title: 'Modulation and key signatures',
    demos: [
      {
        description: 'You can move the same MOS mode to a different key...',
        tune: `# "Erev" of "Machinoid"
MOS{5L 1s}
J K L M N O j-

# Same scale but 4\\11 higher
# J becomes J& and K becomes K&
(key:L)
L M N O j k l-`,
      },
      {
        description: '...or specify a new UDP mode altogether.',
        tune: `# "Medicinal" of "Manual"
MOS{4L 1s 3|1}
J K L M N j-

# Switch to "Indical" mode on K
# M becomes M@
(key:K 1|3)
K L M N j k-`,
      },
      {
        description:
          'Custom key signatures are supported. A natural sign restores the unaltered nominal.',
        tune: `MOS{5L 7s 15:13 6|5}
(sig: ^^^K ^M& vN@ ^^\\P ^^^R vvvS ^^^T vvvU)
J K L M N O P Q R S T U j U_ j-`,
      },
    ],
  },
  {
    title: 'Large scales',
    demos: [
      {
        description:
          'When the system runs out of nominals it starts over but prefixes everything with a J.',
        tune: `(env:1192)(8)
MOS{14L5s}
J---- K L M N O P Q R S T
U V W X Y Z JJ JK j----`,
      },
    ],
  },
  {
    title: 'MOS config is independent',
    demos: [
      {
        description:
          'MOS configuration seeds numbered degrees, but later numbered scale setters do not affect the nominals from J onwards.',
        tune: `# Set diamond-mos first: it has its own
# graves, primes, ups and downs.
MOS{2L1s<4/3>}
\`J J K L j 'j "j "^j "j--

# Numbered degrees follow plain MOS nominals,
# including graves, primes, ups and lifts.
0 1 2 '0 ^0 /0 \`0-

# Later numbered scale setters do not
# affect nominals from J onwards.
{5ed3}
0 1 2 3 4 '0-
J K L j 'j-

# Diatonic notation is still Ptolemaic
{Pythagorean}
(^:81/80)
c d ve f g- 'c`,
      },
    ],
  },
]
</script>

<template>
  <aside class="sidebar" aria-labelledby="notation-title">
    <header class="header">
      <h1 id="notation-title">Diamond-mos notation</h1>
      <p>
        <a href="https://en.xen.wiki/w/Diamond-mos_notation">Diamond-mos notation</a> is a
        JI-agnostic microtonal notation system designed for writing non-diatonic mosses, designed by
        members of the <a href="https://discord.com/invite/QhJBn3b2wX">XA Discord</a>.
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
