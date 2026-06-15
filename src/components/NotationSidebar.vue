<script setup lang="ts">
import type { DemoTune, SidebarSection } from '../types'
import { formatDemoTune } from '../utils'

const emit = defineEmits<{
  setTune: [tune: DemoTune]
}>()

const notationSections: SidebarSection[] = [
  {
    title: 'Explicit semi-intervals',
    demos: [
      {
        description:
          'Every even equal temperament of the octave contains the semioctave √2 (600c) exactly while every odd edo (besides 1edo) has a good approximation to either the neutral third √3/√2 or the semifourth 2/√3. In Xenpaper you can split a ratio in half by prefixing it with a √ or sqrt. (Visualize the fraction vertically and the notation should make sense.)',
      },
      {
        description: 'Neutral chords fall exactly between minor and major.',
        tune: `[1/1 32/27   3/2]--.  # Pythagorean minor
[1/1 6/5     3/2]--.  # 5-limit minor
[1/1 11/9    3/2]--.  # 11-limit neutral
[1/1 sqrt3/2 3/2]--.  # true neutral
[1/1 5/4     3/2]--.  # 5-limit major
[1/2 81/64   3/2]--.  # Pythagorean major`,
      },
      {
        description: 'Semiquartal chords can be fun to mess around with,',
        tune: `[1/1 8/7  4/3]--.  # inverted 6:7:8
[1/1 √4/3 4/3]--.  # true semiquartal
[1/1 7/6  4/3]--.  # 6:7:8`,
      },
      {
        description: 'Split intervals can be used in colon-separated ratio chords too.',
        tune: `4:5:6:7--.    # harmonic 7th
4:5:6:√50--.  # true √2 against the third`,
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
