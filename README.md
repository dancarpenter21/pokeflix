# Pokeflix TV

A Windows Electron app for watching Pokeflix on a Miracast TV while other applications use your headphones. Includes restricted browsing, a resource allowlist, and password-protected parent settings.

The app loads `https://www.pokeflix.tv/` at runtime. No episodes or downloaded media are bundled.

## Install and use

Run the Windows installer from a release or build it with the instructions below. Installers are unsigned and install for the current Windows user.

1. Connect the Roku with **Windows + K** and accept the connection on the TV. Use **Extend** in Windows projection settings.
2. Launch Pokeflix TV and move its window onto the TV. Use **Fullscreen** if desired; **Escape** exits.
3. Keep Windows' default audio output on your gaming headphones.
4. Click **Refresh**, choose the TV's explicit audio output, then **Connect audio**. Play an episode.
5. The app remembers the output but starts muted each launch. Click **Connect audio** to enable it.

The app does not establish the Miracast connection itself. If Windows changes its global default while connecting the TV, set it back to your headphones.

### If the TV is missing from audio outputs

While Miracast is connected, check **Windows Settings > System > Sound > Output**. The TV must be exposed as a Windows playback device before this app can route to it. Test the endpoint in Windows to identify it; a generic name such as Digital Output does not by itself establish that it belongs to the TV. Then refresh the app's output list.

## Parent settings

**Default password: `pokeflix.tv`**

Click **Settings**, enter the password, then **Unlock**. Closing settings with **Done**, **Cancel**, **Escape**, or the toolbar's **Settings** button relocks them. Restarting or reloading the app's controls also relocks them. Host additions and removals require authorization in the main process as well as the interface.

This is a simple shared password to deter children using the app. It is documented here and in the source, so it is not protection against someone who can read or change local files. These are app restrictions, not a Windows kiosk or a content filter for material served by approved hosts.

## Browsing and resource hosts

Top-level browsing is restricted to HTTPS `pokeflix.tv` and `www.pokeflix.tv`. Popups, downloads, external protocols, and unapproved network hosts are blocked. No outside browser is launched.

In parent settings, blocked hosts appear as you browse. Approve only exact hosts verified as necessary for the site or embedded video. Resource-host approval never permits top-level browsing to that host. Adding or removing a host reloads the page.

| Default resource host | Purpose |
| --- | --- |
| `ajax.googleapis.com` | Site scripts |
| `cdnjs.cloudflare.com` | Site libraries and styles |
| `cdn.jsdelivr.net` | Player libraries |
| `www.gstatic.com` | Player scripts |
| `fonts.googleapis.com` | Font stylesheets, including player icons |
| `fonts.gstatic.com` | Font files |
| `v2.pkflx.com` | Episode streams |
| `v3.pkflx.com` | Episode streams |

Version 1.0.2 adds the two font hosts to older saved allowlists once, fixing controls that display words or broken glyphs instead of icons. Later parent removals remain respected. Other episodes may need additional exact hosts.

Advertising and analytics hosts remain blocked. A real episode played successfully without allowing `www.blockadsnot.com`, `dnhfi5nn2dt67.cloudfront.net`, `static.cloudflareinsights.com`, `static.pokemon-vortex.com`, `www.googletagmanager.com`, or `imasdk.googleapis.com`.

## Audio behavior

The remote WebContents stays permanently muted. A trusted local renderer captures only that WebContents, including embedded frames and Web Audio, with local echo disabled. A local audio element plays that stream through an explicit `setSinkId` output. Game audio and the system audio mix are not captured.

Device-change notifications stop the output; a 500 ms check also verifies the selected device. Reconnect audio manually after device changes. Windows audio preferences and other applications are not changed, and no audio drivers are installed.

Hardware behavior between physical disconnection and Chromium's notification cannot be guaranteed. Verify the disconnect check below with your TV before relying on audio isolation.

## Develop with nvm-windows

Install [nvm-windows](https://github.com/coreybutler/nvm-windows), then:

```powershell
nvm install 24.22.1
.\project.cmd install
.\project.cmd test
.\project.cmd test:integration
.\project.cmd start
.\project.cmd package
```

The runtime is pinned in `.nvmrc` and `package.json`. The wrapper uses this runtime from nvm's directory and changes PATH only for its own process. It does not switch the shared nvm symlink used by other projects. For interactive work, `nvm use 24.22.1` is also supported; nvm-windows may request administrator approval for that shared link.

All npm tools are project-local. Dependencies are locked in `package-lock.json`. Generated installers are under `dist/`. Runtime settings are stored in Electron's user-data directory under `Pokeflix TV`, outside the repository.

### Tests and GitHub builds

- `npm test` checks navigation policy, resource hosts, font migration, and output-device selection.
- `npm run test:integration` checks the Electron app against local fixtures, including password enforcement, muted-source audio capture, device-change teardown, and blocked navigation. It requires Windows with an available playback device and never contacts the live site.
- The Windows GitHub Actions workflow installs dependencies, runs unit tests, builds the installer, and uploads it as a workflow artifact. Integration and TV tests run locally because hosted runners may have no playback device.

The repository excludes dependencies, installers, scratch captures, logs, and environment files. Only source, documentation, and build configuration belong in Git; attach installers to GitHub Releases when publishing a release.

## Hardware acceptance checks

- Play a real episode with the TV selected and a game playing through headphones; verify the two outputs separately.
- Change Windows' default output during playback. TV sound should remain on the explicit endpoint; the app may stop conservatively on any device-change event.
- Disconnect and reconnect Miracast during playback. Verify silence rather than headphone fallback; select the reconnected TV and connect audio again.
- Test episode changes, seeking, embedded players, fullscreen, reload, and restart with the TV absent.
- Confirm player icons render and outside links, popups, unapproved frames, and downloads stay blocked.

Synthetic tests and muted live video playback have been verified during development. Actual Roku sound, latency, default-output changes, and physical reconnect behavior require testing with the connected TV.
