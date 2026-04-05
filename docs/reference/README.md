# Reference

This directory stores supporting material for the project.

Use it for:

- external reference documents
- notes derived from reviewing other coding agents, tools, or projects
- analysis artifacts produced by coding agents during design exploration

Do not use this directory as the primary home for product scope, architecture rules, ADRs, or roadmap commitments. If a reference here leads to a project decision, update the authoritative document under `docs/product/`, `docs/architecture/`, `docs/adr/`, or `docs/roadmap/`.

## Suggested Structure

```text
docs/reference/
  external/        Third-party reference material and copied notes
  agent-analysis/  Analysis writeups produced during exploration
```

## Naming Guidance

- use dated filenames for analysis notes when chronology matters
- include the source or topic in the filename
- keep summaries concise and link back to the authoritative project doc when a decision has already been adopted
