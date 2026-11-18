# ADR 0003: Keeping LLM-as-judge honest

- Status: accepted
- Date: 2026-11-18

## Context

Eval runs score prompt outputs with code checks (exact match, contains, regex, JSON schema,
length) and with an LLM judge for qualities code cannot check, such as helpfulness. Judges are known
to prefer the first answer they see, longer answers and their own style, and their scores drift
between runs.

## Decision

- **One answer per call.** The judge grades a single output against a rubric instead of picking a
  winner between two outputs, which removes position bias. Versions are compared by their average
  scores over the same dataset.
- **Calibration examples in the system prompt** anchor 1, 3 and 5 on the scale, and the prompt tells
  the judge to ignore length and style unless the rubric asks about them.
- **Fixed sampling where the provider allows it.** OpenAI judges run at temperature 0. The Anthropic
  Messages API in SDK 1.10 no longer accepts sampling parameters, so Anthropic judges rely on the
  calibration examples alone.
- **Structured output.** The judge answers `{"score": 1-5, "reasoning": "…"}`; scores outside the
  range are clamped and a missing score fails the item instead of counting as zero.
- **Judge cost counts toward the run's cost limit**, so a large dataset cannot overspend.
- Code checks run next to the judge on every item, so a regression usually shows up in at least one
  deterministic scorer too.

## How to check the judge

Add a small labelled set (20–50 items with human scores) as a dataset and run the judge on it after
changing the rubric or the judge model. Agreement with the human labels (for example Spearman
correlation) should not drop. This is a follow-up; the data model already supports it because
human feedback is stored as `scores` with `source = 'user'`.
