use serde::{Deserialize, Serialize};

/// The native hop must preserve the semantic fields used by Viz to match patch
/// identity and render non-RGB emitters. These are optional for v1 compatibility.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectFixtureState {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")] pub intensity: Option<f64>, pub color: Option<String>,
    pub pan: Option<f64>, pub tilt: Option<f64>, pub beam_angle: Option<f64>, pub strobe_hz: Option<f64>,
    pub name: Option<String>, pub group: Option<String>,
    pub profile_id: Option<String>, pub mode_id: Option<String>,
    pub manufacturer: Option<String>, pub model: Option<String>, pub category: Option<String>,
    pub capabilities: Option<Vec<String>>, pub universe: Option<u16>, pub address: Option<u16>,
    pub emitters: Option<DirectEmitters>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DirectEmitters {
    pub red: f64, pub green: f64, pub blue: f64, pub white: f64, pub amber: f64, pub uv: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectFixtureFrame {
    pub version: u8, pub show_id: Option<String>, pub sequence: u64,
    pub timestamp: u64, pub fixtures: Vec<DirectFixtureState>,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_hop_preserves_patch_identity_and_emitter_values() {
        let input=serde_json::json!({"version":1,"showId":"service","sequence":3,"timestamp":100,"fixtures":[{
            "id":"wash-a","name":"Wash A","group":"Wash","profileId":"rgbw","modeId":"5ch","universe":2,"address":507,
            "manufacturer":"Test","model":"Wash","category":"par","capabilities":["dimmer","red","white"],
            "intensity":0.5,"color":"#000000","emitters":{"red":0.0,"green":0.0,"blue":0.0,"white":1.0,"amber":0.25,"uv":0.1},
            "pan":12.345,"tilt":23.456,"beamAngle":20.0,"strobeHz":0.0
        }]});
        let frame:DirectFixtureFrame=serde_json::from_value(input.clone()).unwrap();
        assert_eq!(serde_json::to_value(frame).unwrap(),input);
    }
}
