autowatch = 1;
inlets = 1;
outlets = 2;

var pollTask = null;
var lastLocatorSignature = "";
var lastTransportSignature = "";

function numberValue(value, fallback) {
  if (value instanceof Array) value = value[0];
  var number = Number(value);
  return isFinite(number) ? number : fallback;
}

function stringValue(value, fallback) {
  if (value instanceof Array) value = value.join(" ");
  if (value === undefined || value === null) return fallback;
  var text = String(value);
  return text.length ? text : fallback;
}

function readLiveSet() {
  var set = new LiveAPI(null, "live_set");
  var bpm = numberValue(set.get("tempo"), 120);
  var beatsPerBar = Math.max(1, Math.min(12, Math.round(numberValue(set.get("signature_numerator"), 4))));
  var currentBeat = Math.max(0, numberValue(set.get("current_song_time"), 0));
  var playing = numberValue(set.get("is_playing"), 0) !== 0;
  var locators = [];
  var count = 0;

  try {
    count = set.getcount("cue_points");
  } catch (error) {
    outlet(1, "error", "Could not read Ableton locators: " + error);
  }

  for (var index = 0; index < count; index++) {
    try {
      var locator = new LiveAPI(null, "live_set cue_points " + index);
      locators.push({
        id: String(locator.id || ("cue-" + index)),
        name: stringValue(locator.get("name"), "Locator " + (index + 1)),
        beat: Math.max(0, numberValue(locator.get("time"), 0))
      });
    } catch (error) {
      outlet(1, "error", "Could not read locator " + index + ": " + error);
    }
  }

  locators.sort(function(a, b) { return a.beat - b.beat; });
  return {
    setId: String(set.id || "live-set"),
    setName: "Ableton Live",
    bpm: bpm,
    beatsPerBar: beatsPerBar,
    currentBeat: currentBeat,
    playing: playing,
    locators: locators
  };
}

function emit(selector, payload) {
  outlet(0, selector, encodeURIComponent(JSON.stringify(payload)));
}

function poll() {
  try {
    var snapshot = readLiveSet();
    var locatorSignature = JSON.stringify([
      snapshot.setId,
      snapshot.bpm,
      snapshot.beatsPerBar,
      snapshot.locators
    ]);
    if (locatorSignature !== lastLocatorSignature) {
      lastLocatorSignature = locatorSignature;
      emit("lumarig_snapshot", snapshot);
    }

    var transportSignature = [
      snapshot.playing ? 1 : 0,
      snapshot.currentBeat.toFixed(4),
      snapshot.bpm.toFixed(3),
      snapshot.beatsPerBar
    ].join(":");
    if (transportSignature !== lastTransportSignature) {
      lastTransportSignature = transportSignature;
      emit("lumarig_transport", {
        playing: snapshot.playing,
        currentBeat: snapshot.currentBeat,
        bpm: snapshot.bpm,
        beatsPerBar: snapshot.beatsPerBar
      });
    }
  } catch (error) {
    outlet(1, "error", "LumaRig LiveAPI poll failed: " + error);
  }
}

function start() {
  stop();
  lastLocatorSignature = "";
  lastTransportSignature = "";
  poll();
  pollTask = new Task(poll, this);
  pollTask.interval = 50;
  pollTask.repeat();
  outlet(1, "status", "LiveAPI polling started");
}

function stop() {
  if (pollTask) {
    pollTask.cancel();
    pollTask = null;
  }
}

function refresh() {
  lastLocatorSignature = "";
  lastTransportSignature = "";
  poll();
}

function loadbang() {
  start();
}
