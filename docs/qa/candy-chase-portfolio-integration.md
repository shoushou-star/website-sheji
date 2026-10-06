# CANDY CHASE portfolio integration QA

Date: 2026-10-06. Worktree: `D:\05 ai作品集\00 zuopinji - shejishi\.worktrees\candy-chase-portfolio`.
Integration BASE: `c958c4a894c47bbcb13cfc264828c6e82abad187`.
Final browser status: passed (exit 0), 2026-10-06 13:40:17.912–13:42:24.540 UTC (21:40:17.912–21:42:24.540 Asia/Shanghai). Confidence: high for local publish/browser checks; speaker listening is unverified.

## Source provenance and immutability

- Source chat: `01a10cf9-1f76-78f2-8470-07f5998cd7c2`, title “游戏中T台 (2)”. Latest retrieved turn was completed; current thread status returned `notLoaded`. Its final report records a successful build, 227 frontend tests, 59 game tests, and development/production browser checks. Those source tests were not rerun or rebuilt here.
- Source project: `C:\Users\25283\.codex\worktrees\game-flow-integration\游戏操作文件`; exact input is its `dist` directory.
- Source HEAD: `02a68ed332d356288b7bc5be3689158d0979c8ee`. This is a dirty worktree with 19 tracked modified paths and 6 untracked status entries. The build cannot be identified by HEAD alone; it is identified by the distribution hashes below. Existing source modifications were preserved.
- Independently rehashed all 316 paths in Task 1's before snapshot: 0 changed or missing paths. This covers the 119 distribution files, source `src`, `rhythm-game`, `scripts`, and recorded project root files. No source writes occurred.
- Source distribution: 119 files, 149,978,388 bytes. Canonical manifest SHA-256: `F0DB15E529EA5982F44AD427CBFDBC4C7F626CDE3DE740BC4DF82519A8EDED0C`. Canonical input is the source dist entries sorted by `Path`, UTF-8 lines `Path Length lowercaseSHA256`, with LF and a final LF. The path includes the `dist/` prefix.

| Source file | SHA-256 |
| --- | --- |
| `dist/index.html` | `C2F578D57F763D2B1F968F3AA85D70D7FE9BBCC8A9AE976631EEB591057691A3` |
| `dist/assets/app-bNz7AKC-.js` | `5A39F45F43E4532C8DF48A9207AC5E3AE5E512C0612BCF39F560F330DBC002B9` |
| `dist/rhythm-game/index.html` | `5F5BA5CEF4CC1F55CE76747C22E27C825B57853D7539A405ABEDA03775E56FA6` |
| `dist/assets/loading-background-C0UEPHti.png` | `21E8968C954640A1B333D74232F77540E2572B2A36E5E5D296A1305FB682297D` |
| `dist/assets/loading-loop-B-kAU6Zz.mp4` | `D1238D6DADD08DF847EB590775FB0A31D21F9A2D05969C9F066B70C105B1B533` |

Task 1's two full source snapshots have SHA-256 `2A0FAB7C64F4ED251C0B520E36864CA9D19BBECD975815F2A86D422F2286F5ED`. Copied text has the required URL rebasing; the copied runtime therefore has 149,987,910 bytes. Preview image/video bytes match their source hashes.

## Commands and publication closure

All commands ran in this worktree through the approved escalated shell. Git used explicit `safe.directory`; no persistent Git identity or configuration was changed. Test/browser temporary directories were redirected into the existing worktree `tmp` directory. No dependencies were installed and no files were deleted.

```powershell
$env:TEMP=(Resolve-Path 'tmp').Path
$env:TMP=$env:TEMP
node --test tests/sync-candy-chase.test.cjs tests/candy-chase-publish.test.cjs
node prepare-netlify.cjs
$env:NODE_PATH='C:\Users\25283\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node .superpowers/sdd/2026-10-06-candy-chase-portfolio-integration/task-5-server.cjs
node scripts/candy-chase-browser-qa.cjs --base-url http://127.0.0.1:4174 --artifact-dir .superpowers/sdd/2026-10-06-candy-chase-portfolio-integration/task-5-evidence
node --check candy-chase-feature.js
node --check candy-chase-case.js
node --check scripts/sync-candy-chase.cjs
node --check prepare-netlify.cjs
node --check scripts/candy-chase-browser-qa.cjs
node --check tests/candy-chase-publish.test.cjs
git -c safe.directory='D:/05 ai作品集/00 zuopinji - shejishi/.worktrees/candy-chase-portfolio' diff --check
```

The local HTTP harness serves `tmp/netlify-publish-0904` with media MIME types and byte ranges. Thus browser evidence tests the copied publish output, not the source game directory. The ignored harness and raw evidence remain local and are not included in the deployment allowlist.

Fresh unit result: 11 passed, 0 failed, 0 skipped. Publish result: 175 allowlisted regular files, 243,460,174 bytes; 119 are game runtime files. All six syntax checks and `git diff --check` passed; Git emitted only LF-to-CRLF notices.

`prepare-netlify.cjs` now refuses unexpected output entries before copying and checks exact output membership afterwards. The existing isolated publish fixture adds `stale-private-note.txt` after a valid build, requires a non-zero next build, and verifies that the file is preserved. Before the fix this assertion failed with “Missing expected exception” (1 pass / 1 fail); after the fix the full suite passes. No cleanup or deletion is used to obtain a clean result.

