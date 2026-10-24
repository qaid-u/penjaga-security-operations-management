# User acceptance study — Pending Data Collection

Research question: Does the 3D Command Centre help authorized users locate and understand operational information more effectively than PENJAGA's conventional interface?

Use only `penjaga_phase5_demo`, synthetic accounts and the same fixed dataset for both interfaces. The main entrance/left wing mappings are deliberately fictional demonstration relationships. Do not recruit participants into the operational database. Obtain informed consent and follow the university's applicable ethics requirements. Use participant codes P01, P02, etc.; keep consent/contact records separately, outside this repository.

## Design

A = existing tables in PENJAGA. B = 3D Command Centre. Use the same chief-guard role throughout each participant's session. Allocate odd participant codes to AB and even codes to BA. Use equivalent task sets X and Y: first interface uses X, second uses Y; reverse the target allocation for half of each order group if participant numbers permit. Record allocation before starting. This reduces order and memorization effects without claiming to eliminate them.

Provide a common two-minute orientation and one unrelated practice task for each interface. Avoid coaching during timed trials. Use the same device, browser, network, date range and initial screen for paired trials. Record interruptions separately; predefine exclusion rules and retain an explanation for every excluded trial.

| Task | Prompt | X target / answer key | Y target / answer key |
| --- | --- | --- | --- |
| T1 | Locate the named synthetic post and identify its schematic building zone | DEMO Pos A / Pintu Masuk Utama | DEMO Pos B / Sayap Kiri |
| T2 | Find the assigned guard and shift for the specified post/day | Pos B, 2026-10-24 / Demo guard_b, 07:00–16:00 | Pos A, night starting 2026-10-23 / Demo guard_a, 23:00–08:00 next day |
| T3 | Find the specified historical report and its latest stored classification | DEMO Laporan 1 / High | DEMO Laporan 3 / High |
| T4 | Identify the official action status related to the specified report | Report 1 / Dalam Tindakan | Report 3 / Selesai |

For A, expose the reviewed synthetic mapping answer key as a reference sheet, since its existing post table stores no architectural zone. Record this assistance consistently; T1 compares the complete workflows, not identical screen content. T2's overnight variant differs in complexity: counterbalance it, report task-set results separately, and avoid attributing all differences to interface type.

Start timing when the prompt is revealed and the agreed initial screen is ready. Stop on the final submitted answer. Cap each trial at 180 seconds; record capped/abandoned trials as completed=0, with their observed/capped time. Accuracy=1 only if the answer matches the answer key; completion and accuracy are separate outcomes. A wrong completed answer is completed=1, accuracy=0. Count navigation errors using a predefined rubric (wrong module/post/report or a reset caused by losing orientation). Count meaningful clicks/taps/keyboard activations consistently; do not count individual typed characters or continuous drag frames.

Record task completion, time, accuracy, errors and interactions in the empty CSV template. Conduct a short questionnaire after each interface and an optional interview after both. Aim for a feasible convenience sample agreed with the supervisor; report recruitment, sample size and prior experience honestly. No minimum sample size or statistical power is claimed here.

Human trials have **not been conducted**. Automated browser tests are technical verification and do not answer the comparative research question.
