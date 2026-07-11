# dbml-rs: superlinear parse time on medium-sized schemas

Draft report for an upstream issue against `dbml-rs` 1.0 (pest-based).
**Not submitted** — pending maintainer approval.

## Summary

`dbml_rs::parse_dbml` shows roughly quadratic scaling with schema size.
Parsing a synthetic but idiomatic schema (N tables × 6 columns, N−1 refs):

| Tables | Parse (median, ms) | Payload (KB, serialized IR) |
|-------:|-------------------:|----------------------------:|
| 100    | 8.4                | 137                         |
| 300    | 59.2               | 413                         |
| 600    | 222.7              | 829                         |
| 1000   | 597.1              | 1388                        |

~7× more input → ~70× more time. Measured on an Apple-silicon Mac,
`--release`, median of 15 runs after 3 warmups.

## Reproduction

Generator: `bench/gen.ts` (`genDbml(n)`) in this repo produces the input —
each table is:

```dbml
Table t_<i> {
  id integer [pk, increment]
  name varchar(100) [not null]
  status varchar(20)
  amount decimal(10,2)
  parent_id integer
  created_at timestamp
}
```

plus `Ref: t_<i>.parent_id > t_<i-1>.id` per table.

Harness (times preprocess + `dbml_rs::parse_dbml` + IR conversion; the parse
dominates):

```rust
let input = std::fs::read_to_string(path)?;
let t0 = std::time::Instant::now();
let ast = dbml_rs::parse_dbml(&input)?;
println!("{} ms", t0.elapsed().as_millis());
```

## Suspected cause

pest grammar backtracking across top-level definitions: time per table grows
linearly with the number of *preceding* tables, which points at re-scanning
of the remaining input per top-level rule rather than at any single rule
being slow.

## Impact

Live-preview editors re-parse on edit; at 600+ tables the parse latency
(220–600 ms) dominates the preview loop even when parsing is off-thread.
