---
name: annotate-cases
description: Annotate merge cases one at a time together with the user, proposing labels for the user to approve and growing the label list as cases are analysed. Use when the user runs /annotate-cases <alias> [case id | group id].
argument-hint: <alias> [case id | group id, e.g. afp/diff3/mergiraf] [--output <path>]
---

# Annotate merge cases interactively

Analyse one case of `output/analysis/<alias>` (or `<output>/analysis/<alias>` with `--output`) with the user, propose labels, and write the annotation only after the user approves it. The label list starts empty and grows as cases are analysed; the user decides every label.

Judge only from the case files. Never write a label, an annotation or a change to the label list without the user's approval.

## 1. Pick the case

- **A case id was given:** use it.
- **A group id was given** (for example `afp/diff3/mergiraf`): run `npm run --silent dev -- analysis check <alias> -g <group>` and take the first case it lists.
- **Neither:** run `npm run --silent dev -- analysis check <alias>`, ask the user which group to work on (offer a few groups that still have cases to annotate), and take the first case of that group.

`analysis check` lists `pending` or `stale` cases with their focus tools and groups. `stale` means the files changed since the annotation was written: annotate it again from scratch.

## 2. Read the case

In `<analysis>/cases/<id>/`, read:

- `case.json`: computed facts. `groups` lists the groups the case was picked for, and `focus` the tools to annotate: both tools of every group. Per tool: `state`, `conflicts`, `conflictBlocks` (with `sidesEqualIgnoringWhitespace`), `missingLines`, `extraLines`, `missingMergeOnlyLines`, `sameLinesDifferentOrder` and examples. For the case: `mergeOnlyLines`. The line facts ignore whitespace and blank lines.
- `case.txt`: diffs base→left, base→right, base→merge commit, and for each tool its conflict blocks and its diff from the merge commit. Diffs longer than 400 lines are cut.
- The revision files (`base.<ext>`, `left.<ext>`, …) only for line ranges a diff doesn't show.

Also read the label list, `src/analysis/cases/labels.json`. Do not read other annotations or tool source code, and do not run any tool.

## 3. Present the case

Tell the user, concisely:

1. **Scenario:** what left did, what right did, and what the merge commit did, relative to base.
2. **For each focus tool**, according to its group (`afp/A/B`: A conflicts, B merges cleanly and matches the merge commit; `afn/A/B`: A merges cleanly but differs from the merge commit, B conflicts; `clean-different/A`: A merges cleanly but differs from the merge commit):
   - Why A reported these conflicts, or why A's output differs from the merge commit. For a difference, say whether it is formatting only, whether the merge commit contains edits neither side made, or whether the merge commit dropped a side's change.
   - Whether that looks expected from how A works or like a possible error, and whether A should have reported different conflicts.
   - For AFP and AFN, how B handled the same places: by design, by mistake or by luck, as far as the files show.
3. **Signals** from the facts that support this, such as equal sides in a conflict block or lines only in the merge commit.

Separate what the files show from your opinion. Keep it short: the user can open the full case on the page.

## 4. Propose labels

There are two kinds of labels in `labels.json`, each with `appliesTo`:

- **Behaviour labels** (`"kind": "behavior"`): why a tool produced its output. `appliesTo` lists tool states: `conflict`, `clean-equal`, `clean-different`. Every focus tool gets one or more, including tools that simply merged cleanly: one per kind of conflict block or per kind of difference, or a single label for how a clean tool handled the changes.
- **Outcome labels** (`"kind": "outcome"`): why the case is in a group, such as "the developer edited during the merge" or "B's choice happened to match the merge commit". `appliesTo` lists metrics: `afp`, `afn`, `clean-different`. Every group in `groups` gets exactly one: the main reason. Secondary reasons go in its note.

For each label:

- Prefer an existing label whose rule holds and whose `appliesTo` includes the tool's `state` (behaviour) or the group's metric, the part of the group id before the first `/` (outcome).
- When none fits, propose a new label: an `id` (lowercase words joined by hyphens), its `kind`, `appliesTo`, a short `name`, a `rule` that can be checked against the case files, and a one-line `example`. Make the rule general enough to apply to other cases, not just this one.

Ask the user with AskUserQuestion: one question per focus tool for its behaviour labels, then one per group for its outcome label (several questions can go in one call). Put your proposal first and reasonable alternatives (other existing labels, or a differently scoped new label) after it. The user can also answer with their own label or edits. Repeat until every tool and group has approved labels.

Then show the summaries and notes you will write (step 5) and ask the user to approve or edit them, unless they said approving the labels is enough.

## 5. Write the annotation

1. **New labels:** append each approved new label to `src/analysis/cases/labels.json` as `{ "id", "kind", "appliesTo", "name", "rule", "example" }`, keeping the file valid JSON with 2-space indentation.
2. **The annotation:** write `<output>/annotations/<id>.json` (default `output/annotations/<id>.json`):

```json
{
  "key": "<case.json key>",
  "hashes": {
    "base": "<case.json hashes.base>",
    "left": "<case.json hashes.left>",
    "right": "<case.json hashes.right>",
    "merge": "<case.json hashes.merge>",
    "tools": { "<focus tool>": "<case.json hashes.tools[tool]>" }
  },
  "summary": { "left": "…", "right": "…", "merge": "…" },
  "tools": {
    "<focus tool>": { "labels": ["<behaviour label id>"], "note": "…" }
  },
  "groups": {
    "<group id>": { "label": "<outcome label id>", "note": "…" }
  },
  "annotator": "<your model id>",
  "date": "<YYYY-MM-DD>",
  "reviewed": true
}
```

Copy `key` and `hashes` exactly from `case.json`. Include every tool in `focus` and every group in `groups`, and only those. Summaries are one factual sentence each, describing code rather than intentions. Tool notes are one or two sentences on what the tool did, citing the code involved. Group notes explain the outcome in one or two sentences.

3. **Validate:** run `npm run --silent dev -- analysis check <alias>`, fix any error it reports, and run it again until it succeeds. If the user has the dashboard open (`npm run dev -- dashboard serve <alias>`), the case shows up when they refresh or switch back to the page.

## 6. Next case

Report what was written (labels used and new labels added), then ask whether to continue with the next case of the same group, switch group, or stop.

## Changing labels

When the user asks to rename, merge, split, reword or remove a label:

1. Find the annotations that use it: `grep -l '"<label id>"' <output>/annotations/*.json`. Behaviour labels appear in `tools.*.labels`, outcome labels in `groups.*.label`.
2. Show the user the change and the affected cases, and apply it only after approval: update `labels.json`, then update the affected annotations, going through each affected case with the user for a split.
3. Run `analysis check` until it succeeds.
