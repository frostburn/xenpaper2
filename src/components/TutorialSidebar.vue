<script setup lang="ts">
type TutorialDemo = {
  description: string
  tune?: string
}

type TutorialSection = {
  title: string
  demos: TutorialDemo[]
}

const emit = defineEmits<{
  setTune: [tune: string]
}>()

const tutorialSections: TutorialSection[] = [
  {
    title: 'How it works',
    demos: [
      {
        description:
          'Create tunes by typing in the text area. Press play to hear what you have written.',
      },
    ],
  },
  {
    title: 'Notes',
    demos: [
      {
        description:
          'Typing a number will create a note. Notes can be separated by spaces or commas.',
        tune: '0 4 7 12',
      },
      {
        description: 'Notes can be held for longer with hyphens, and rests can be added with dots.',
        tune: '0.2.3...3-2-0--.',
      },
      {
        description:
          'Spaces, new lines and bars can be placed anywhere between notes. Bars can also be placed during a note.',
        tune: '0 8 7-|0 8 7-|-5 4--',
      },
      {
        description:
          'Notes can be written as scale degrees, ratios, cents, octave divisions, octave divisions with custom sizes, or cycles per second.',
        tune: '0 7 1/1 3/2 0c 702c\n0\\19 11\\19 220Hz 330Hz',
      },
      {
        description:
          'Notes can be shifted up or down octaves. Apostrophes shift up and backticks shift down.',
        tune: "0-3-'0-'3-\"0-'\"0-`0-``0-",
      },
      {
        description:
          'Chords can be played by using square brackets around comma-separated pitches.',
        tune: '[3,7]-[5,8]-[0,3,7]--.[1/1,6/5,3/2]--.',
      },
      {
        description: 'Chords can also be played using colon-notated ratios.',
        tune: '10:12:15---',
      },
    ],
  },
  {
    title: 'Comments',
    demos: [
      {
        description: 'Comments can be added using # at the start of a line.',
        tune: '# a 7th chord\n[0,4,7,10]--..\n\n# a harmonic 7th chord\n4:5:6:7--..',
      },
    ],
  },
  {
    title: 'Scales',
    demos: [
      {
        description:
          'The scale can be changed at any time with braces. The default is 12 equal divisions of the octave.',
        tune: '[0,4,7]--- {31edo}[0,10,18]---',
      },
      {
        description:
          'Equal division equave size can be changed by replacing the “o” with a number or fraction.',
        tune: '{13ed3}0 1 2 3 4',
      },
      {
        description: 'Scales can be comprised of individual pitches.',
        tune: '{1/1 9/8 5/4 4/3 3/2 5/3 15/8}\n0 1 2 3 4 5 6 7-',
      },
      {
        description:
          'Scales comprised of individual pitches can also set their equave size using an apostrophe after the last pitch.',
        tune: "{1/1 5/4 4/3 3/2'}\n0 1 2 3 4 5 6 7 8-",
      },
      {
        description: 'Scales can use colon-notated ratios.',
        tune: '{12:14:16:18:21}\n0 1 2 3 4 5 6 7-',
      },
      {
        description:
          'Harmonic series segments can be specified by using :: inside a colon-notated ratio scale.',
        tune: '{4::7}\n0 1 2 3 4-',
      },
      {
        description:
          'Scales can reference the scale degrees at the moment they are encountered, which is useful for creating a subset of a scale.',
        tune: '{19edo}{0 3 6 8 11 14 17}\n0 1 2 3 4 5 6 7-',
      },
      {
        description: 'Modes can be set using {m...}.',
        tune: '{12edo}{m2 1 2 2 1 2 2}\n0 1 2 3 4 5 6 7-',
      },
      {
        description: 'All pitch values other than cycles per second are relative to a root note.',
        tune: '0 2 4-{r432Hz}0 2 4-',
      },
      {
        description:
          'As each root pitch change is relative to the current root, multiple roots can be chained.',
        tune: '4 0-{r2}4 0-{r2}4 0-',
      },
      {
        description: 'Root changes can also switch octaves for a time.',
        tune: "4 0-{r'0}4 0-{r`0}4 0-",
      },
    ],
  },
  {
    title: 'Setters',
    demos: [
      {
        description:
          'Setters configure parameters as a tune progresses, such as (bpm:100) or (osc:sine). Multiple setters can be combined with semicolons.',
      },
    ],
  },
  {
    title: 'Timing',
    demos: [
      {
        description: 'Tempo can be changed using the tempo setter. Defaults to (bpm:120).',
        tune: '(bpm:200)7 5 4 2 0...',
      },
      {
        description: 'Tempo can also be set using milliseconds per beat.',
        tune: '(bms:1000)3 2 0',
      },
      {
        description:
          'Divisions of the beat can be set using the division setter, or shortened to values like (4).',
        tune: '0 2 3 7(3)0 2 3 7(4)0 2 3 7(1/2)0 2 3 7',
      },
    ],
  },
  {
    title: 'Sound',
    demos: [
      {
        description:
          'The oscillator can be changed using the oscillator setter. Defaults to (osc:triangle).',
        tune: '(osc:sine)0 4 7.\n(osc:sawtooth)0 4 7.\n(osc:square)0 4 7.',
      },
      {
        description:
          'Oscillator values include sine, sawtooth, square and triangle, with optional fm, am, or fat prefixes and partial-count suffixes.',
        tune: '(osc:fmsine)0 4 7.\n(osc:fatsquare)0 4 7.\n(osc:sawtooth5)0 4 7.',
      },
      {
        description:
          'The envelope setter accepts four digits for attack, decay, sustain and release, where 0 is fast or small and 9 is slow or big.',
        tune: '(env:0158)0-.....\n(env:6860)0---...',
      },
    ],
  },
  {
    title: 'Ruler',
    demos: [
      {
        description:
          'The current scale can be plotted by calling (plot). Calling it multiple times renders multiple scales.',
        tune: '(plot){19edo}(plot)',
      },
    ],
  },
]
</script>

