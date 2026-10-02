use std::{fs::{self, OpenOptions}, io::Write, path::PathBuf, sync::atomic::{AtomicU64, Ordering}, time::{SystemTime, UNIX_EPOCH}};
use tauri::Manager;
static NEXT_JOB: AtomicU64 = AtomicU64::new(0);
fn valid_job(id: &str) -> bool { !id.is_empty() && id.len() <= 80 && id.bytes().all(|c| c.is_ascii_digit() || c == b'-') }
fn safe_name(name: &str) -> String {
    let value: String = name.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' }).take(80).collect();
    let value = value.trim_matches('-'); if value.is_empty() { "LumaRig-clip".into() } else { value.into() }
}
fn trim_range(start_ms: f64, end_ms: f64) -> Result<(String, String), String> {
    if !start_ms.is_finite() || !end_ms.is_finite() || start_ms < 0.0 || end_ms <= start_ms || end_ms > 86_400_000.0 { return Err("Invalid video trim range.".into()); }
    Ok((format!("{:.6}", start_ms / 1000.0), format!("{:.6}", (end_ms - start_ms) / 1000.0)))
}
fn job_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    if !valid_job(id) { return Err("Invalid video export job.".into()); }
    Ok(app.path().app_cache_dir().map_err(|e|e.to_string())?.join("video-export").join(id))
}
#[cfg(target_os = "macos")]
fn convert_video(input:&std::path::Path, output:&std::path::Path, range:&(String,String))->Result<(),String> {
    let result=std::process::Command::new("/usr/bin/avconvert")
        .arg("--source").arg(input).arg("--output").arg(output)
        .arg("--preset").arg("Preset1920x1080")
        .arg("--start").arg(&range.0).arg("--duration").arg(&range.1).output().map_err(|e|e.to_string())?;
    if !result.status.success(){return Err(format!("macOS could not export this video: {}",String::from_utf8_lossy(&result.stderr).chars().take(2000).collect::<String>()));}
    Ok(())
}
#[tauri::command]
pub fn begin_video_export(app: tauri::AppHandle) -> Result<String, String> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_millis();
    let id = format!("{}-{}-{}", now, std::process::id(), NEXT_JOB.fetch_add(1, Ordering::Relaxed));
    let dir=job_path(&app,&id)?; fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
    OpenOptions::new().create_new(true).write(true).open(dir.join("source.mp4")).map_err(|e|e.to_string())?;
    Ok(id)
}
#[tauri::command]
pub fn append_video_export(app: tauri::AppHandle, job_id: String, offset: u64, bytes: Vec<u8>) -> Result<(), String> {
    if bytes.len() > 1_048_576 || offset > 16_000_000_000 { return Err("Video export chunk exceeds its limit.".into()); }
    let file=job_path(&app,&job_id)?.join("source.mp4");
    if fs::metadata(&file).map_err(|e|e.to_string())?.len()!=offset { return Err("Video export upload is out of sequence.".into()); }
    let mut output=OpenOptions::new().append(true).open(file).map_err(|e|e.to_string())?;
    output.write_all(&bytes).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn cancel_video_export(app: tauri::AppHandle, job_id: String) -> Result<(), String> {
    let dir=job_path(&app,&job_id)?;if dir.exists(){fs::remove_dir_all(dir).map_err(|e|e.to_string())?;}Ok(())
}
#[tauri::command]
pub async fn finish_video_export(app: tauri::AppHandle, job_id: String, name: String, start_ms: f64, end_ms: f64) -> Result<String, String> {
    let range=trim_range(start_ms,end_ms)?;
    let job=job_path(&app,&job_id)?;
    tauri::async_runtime::spawn_blocking(move || -> Result<String,String> {
        #[cfg(not(target_os = "macos"))]
        { let _=(job,name,range); return Err("Trimmed MP4 export currently requires macOS.".into()); }
        #[cfg(target_os = "macos")]
        {
            let input=job.join("source.mp4");
            if fs::metadata(&input).map_err(|e|e.to_string())?.len()==0 { return Err("The source video is empty.".into()); }
            let home=std::env::var_os("HOME").ok_or("Movies folder is unavailable.")?;
            let folder=PathBuf::from(home).join("Movies").join("LumaRig Exports");fs::create_dir_all(&folder).map_err(|e|e.to_string())?;
            let destination=folder.join(format!("{}-{}.mp4",safe_name(&name),job_id));
            let staging=folder.join(format!(".{}-export.mp4",job_id));
            let result=convert_video(&input,&staging,&range);
            let _=fs::remove_dir_all(&job);
            if let Err(error)=result {let _=fs::remove_file(&staging);return Err(error);}
            fs::rename(&staging,&destination).map_err(|e|e.to_string())?;
            let _=std::process::Command::new("/usr/bin/open").arg("-R").arg(&destination).spawn();
            Ok(destination.to_string_lossy().into_owned())
        }
    }).await.map_err(|e|e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn export_input_is_validated(){assert!(!valid_job("../other"));assert!(!valid_job(""));assert!(valid_job("123-456-1"));assert!(trim_range(f64::NAN,1000.0).is_err());assert!(trim_range(2000.0,1000.0).is_err());assert_eq!(trim_range(1250.0,3500.0).unwrap(),("1.250000".into(),"2.250000".into()));}
    #[test] fn filenames_cannot_escape_exports(){assert_eq!(safe_name("../../Intro: Verse"),"Intro--Verse");assert_eq!(safe_name("..."),"LumaRig-clip");}
    #[cfg(target_os = "macos")]
    #[test] fn macos_converter_exposes_timed_export(){let output=std::process::Command::new("/usr/bin/avconvert").arg("--help").output().unwrap();let text=format!("{}{}",String::from_utf8_lossy(&output.stdout),String::from_utf8_lossy(&output.stderr));assert!(text.contains("--start"));assert!(text.contains("--duration"));}

    #[cfg(target_os = "macos")]
    #[test] fn native_trim_export_produces_a_playable_h264_file(){
        let id=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir=std::env::temp_dir().join(format!("lumarig-export-test-{}",id));fs::create_dir_all(&dir).unwrap();
        let (script,source,output)=(dir.join("fixture.swift"),dir.join("source.mp4"),dir.join("trimmed.mp4"));
        fs::write(&script,r#"
import AVFoundation
import CoreVideo
import Foundation
if CommandLine.arguments[1] == "generate" {
 let url=URL(fileURLWithPath:CommandLine.arguments[2])
 let writer=try AVAssetWriter(outputURL:url,fileType:.mp4)
 let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:320,AVVideoHeightKey:180])
 let adapter=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:nil)
 writer.add(input);writer.startWriting();writer.startSession(atSourceTime:.zero)
 var buffer:CVPixelBuffer?;CVPixelBufferCreate(nil,320,180,kCVPixelFormatType_32BGRA,nil,&buffer)
 let pixels=buffer!;CVPixelBufferLockBaseAddress(pixels,[]);memset(CVPixelBufferGetBaseAddress(pixels),128,CVPixelBufferGetDataSize(pixels));CVPixelBufferUnlockBaseAddress(pixels,[])
 for i in 0..<20 {while !input.isReadyForMoreMediaData {Thread.sleep(forTimeInterval:0.005)};if !adapter.append(pixels,withPresentationTime:CMTime(value:Int64(i),timescale:10)){fatalError("append failed")}}
 input.markAsFinished();let semaphore=DispatchSemaphore(value:0);writer.finishWriting{semaphore.signal()};if semaphore.wait(timeout:.now()+20) != .success || writer.status != .completed {fatalError("writer failed")}
} else {
 let asset=AVURLAsset(url:URL(fileURLWithPath:CommandLine.arguments[2]))
 let tracks=asset.tracks(withMediaType:.video)
 let desc=tracks[0].formatDescriptions[0] as! CMFormatDescription
 print("\(CMTimeGetSeconds(asset.duration)),\(CMFormatDescriptionGetMediaSubType(desc))")
}
"#).unwrap();
        let generated=std::process::Command::new("/usr/bin/swift").arg(&script).arg("generate").arg(&source).output().unwrap();
        assert!(generated.status.success(),"{}",String::from_utf8_lossy(&generated.stderr));
        convert_video(&source,&output,&trim_range(500.0,1250.0).unwrap()).unwrap();
        let inspected=std::process::Command::new("/usr/bin/swift").arg(&script).arg("inspect").arg(&output).output().unwrap();
        assert!(inspected.status.success(),"{}",String::from_utf8_lossy(&inspected.stderr));
        let details=String::from_utf8_lossy(&inspected.stdout);let fields:Vec<&str>=details.trim().split(',').collect();
        let duration: f64=fields[0].parse().unwrap();assert!((duration-0.75).abs()<0.16,"duration {}",duration);
        assert_eq!(fields[1].parse::<u32>().unwrap(),0x61766331);assert!(fs::metadata(&output).unwrap().len()>100);
        let _=fs::remove_dir_all(dir);
    }
}
