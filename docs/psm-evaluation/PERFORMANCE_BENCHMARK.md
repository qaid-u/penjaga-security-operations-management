# Measured performance — 24 October 2026

Raw evidence: `evidence/performance-before.json`, `performance-after.json`, `sql-before.json`, `sql-after.json`. These are actual measurements, not participant results or predicted hardware performance.

Conditions: Windows, Node 24.15.0, Intel i7-12650H (16 logical CPUs), headless Edge Chromium using **SwiftShader software WebGL**, localhost without bandwidth throttling. Desktop 1440×1000 and mobile viewport 390×844 share this workstation; mobile emulation is not a physical phone benchmark. Sequential before/after runs used the same synthetic 240-report database and final dependency set. The baseline temporarily restores the legacy loader/query implementations from commit `0fed3f7` and dynamic shadow updates, then restores current source in `finally`. The common camera invalidation repair is retained in both runs so presets reliably render.

The main-frame counter wraps WebGL clears only when the default framebuffer is bound; offscreen shadow-map passes are excluded. Draw-call counts include both passes. FPS is averaged over the scripted interaction interval, including automation gaps; it is not an instantaneous device specification. The initial exploratory run (`performance-initial.json`) is excluded from the comparison because the earlier drag/counter methodology was unsuitable.

| Metric | Before | After |
| --- | ---: | ---: |
| Desktop route → model ready | 4,321 ms | 3,471 ms |
| Mobile-emulated route → model ready | 2,036 ms | 1,894 ms |
| Desktop orbit main FPS | 9.95 | 13.79 |
| Mobile-emulated orbit main FPS | 10.83 | 19.49 |
| Desktop camera-transition interval FPS | 7.26 | 7.67 |
| Mobile-emulated camera-transition interval FPS | 7.86 | 17.18 |
| Desktop selection → linked data panel | 629 ms | 467 ms |
| Mobile-emulated selection → linked data panel | 1,978 ms | 915 ms |
| Draw calls per orbit main frame | 384 | 192 |
| Additional completed GLB requests across 4 route returns | 4 | 0 |
| JS heap delta after 4 route-return cycles + forced GC | +3.37 MB | +3.31 MB |
| Node GLB parse median, 5 samples | 29.84 ms | 15.38 ms |

Asset identity/size is unchanged: 2,537,652 bytes (about 2.54 MB), 192 meshes, 57,310 triangles and 13 distinct materials. Browser download-to-ready upper bounds are in raw resource timings; they include parsing, React setup, GPU initialization and test synchronization, so they are not presented as isolated browser GLB parse times. Node parse timing is separately labeled. Completed GLB requests can include HTTP cache revalidation; request reduction is not claimed to equal the full asset size in network bytes.

Optimizations: one shared in-flight fetch survives StrictMode remount; a maximum 16 MiB public-byte cache expires five minutes after the last subscriber; parsed scenes and GPU resources remain component-owned/disposed. Fixed model geometry/light bake the shadow map once per scene. No decimation, texture replacement, continuous animation loop or model-source rewrite was performed.

API response medians (7 authenticated sequential samples, synthetic DB):

| Endpoint | Before | After |
| --- | ---: | ---: |
| 3D overview | 29.89 ms | 19.59 ms |
| Selected-location summary | 34.57 ms | 25.77 ms |
| Paginated incident history | 31.80 ms | 31.14 ms |
| Legacy dashboard | 20.61 ms | 56.16 ms |

The dashboard's correctness repair selects the latest NLP result rather than counting all analyses; this run showed higher latency. No API speedup is claimed. The 3D queries remain bounded/paginated with no per-hotspot HTTP requests. The 13 profiled read-query plans use existing mapping/date/latest-NLP/action indexes as appropriate; small tables may legitimately use sequential scans. No speculative index was added. Production data-volume profiling is still required before redesigning aggregation queries.

Targets: the provisional 30 FPS goal was **not met on this software-rendered environment**. Representative physical mid-range GPU/phone testing is **Not Run**, so that hardware goal remains unverified. No recurring unhandled rendering errors occurred in the passing functional suites. Four-cycle JS heap measurements are insufficient to establish long-term absence of leaks; GPU memory and prolonged soak testing are **Not Run**. Load/interaction timings are single-run point estimates with variable scheduling; no statistical significance or broad speed guarantee is claimed.

Reproduce on an idle workstation after preparing the demo DB: `node scripts/benchmark-phase5-baseline.mjs`, then set `PHASE5_BENCHMARK=after` and run `node node_modules/@playwright/test/cli.js test --config playwright.phase5.config.mjs --grep benchmark`. Run the SQL script with the corresponding label. Do not edit source or run other browser suites during measurement; the baseline script temporarily swaps only its measured files and restores their bytes afterward.
