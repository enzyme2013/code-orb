Execution guidance for failing test fix tasks:

- inspect verification output before editing
- read the relevant test and implementation files before applying a fix
- use the smallest reasonable edit
- rerun verification after changes
- if verification still fails, use the new failure signal to decide the next step

Avoid broad refactors unless the evidence clearly requires them.
