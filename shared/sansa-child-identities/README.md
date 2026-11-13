# SANSA child identity selectors — unpublished candidate

These assets require the coordinated AEON/SANSA child identity candidate. The
published-package examples elsewhere in this repository retain their release
pins. This example does not claim that those released versions support it.

Open `inventory.aeon` in the candidate SANSA source playground. Resolve:

```sansa
$.inventory.items.\item1\.\name1\
```

The returned binding is `$.inventory.items[0].name = "Widget"`. The identity
expression is a non-exact selector; the result path describes the current
structure. Reorder the two items and the same selector finds Widget at
`$.inventory.items[1].name`. A new snapshot does not prove occurrence continuity,
and this example performs no mutation or Semantic Orchestrator operation.

Each identity step selects only the current binding's exposed direct children.
`$.inventory.\name1\` misses; it does not search through `items`. The scope root
is the starting binding, not one of its own children. Rebasing to an occurrence
does not expose that occurrence's outside key/identity as a child alias.

Run this Query:

```sansa
from $.inventory.items.*
select .\name1\
```

There are two candidate records. The second projection is an **empty Binding
Set**, not a null, empty string or absent candidate. Add
`where exists(.\name1\)` before `select` to keep only matching candidates.

`chosen:sansa` carries a selector as a value; the consuming API decides whether
to resolve it. `copy = ~inventory.items[0].name` is a structural clone reference.
Neither `~$.inventory.items.\item1\` nor its `~>` form is admitted.
Identity strings do not become canonical storage/event paths or authorisation.

## Verify with a selected candidate graph

After building/installing the candidate graph, supply the actual file URLs for
Core, the SDK's `sansa` export, and SANSA. They must belong to the same verified
graph; the script does not install packages or guess sibling build locations:

```sh
node verify.mjs "$AEON_CORE_MODULE" "$AEON_SDK_SANSA_MODULE" "$SANSA_MODULE"
```

The script checks concrete values/structural paths before and after reorder,
original binding handles within one snapshot, direct-child misses, two Query
records including an empty projection, the exists filter and rejected identity
references. A missing/unsupported candidate fails explicitly.

The SANSA candidate also supplies [full reorder/subtree workflows](https://github.com/AltoPelago/sansa/blob/feat/child-identity-playground/docs/child-identity-workflows.md)
with four source snapshots and an explicit candidate consumer-graph verifier.
It covers moved/renamed subtrees, activation scope changes and ID reuse. These
remain read-only checks; published example pins and reference semantics are
unchanged.
