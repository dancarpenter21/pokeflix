# Changelog

## 1.2.0

- Add manual picture delay from 0 to 1,000 ms in 25 ms steps for late TV audio.
- Remember sync offsets per audio output and provide a Reset control.
- Forward mouse and keyboard input through delayed playback, capped at 1080p/30 fps.
- Initial TV playback reported good by the user. Existing unit tests pass; Electron integration timed out. Fullscreen adjustment controls and dedicated sync regression coverage remain outstanding.

## 1.1.0

- Fill the monitor during player fullscreen, with black margins and hidden app controls.
- Move app controls into a compact bottom bar with accessible icon buttons and readable text.
- Connect audio automatically when selecting an output or restoring an available saved output at startup.
- Allow numbered video servers (`v1.pkflx.com`, `v2.pkflx.com`, and future numbered hosts) without individual approval.
- Add regression coverage for fullscreen, control layout, automatic audio routing, and video-host restrictions.

## 1.0.2

- Include Google font stylesheets and files in the default resource allowlist.
- Upgrade older saved settings once to restore player icons, preserving later parent removals.
- Add Windows CI to test the policy and build an installer artifact.

## 1.0.1

- Require the parent password to view and change allowed-host settings.
- Enforce host-change authorization in the Electron main process.

## 1.0.0

- Add restricted Pokeflix browsing and dedicated audio output selection.
- Capture muted tab audio without capturing other applications.
