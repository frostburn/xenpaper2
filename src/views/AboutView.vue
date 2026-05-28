<template>
  <main class="about-view">
    <h1>About Xenpaper 2</h1>
    <p>
      Xenpaper 2 is a text-based microtonal sequencer for writing musical ideas, playing them in the
      browser, and sharing them by URL or embed code.
    </p>
    <h2>Project GitHub repository</h2>
    <a target="_blank" href="https://github.com/frostburn/xenpaper2">Frostburn / Xenpaper 2</a>
    <h2>Software libraries used</h2>
    <ul>
      <li><a target="_blank" href="https://vuejs.org/">Vue 3</a> (progressive framework)</li>
      <li>
        <a target="_blank" href="https://www.typescriptlang.org/">TypeScript</a> (programming
        language)
      </li>
      <li><a target="_blank" href="https://peggyjs.org/">Peggy</a> (grammar/parser)</li>
      <li>SW Seq (web audio sequencer yet to be released)</li>
    </ul>
    <h3>Original project (archive)</h3>
    <a target="_blank" href="https://github.com/dxinteractive/xenpaper"
      >DX Interactive / Xenpaper 1</a
    >
  </main>
</template>

<style scoped>
.about-view {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow: auto;
  max-width: 48rem;
  padding: 4rem 2rem;
  color: var(--xenpaper-text);
  background: var(--xenpaper-bg);
}

.about-view h1 {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 400;
  line-height: 1;
}

.about-view p {
  margin: 0;
  color: var(--xenpaper-placeholder);
  font-family: var(--xenpaper-font-copy);
  font-size: 1.25rem;
  line-height: 1.5;
}
</style>