## Browser scope and viewport evidence

Browser: installed Edge, headless, channel `msedge`; final observed version `154.0.4258.53`. No autoplay-policy bypass flags are used. All Task 2/3 assertions remain in the script.

| Viewport/scenario | Evidence |
| --- | --- |
| Desktop 1440×900 | Homepage feature click opens the approved case URL; complete real game flow; 16:9 iframe; approved case text, readiness, introduction navigation, return route and no horizontal overflow. |
| Desktop 1366×768 | Case copy, 16:9 iframe, actual game HTTP 200, visible game root, readiness, introduction scroll, return route and no overflow. |
| Mobile 390×844 with touch | Exact “建议使用电脑体验完整游戏” message; iframe has no `src`; zero game/game-asset requests; no overflow. Homepage cover/ordinary projects remain usable. |
| Reduced motion 1440×900 | Cover visible; hover/focus does not request preview video; ordinary project modal keyboard flow still works. |
| Desktop hover/focus | Real muted looping preview advances; pointer leave pauses; preference change unloads its source. |
| Controlled hydration | No mount before Framer's verified hydration mark, no bypass through load/explicit calls; repeated marks and remount produce exactly one card. |
| Controlled failure | 11,999 ms remains loading; 12,000 ms exposes retry/return; retry requests the actual game with only the retry query and preserves the shell; loaded iframe survives the timer; injected iframe error exposes fallback. |

The original hero, About Me, four ordinary projects, Enter-to-open, Escape-to-close and focus restoration checks remain enabled. Screenshots cover loading, lobby, PIKO selection/dialog, intro, gameplay, settlement, both desktop case sizes, mobile fallback, desktop preview, reduced motion and mobile homepage. Gameplay/settlement, 1366×768 case, and mobile fallback screenshots were visually inspected: no observed HUD/playfield obstruction, clipped result controls or horizontal overflow.

## Real game/media evidence and observation limits

The script uses real UI clicks from the homepage card through loading → lobby → PIKO → start dialog → intro → rhythm game → settlement. It waits for the intro's natural `ended` event (12.064 seconds), and for the BGM's natural `ended` event (69.218005 seconds). It does not seek media, replace the chart, inject a result message, or dispatch a completion event. A Space/Escape check is performed early in gameplay; the remaining chart is allowed to miss naturally. The real same-origin/current-frame completion reports 80 total/80 judged notes, 0 score, 0 combo, 0 PERFECT/GOOD, 80 MISS and 0 stars. Visible settlement fields are compared to that result.

Before any click the loading media is paused at time 0. Host unmuted `playing` events are recorded only after real user activation. Intro, gameplay BGM and settlement intro advance with `muted=false`, `volume=1` and `paused=false`; settlement loop is muted and advancing. The preloaded rhythm BGM stays at time 0 during intro. These are programmatic playback observations: speaker output, perceived synchronization and audible quality were not listened to or established.

Both iframe focus boundaries point to the actual rhythm game; gameplay Space does not scroll the case page and Space/Escape do not skip the intro. The introduction remains reachable after settlement.

Final BGM samples advanced from 0.528132 to 1.876598 seconds before naturally ending at 69.218005 seconds. After settlement, Retry is clicked and second-run BGM is observed playing. The case realm retains real media/AudioContext references, then dispatches `pagehide` to invoke the production case unload handler: retained media becomes paused at time 0 and the observed game AudioContext becomes `closed`. This lifecycle trigger is controlled; its media and audio-context objects are real. Actual return-link navigation is tested separately afterwards and reaches `http://127.0.0.1:4174/#candy-chase-feature`, with no game iframe and exactly one remaining frame. A callback attempted from the destroyed nested frame during real navigation did not arrive; it was removed in favor of this direct observation. No claim of a physical listening test during actual navigation is made.

Console/page errors, local HTTP errors, and unexpected failed local requests cause non-zero exit. Media `net::ERR_ABORTED` cancellations during screen transitions/unload are recorded separately. Only the exact request deliberately stalled by the fallback test is classified as a controlled local cancellation. The homepage hydration tests intentionally abort the remote Framer site bundles and record their errors separately; they emit the verified hydration mark themselves. The exact remote analytics script `https://events.framer.com/script?v=2` is fulfilled with empty JavaScript in QA because the first run produced seven `ERR_CONNECTION_CLOSED` errors from this existing external dependency. Live Framer hydration and analytics availability are therefore outside this local deterministic acceptance result.

Raw local evidence: `.superpowers/sdd/2026-10-06-candy-chase-portfolio-integration/task-5-evidence/report.json` and 12 PNG screenshots. This task establishes local publish/browser closure, not a Netlify deployment. Perfect/Good/high-score/star outcomes, complete successful rhythm input, real touch devices, non-Edge browsers and actual browser-policy refusal were not newly tested here.

Final diagnostic counts: 0 unexpected console errors, 0 page errors, 0 unexpected failed local requests and 0 local HTTP errors. The report separately records 56 deliberately aborted Framer bundle console messages, 1 canceled controlled stalled-document request, and 20 media `ERR_ABORTED` cancellations across transitions/unloads. These are visible exceptions, not silent suppression of unknown failures.
