# Filming

Flashback records gameplay for later playback, camera editing and video export. Flashback NeoForge Fixed supplies the Connector, Create and Sable replay adaptations. CMDCam provides camera control during live gameplay. All four additions, including CMDCam's CreativeCore dependency, install on clients only; a dedicated server does not need them.

Recording is manual. In a world, open the pause menu and use Flashback's recording controls. Finish the recording there, or disconnect to finish it automatically. Quicksave is on: finishing saves with default values instead of opening the Save Replay screen. It does not automatically begin recording. Open the saved replay through Flashback's main-menu entry, make camera keyframes in its editor, then export. Initial export preferences are 1920 × 1080 at 30 frames per second, H.264/MP4 with game audio and no supersampling. Export preferences remain editable. Voice-chat recording is off.

Move the replay camera away from the recorded player before composing a shot, and add camera keyframes for the exported movement. The initial replay view can overlap the recorded player's model. On Apple Silicon, choose an encoder Flashback actually lists; the qualified native H.264 encoder is `h264_videotoolbox`.

For a clean Euphoria recording, disable **Display shader in-game messages** in Euphoria Patcher's configuration (`display.doDisplayShaderInGameMessage` in `config/euphoria_patcher/settings.toml`). Its shader update banner can remain visible when the ordinary HUD is hidden. This is a personal presentation choice; the pack retains the existing notification default.

Rendering a replay can take longer than the footage's running time. Record short takes in already generated areas, preview at modest settings and export at the final shader quality separately from heavy server generation. The initial local-player recording rate is 20 updates per second; raise it only when a shot needs smoother recorded local motion and the host has headroom.

For a separate editing installation, use [Replay Studio](../../tools/replay-studio/README.md). It keeps the pack's content and shaders while excluding optional optimization mods that can suppress or change export rendering. Copy replay ZIPs together with their editor states to preserve camera work. Existing world loading is expected from the retained content but has not been natively qualified in this snapshot; use world copies.

Disable Dynamic FPS before exporting in the ordinary playable pack, particularly when leaving Minecraft in the background. Its installed NeoForge build can skip export draws after Flashback clears the capture target, producing black encoded frames. Replay Studio excludes it. **Dummy Render Frames** renders extra frames before every saved frame: eight means nine scene renders per saved frame, rather than eight warm-up frames only at cuts. Start at zero and test a short range before raising it for temporal shader effects. AAC avoids the installed audio writer's incompatible Opus sample format.

## Live camera paths

New defaults provide the camera controls below. **Mod** means the native primary modifier: Command on macOS, Control on Windows/Linux. Function keys may need Fn. Existing installations retain their saved assignments; review **Options → Controls → CMDCam** after an update. Its client configuration loads on world entry; that is not evidence it resets saved keybindings.

| Action | Default |
| --- | --- |
| Moves orbit / custom camera / editor | U (custom camera active) / Mod+U / Shift+U |
| Roll left / right / reset | Mod+Left / Mod+Right / Mod+Down |
| Zoom in / out / reset | Mod+= / Mod+− / Mod+Up |
| Add path point | Mod+Enter |
| Play or stop path | F10 |
| Clear path points | Mod+Backspace |
| Flashback markers 1–4 | Mod+Home / Mod+End / Mod+Page Up / Mod+Page Down |

Clear points deliberately: that shortcut clears the current path. Exit Moves orbit/custom camera before starting a CMDCam path; automatic handoff is not established. Flashback recording still starts and finishes through its native pause-menu controls. Home/End/Page keys may live on Fn+arrows on a compact keyboard; rebind through Controls if the hardware or OS captures them.

Create a basic path:

1. Run `/cam clear` to clear the current camera path.
2. Move to the first viewpoint, aim the camera and run `/cam add`.
3. Move to another viewpoint and run `/cam add` again. Add further points as needed.
4. Run `/cam start 10s` to play the path. Run `/cam stop` to stop it.
5. Save a reusable path with `/cam save <name>` and restore it with `/cam load <name>`.

The initial mode is `outside`, so the player remains available as the actor while the camera follows its path. Use `/cam mode default` for the other native mode. `/cam target` controls where the camera looks; `/cam follow` controls what it follows. Start with ordinary world positions before testing tracking aboard moving ships.

Flashback's replay editor has its own camera paths. Camera-path interchange and simultaneous control by Flashback and CMDCam are not established; give one controller ownership of each shot. CMDCam alone does not export video.

## Project files and compatibility

Personal preferences live in `config/flashback/flashback.json` and `config/cmdcam-client.json`. They are seeded on first installation and retained during updates. Recording files, editor state, camera scenes, exports and DH databases belong to the installation; keep them out of pack overrides and Git. Preserve the exact mods, resource selections and applicable DH cache with a filming project. Flashback's DH integration references existing local databases rather than packaging all distant scenery into the replay.

The upstream Sable adapter targets ship recording, reconstruction, passengers and seeking. This does not establish complete support for every moving contraption, archived SSRD ship, modded interaction or player animation. Flashback's 1.21.1 line also removed its dedicated Iris first-person hand integration. Check hands, transparent items and shader effects before committing a shot. The current verification scope belongs to the [maintenance guide](../development/patches.md#filming-tools).

Motion Capture, Lumiera, BBS, Punchy! Studio, additional posers and dynamic studio lighting are not installed.
