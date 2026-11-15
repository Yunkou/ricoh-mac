# Release workflow time and improvements

This document explains why publishing the macOS app archive from GitHub Actions takes too long, and the workflow changes made in response. The timings below are from completed runs before those changes.

The run under study is [Release run 43707667193](https://github.com/Yunkou/ricoh-mac/actions/runs/43707667193/job/132792154056) for tag v0.2.0 at commit `d6d7e89`. The job queued at 19:10:55 and started at 19:11:00 (Asia/Shanghai). It finished at 19:31:53. Wall-clock time was 20 minutes 53 seconds. The queue wait was about 5 seconds and is not the bottleneck.

[CI for the same commit](https://github.com/Yunkou/ricoh-mac/actions/runs/43707648915) started at 19:10:42 and finished at 19:24:44, in 14 minutes 2 seconds. The release job then repeated the same check and test steps before it packaged the app.

## Step timings

The release job ran on `macos-latest` (image `macos-26-arm64`, a standard GitHub-hosted runner). Step times were as follows.

| Step | Duration | Notes |
| --- | --- | --- |
| Checkout, tag check, Rust and NSH install, format | about 18 seconds | Rust toolchain about 10 seconds, NSH 0.5.1 about 2 seconds |
| `make check` (`nsh check`) | 4 minutes 43 seconds | TypeScript check about 2 minutes, Rust debug build about 2 minutes 41 seconds |
| `make test` (`nsh test`) | 5 minutes 52 seconds | Building the headless debug runner took about 3 minutes 27 seconds. The 71 tests themselves took about 25 seconds. |
| `make clippy` | 3 seconds | Reused the earlier debug build |
| `make dist` (`nsh package --target macos` and the zip) | 9 minutes 38 seconds | Building the release runner for macOS took 9 minutes 33 seconds. The zip took about 4 seconds. |
| Create the GitHub Release and upload assets | 6 seconds | |

The three compile-heavy steps add up to about 20 minutes 13 seconds, which is almost the whole job. Toolchain install, queue time, and publishing are not the problem.

`nsh package` compiles the NSH host and the app in the release profile. It cannot reuse the debug artifacts from `nsh check` and `nsh test`. The current job therefore performs three separate compiles in sequence: the debug library, the debug headless runner, and the release runner.

## Comparison with other runs

The same workflow does not take a stable amount of time.

| Run | Check | Test | Package | Total |
| --- | --- | --- | --- | --- |
| v0.2.0 release | 4 minutes 43 seconds | 5 minutes 52 seconds | 9 minutes 38 seconds | 20 minutes 53 seconds |
| v0.1.0 release (before the publish step failed) | 4 minutes 11 seconds | 4 minutes 54 seconds | 8 minutes 5 seconds | about 17 minutes 40 seconds |
| Manual rebuild of `81a9efd` | 4 minutes 32 seconds | 5 minutes 3 seconds | 9 minutes 15 seconds | 19 minutes 27 seconds |
| v0.1.1 release | 1 minute 29 seconds | 1 minute 45 seconds | 2 minutes 52 seconds | 6 minutes 27 seconds |
| CI for v0.2.0 (same commit) | 6 minutes 34 seconds | 6 minutes 53 seconds | none | 14 minutes 2 seconds |
| CI for v0.1.1 | 4 minutes 18 seconds | 5 minutes 26 seconds | none | 10 minutes 13 seconds |

v0.1.1 was much faster, but the workflow has no cache, and the crate graph did not shrink to one third of its size. The more likely cause is wide performance variation on standard GitHub macOS runners. 6 minutes 27 seconds is not a reliable baseline. Typical releases are closer to 17 to 21 minutes.

On the M6 Mac mini, with NSH 0.5.1 already installed and crate sources already in the local Cargo registry, the same commit completed `nsh check` in about 52 seconds, `nsh test` in about 1 minute 13 seconds (71 tests passed), and `nsh package --target macos` in about 1 minute 11 seconds. This is not a like-for-like cold start against GitHub, but the same commands are much faster on that machine.

## Recommended changes

The sections below describe the changes in order of benefit and risk. The workflows now add a compile cache and split packaging from the quality gate. Do not turn on fat LTO, or other release-profile options that lengthen compiles, as a way to shorten the workflow.

### 1. Cache Cargo build artifacts

Add [Swatinem/rust-cache](https://github.com/Swatinem/rust-cache) to the CI and Release workflows. Include `Cargo.lock`, the Rust toolchain version, and the NSH version in the cache key. Installing NSH takes only about 2 seconds, so a dedicated NSH toolchain cache is not worth much.

The first run after this change is still a cold start. Later runs, when dependencies have not changed, should bring a release down to about 2 to 4 minutes: check and test are mostly execution time, and the release runner only relinks or compiles incrementally.

Cache size needs care. After check, test, and package on the M6, a combined `target/` is about 8.1 GB. GitHub Actions allows 10 GB of cache per repository. The workflows therefore do not cache a combined `target/`. CI stores only the debug profile under the shared key `ci`, and the packaging job stores only the release profile under `release`. Swatinem/rust-cache drops incremental artifacts and unused crates before saving. CI writes its cache only from `main`, so pull requests do not add extra entries. On the M6, a zstd archive of the release `deps` and `build` directories was about 450 MB, and a sample of debug rlibs compressed by about six times. sccache is not used.

Caching only `~/.cargo/registry` helps much less, because the time is spent compiling, not downloading.

### 2. Stop repeating checks that CI already ran

`make check`, `make test`, and `make clippy` in the release job repeat CI for the same commit and cost about 10 minutes 38 seconds. Split the release workflow into two jobs that can run at the same time:

1. A packaging job that installs the toolchain and runs `make dist`.
2. A quality gate that requires a successful CI run for the same commit. If CI has not finished, wait for it, or run the tests in the release workflow.

Create the GitHub Release and upload the app archive only after both jobs succeed. Cold-start wall-clock time then tracks the slower of packaging and CI, about 10 to 14 minutes, instead of the sum, 21 minutes. If the tag is pushed after CI has already passed, the release job can skip the tests. A cold package-only job is then about 10 minutes, or about 2 to 4 minutes with a warm cache.

Do not publish with no quality gate. The tests can move out of the release job, but the commit still has to have a passing CI run.

### 3. A faster runner, as an option

Standard `macos-latest` is free for public repositories, but its speed varies. Two alternatives exist.

- GitHub larger macOS runners, such as `macos-latest-xlarge` (about a 5-core M2 Pro), require GitHub Team or Enterprise and are billed even for public repositories, at about 0.102 US dollars per minute. They do not by themselves fix repeated tests or the missing cache. Consider them only after caching and the job split are in place.
- The existing M6 Mac mini can be a self-hosted runner. The same commands are much faster there, so a release could finish in a few minutes. That choice needs a separate review of when the machine is on, how secrets are stored, and who maintains the runner. It is not being set up in the next implementation pass.

### 4. Changes that are not worth doing first

- Queue time is negligible.
- Installing Rust and NSH together takes about 12 seconds and is not the bottleneck.
- Changing `fetch-depth` from a full history to a shallow clone would not change the total in a meaningful way.
- Release-profile changes such as fat LTO usually make the slowest step slower. Do not use them to shorten release time.

## Implementation

On 15 November 2026 (Asia/Shanghai) the following were done in the same change:

1. Swatinem/rust-cache was added to CI and to the Release packaging job, with the cache split by profile as described above.
2. Packaging and the quality gate were split into parallel jobs. Publishing waits until packaging has succeeded and the same commit has a passing CI run, or the equivalent checks if CI has not run.

Watch the wall-clock time of two or three releases before deciding whether a different runner is still needed. The M6 Mac mini is not set up as a self-hosted runner.

## Decisions already made

- Swatinem/rust-cache was added and packaging was split from the quality gate at the same time.
- The cache is split by profile and trimmed by rust-cache cleanup, rather than storing a combined `target/` or introducing sccache.
- The release workflow may skip tests when CI for the same commit has already succeeded. It does not publish with no quality gate.
- The M6 Mac mini is not set up as a self-hosted runner.

## Remaining decisions

- After two or three releases, whether a different runner is still needed, based on the observed wall-clock time.
