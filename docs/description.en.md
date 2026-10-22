# spine动画预览

## Short description

Play Spine animations with Space in Eagle and automatically generate animated thumbnails. Supports multiple JSON and binary runtime versions and common Unity export suffixes. Windows only.

## Description

Preview exported Spine animations directly in Eagle. Select a skeleton or atlas and press Space to play. After importing complete assets, the background service generates animated thumbnails without requiring a first preview.

**Features**

- Space preview and opening from the plugin menu.
- Animation and skin selection, play/pause, playback speed, looping and timeline scrubbing.
- Mouse-wheel zoom, drag to pan and fit to window.
- Automatic animated thumbnails that preserve existing custom thumbnails.
- Manual thumbnail generation from the current animation; this updates the existing thumbnail.

**Supported data**

Runtime branches: Spine 3.6, 3.7, 3.8, 4.0, 4.1, 4.2 and the currently tested 4.3 beta. Compatibility with other beta updates or future versions is not guaranteed.

Binary skeletons: `.skel`, `.skel.bytes`, and `.bytes` containing Spine skeleton data. Spine JSON: `.json`, `.json.txt`, `.json.bytes`, and `.txt`. Atlases: `.atlas`, `.atlas.txt`, `.atlas.bytes`. ZIP and `.spinezip` bundles are supported for preview; use `.spinezip` for automatic background bundle detection.

Skeletons, atlases and referenced textures must be provided together. This viewer does not play `.spine` editor projects. Ordinary JSON/TXT/BYTES/ZIP files are not Spine animations.

**Getting started**

1. Install the plugin, fully quit Eagle and restart it.
2. Import the skeleton, atlas and referenced textures together, preferably into the same Eagle folder.
3. Select a skeleton or atlas and press Space. Background thumbnails do not require a first preview.

**Requirements and background behavior**

Windows only. Tested with Eagle 4.0.0 build 20260401. Requires an available Eagle local API with `/api/v2/` routes. Earlier builds have not been verified.

The service checks relevant library files about every five seconds and updates thumbnails and dimension metadata. It does not overwrite original skeletons, atlases or textures. Thumbnails loop for up to three seconds at 20 fps, with a maximum dimension of 256 pixels. Incomplete assets are retried; ambiguous duplicates may require organizing the files.

Disabling the plugin stops background work. Generated thumbnails remain. Playback in the library also depends on Eagle's thumbnail playback settings.

**Privacy and dependencies**

Processing stays on this computer. The plugin communicates with Eagle at `127.0.0.1:41595` and does not upload assets to external services. Thumbnail generation uses temporary files, cleaned after completion; the plugin records background status. Bundled Spine Runtimes by Esoteric Software include their licenses and copyright notices. This is an independently developed plugin.

## 1.0.0 Changelog

Initial release: Spine animation preview with Space, multiple runtime branches, JSON/binary data, common Unity suffixes and ZIP bundles; integrated automatic animated thumbnails; animation, skin, speed, timeline and manual thumbnail controls.
