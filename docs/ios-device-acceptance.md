# iPhone 16 Pro Max acceptance record

Use this record for the final physical-device gate. Do not mark a row as passed
from a Simulator result. Keep completed records with the group project notes;
the app itself does not upload this information.

## Build and device metadata

| Field | Result |
| --- | --- |
| Test date | |
| Git commit | |
| Tester | |
| iPhone model | iPhone 16 Pro Max |
| Installed iOS build | 27.0 beta 6 |
| Xcode build | |
| Apple Team type | Personal Team / paid team |
| Bundle identifier | `com.dhebhxh.speakspacelocalmobile` or replacement |

Install the standalone build with the project command. Expo documents
`--configuration Release` as its local production configuration; this project
also passes `--no-bundler` so the test cannot accidentally depend on Metro.

```bash
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
  npm run ios:device:release
```

Copy the `.app` path printed by Expo and validate the signed bundle:

```bash
npm run verify:ios-release -- \
  /absolute/path/to/speakspacelocalmobile.app --require-signed
```

| Release gate | Pass/fail | Evidence or notes |
| --- | --- | --- |
| Installation succeeds with the selected team | | |
| App launches after the Mac and Metro are disconnected | | |
| Automated signed-bundle verifier passes | | |
| Microphone permission prompt is understandable | | |
| Force-quit and reopen preserves local notes and audio | | |

## Model and storage gates

| Gate | Pass/fail | Evidence or notes |
| --- | --- | --- |
| Whisper Small Multilingual F16 downloads over Wi-Fi | | |
| A cancelled/failed download can be restarted | | |
| Cellular download works without an additional confirmation dialog | | |
| Whisper activates and remains active after relaunch | | |
| Qwen 2.5 1.5B Q4_K_M downloads and activates | | |
| Qwen completes ten consecutive note questions without memory termination | | |
| Low-storage preflight explains the shortage and deletes nothing | | |
| Piper Huayan downloads, activates, and remains active after relaunch | | |

If Qwen is terminated by iOS memory pressure, record the exact model, prompt,
available device storage, and the last visible app state. Do not enable the
Extended Virtual Addressing or Increased Memory Limit entitlements on a free
Personal Team as a workaround; choose a smaller model or reduce context only
after the failure is reproduced and documented.

## Audio import matrix

Use real files rather than renamed extensions.

| Format | Duration | Size | Imported | Transcribed | Saved after relaunch | Notes |
| --- | ---: | ---: | --- | --- | --- | --- |
| WAV | | | | | | |
| MP3 | | | | | | |
| M4A | | | | | | |
| AAC | | | | | | |
| FLAC | | | | | | |

Also verify these rejection cases:

| Rejection gate | Pass/fail | Evidence or notes |
| --- | --- | --- |
| Unsupported extension is rejected before transcription | | |
| File larger than 2 GB is rejected | | |
| Audio longer than two hours is rejected and temporary output is removed | | |

## Mandarin quality gate

Use one natural 1–2 minute Mandarin recording with ten independently
checkable facts. Test the same content through live recording and file import.
Do not use the expected text as an inference prompt.

| # | Expected fact | Live transcript | Import transcript | Live correct | Import correct |
| ---: | --- | --- | --- | --- | --- |
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |

| Quality gate | Pass/fail | Evidence or notes |
| --- | --- | --- |
| Live recording gets at least 8/10 facts correct | | |
| File import gets at least 8/10 facts correct | | |
| Neither transcript fabricates a key fact | | |
| Neither path crashes, freezes, or remains busy | | |

## Lifecycle and interruption gates

| Gate | Pass/fail | Evidence or notes |
| --- | --- | --- |
| Leaving the foreground pauses and preserves the session | | |
| Locking the phone pauses and preserves the session | | |
| Returning to the app does not resume automatically | | |
| Manual resume continues the preserved session | | |
| Phone call/audio interruption pauses and explains the state | | |
| Five-minute remaining warning appears | | |
| Two-hour limit automatically finishes the recording | | |
| Screen remains awake while active foreground recording runs | | |

## v1.2.0 targeted regression supplement

This supplement records the 2026-08-24 regression work for the Ask AI,
Structured Note, and editor-modal fixes. It does not mark the unfilled audio,
long-recording, or external SideStore rows above as passed.

| Field | Result |
| --- | --- |
| Test date | 2026-08-24 |
| App version | `1.2.0 (3)` |
| Device | iPhone 16 Pro Max, iOS 27.0 |
| Bundle identifier | `com.dhebhxh.speakspacelocalmobile` |
| Install method | Xcode-signed Release, same-bundle-ID overwrite |
| Test data | 3 fresh local notes; Chinese grounding, ordinary English prose, dense English intents |

| Targeted gate | Result | Evidence or notes |
| --- | --- | --- |
| Ask AI answers supported Chinese responsibility and date questions | PASS | Direct transcript evidence and bilingual automated regression; the device samples remain available for manual acceptance |
| Ask AI rejects unsupported questions without inventing facts | PASS | Negative and cross-subject automated cases |
| Ask AI waiting state and conversation restore | PASS | Queued/generating UI and SQLite repository/service tests |
| Structured Note ordinary and multi-intent inputs | PASS | 2 true-device tests in the ordinary/multi result bundle |
| Structured Note dense output recovery | PASS | 1 true-device dense-input test; output-limit and recursive recovery unit coverage |
| Structured Note cleanup and semantic filtering | PASS | 1 true-device cleanup test; completed/negated/noise filtering unit coverage |
| Move note and all blocking editor modals respect the iOS safe area | PASS | Shared `SafeAreaModal`, modal inventory regression test, physical-device layout check |
| Signed Release verifier and strict code-sign verification | PASS | iPhone-only, arm64, minimum iOS 16.4, embedded JS bundle, valid signature |
| Overwrite install preserves local model and notes | PASS | Device still contains Qwen model and exactly 3 fresh test notes |
| App launches without Metro and remains running | PASS | `devicectl` launch and process-list confirmation |
| Copied SQLite database integrity | PASS | `PRAGMA integrity_check` returned `ok` |

Local `.xcresult` bundles are intentionally not committed. The release record
and reproducible source/test commands remain in the repository.

## Final decision

The iPhone migration passes only when every required row above passes, both
Mandarin paths meet the 8/10 threshold without a fabricated key fact, and no
unresolved crash or iOS memory termination remains.

- Final result: **PASS / FAIL**
- Blocking issue IDs or notes:
- Tester signature/date:

Sources:

- Expo CLI local Release build: <https://docs.expo.dev/more/expo-cli/#develop>
- Expo SDK 57 iOS configuration: <https://docs.expo.dev/versions/v57.0.0/config/app/>
- Apple iOS capability availability: <https://developer.apple.com/help/account/reference/supported-capabilities-ios/>
