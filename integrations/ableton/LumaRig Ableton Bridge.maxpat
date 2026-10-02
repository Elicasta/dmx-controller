{
  "patcher": {
    "fileversion": 1,
    "appversion": { "major": 9, "minor": 0, "revision": 0, "architecture": "x64", "modernui": 1 },
    "classnamespace": "box",
    "rect": [80.0, 80.0, 760.0, 340.0],
    "openinpresentation": 1,
    "boxes": [
      { "box": { "id": "title", "maxclass": "comment", "text": "LumaRig Ableton Bridge", "presentation": 1, "presentation_rect": [16.0, 12.0, 220.0, 22.0], "patching_rect": [22.0, 20.0, 220.0, 22.0] } },
      { "box": { "id": "help", "maxclass": "comment", "text": "Mirrors Arrangement locators + transport to LumaRig. LumaRig keeps DMX authority.", "presentation": 1, "presentation_rect": [16.0, 38.0, 480.0, 22.0], "patching_rect": [22.0, 48.0, 520.0, 22.0] } },
      { "box": { "id": "liveapi", "maxclass": "newobj", "text": "js lumarig-live-api.js", "patching_rect": [22.0, 98.0, 170.0, 22.0] } },
      { "box": { "id": "bridge", "maxclass": "newobj", "text": "node.script lumarig-bridge-node.js @autostart 1", "patching_rect": [230.0, 98.0, 310.0, 22.0] } },
      { "box": { "id": "print", "maxclass": "newobj", "text": "print LumaRig-Ableton", "patching_rect": [230.0, 150.0, 170.0, 22.0] } },
      { "box": { "id": "refresh", "maxclass": "message", "text": "refresh", "presentation": 1, "presentation_rect": [16.0, 72.0, 70.0, 22.0], "patching_rect": [22.0, 150.0, 70.0, 22.0] } },
      { "box": { "id": "connect", "maxclass": "message", "text": "connect", "presentation": 1, "presentation_rect": [94.0, 72.0, 70.0, 22.0], "patching_rect": [420.0, 150.0, 70.0, 22.0] } }
    ],
    "lines": [
      { "patchline": { "source": ["liveapi", 0], "destination": ["bridge", 0] } },
      { "patchline": { "source": ["liveapi", 1], "destination": ["print", 0] } },
      { "patchline": { "source": ["bridge", 0], "destination": ["print", 0] } },
      { "patchline": { "source": ["refresh", 0], "destination": ["liveapi", 0] } },
      { "patchline": { "source": ["connect", 0], "destination": ["bridge", 0] } }
    ]
  }
}
