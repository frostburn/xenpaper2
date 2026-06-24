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

# "Sothic" of "Smitonic"
# Three scale degrees are bright (i.e. wide)
# while three degrees are dark (i.e. narrow)
# as measured from the root note.
MOS{4L 3s 3|3}
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
    title: 'Multi-period scales (TODO)',
    demos: [],
  },
  {
    title: 'Accidentals (TODO)',
    demos: [],
  },
  {
    title: 'Half-accidentals (TODO)',
    demos: [],
  },
  {
    title: 'Ups and downs (TODO)',
    demos: [],
  },
  {
    title: 'Other equaves (TODO)',
    demos: [],
  },
  {
    title: 'Key signatures and modulation',
    demos: [],
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