<template>
  <aside class="tutorial-sidebar" aria-labelledby="tutorial-title">
    <header class="sidebar-header">
      <h1 id="tutorial-title">Xenpaper</h1>
      <p>Text-based microtonal sequencer.</p>
    </header>

    <div class="sidebar-content">
      <section v-for="section in tutorialSections" :key="section.title" class="tutorial-section">
        <h2>{{ section.title }}</h2>

        <article
          v-for="demo in section.demos"
          :key="`${section.title}-${demo.description}`"
          class="tutorial-demo"
        >
          <p>{{ demo.description }}</p>

          <div v-if="demo.tune" class="example">
            <span class="example-label">e.g.</span>
            <pre>{{ demo.tune }}</pre>
            <button type="button" @click="emit('setTune', demo.tune)">Demo</button>
          </div>
        </article>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.tutorial-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
  background: var(--color-background-soft);
}

.sidebar-header {
  padding: 2rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-mute);
}

.sidebar-header h1 {
  margin: 0 0 0.5rem;
  font-size: 2rem;
}

.sidebar-header p {
  margin: 0;
  color: var(--color-text);
  font-style: italic;
}

.sidebar-content {
  overflow: auto;
  padding: 1.5rem;
}

.tutorial-section + .tutorial-section {
  margin-top: 2rem;
}

.tutorial-section h2 {
  margin: 0 0 1rem;
  font-size: 1.25rem;
}

.tutorial-demo + .tutorial-demo {
  margin-top: 1.5rem;
}

.tutorial-demo p {
  margin: 0;
}

.example {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: start;
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--color-background);
  font-family: monospace;
}

.example-label {
  color: var(--color-text);
  font-style: italic;
}

.example pre {
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  color: hsla(160, 100%, 37%, 1);
}

.example button {
  padding: 0.4rem 0.6rem;
  border: 0;
  color: var(--color-background);
  background: hsla(160, 100%, 37%, 1);
  cursor: pointer;
}

.example button:hover {
  opacity: 0.8;
}
</style>
