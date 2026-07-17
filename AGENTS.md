# Agent Instructions

When changing grammar syntax, parser AST node types, or anything that affects visible Xenpaper source text, always update syntax highlighting alongside the grammar change. In practice, check `src/grammars/grammar-to-chars.ts` and add or adjust highlight coverage for any new visible AST node types, including parent-qualified entries when a node should be colored differently in a specific context.

If a new visible grammar node is intentionally uncolored because it is purely structural or its characters are fully highlighted by child nodes, document that intent in the relevant test or code review notes instead of silently omitting highlighting.
