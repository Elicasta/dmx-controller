import { test, expect, type Page } from '@playwright/test';

function wav() {
  const rate=8000, count=rate*4, b=Buffer.alloc(44+count*2);
  b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(count*2,40);
  for(let i=0;i<count;i++) b.writeInt16LE(i%4000<80?20000:0,44+i*2);
  return b;
}
async function timeline(page:Page) {
  await page.goto('/');
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.locator('.show-subtabs').getByRole('button',{name:'Timeline',exact:true}).click();
  await page.getByLabel('Load timeline audio').setInputFiles({name:'Drum song.wav',mimeType:'audio/wav',buffer:wav()});
  await expect(page.getByLabel('Timeline trim out')).toHaveValue('4000');
}

test('trimmed waveform, Space transport and late lighting clips share the timeline',async({page})=>{
  await timeline(page);
  await page.getByRole('button',{name:'FX recipes',exact:true}).click();
  await page.locator('.timeline-fx-recipe').filter({hasText:'Blinder Hit'}).click();
  await page.locator('.timeline-clip').click();
  await page.getByLabel('Clip length in bars').fill('4');
  await page.getByLabel('Timeline trim in').fill('500');
  await page.getByLabel('Timeline trim out').fill('1000');
  const waveform=page.getByLabel('Audio waveform');
  await expect.poll(()=>waveform.getAttribute('viewBox')).not.toBe('0 0 0.001 48');
  const view=(await waveform.getAttribute('viewBox'))!.split(' ').map(Number);
  expect(view[0]).toBeGreaterThan(0);expect(view[2]).toBeLessThan(1400);
  await page.locator('.show-bar-timeline h2').click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  // Media ends at 500ms, but lighting continues well past it.
  await expect.poll(()=>page.locator('.timeline-toolbar output').textContent()).not.toBe('BAR 1 · BEAT 1');
  await expect.poll(()=>page.locator('audio').evaluate((el:HTMLAudioElement)=>el.paused)).toBe(true);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button',{name:'Play Show',exact:true})).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.locator('.timeline-toolbar output')).toHaveText('BAR 1 · BEAT 1');
  await expect.poll(()=>page.locator('audio').evaluate((el:HTMLAudioElement)=>el.currentTime)).toBe(.5);
  await page.getByLabel('Enable step pattern').check();
  await page.getByLabel('Step 2',{exact:true}).click();
  await expect(page.getByLabel('Step 2',{exact:true})).toHaveAttribute('aria-pressed','false');
  await page.reload();
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.locator('.show-subtabs').getByRole('button',{name:'Timeline',exact:true}).click();
  await expect(page.locator('.timeline-audio-block')).not.toHaveClass(/missing/);
  await expect(page.getByLabel('Timeline trim in')).toHaveValue('500');
});

test('manual BPM commits predictably and Escape cancels',async({page})=>{
  await timeline(page);
  const bpm=page.getByLabel('Timeline BPM');
  await bpm.fill('130');await bpm.press('Enter');await expect(bpm).toHaveValue('130');
  await bpm.fill('250');await bpm.press('Escape');await expect(bpm).toHaveValue('130');
  await bpm.focus();await bpm.press('ArrowUp');await expect(bpm).toHaveValue('130.1');
  await bpm.fill('');await bpm.press('Tab');await expect(bpm).toHaveValue('130.1');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dmx-controller.show.v1')!));
  expect(saved.timeline.tempoLocked).toBe(true);
});

test('song media survives New Show, reuse and reload; a failed save keeps current work',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Show Creator',exact:true}).click();
  await page.getByRole('button',{name:/Worship Song/}).click();
  await page.getByRole('button',{name:'Build / Update 8 Sections',exact:true}).click();
  await page.getByRole('button',{name:'Open Timeline ↗',exact:true}).click();
  await page.getByLabel('Load timeline audio').setInputFiles({name:'Reusable.wav',mimeType:'audio/wav',buffer:wav()});
  await expect(page.getByLabel('Timeline trim out')).toHaveValue('4000');
  await page.getByLabel('Timeline BPM').fill('130');await page.getByLabel('Timeline BPM').press('Enter');
  await page.getByRole('button',{name:'Show Library',exact:true}).click();
  await page.getByRole('button',{name:'＋ New Show',exact:true}).click();
  await expect(page.getByRole('button',{name:'Load Into Show',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'Load Into Show',exact:true}).click();
  await expect(page.locator('.timeline-clip')).toHaveCount(8);
  await expect(page.locator('.timeline-audio-block')).not.toHaveClass(/missing/);
  await expect(page.getByLabel('Timeline BPM')).toHaveValue('130');
  await page.reload();
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.locator('.show-subtabs').getByRole('button',{name:'Timeline',exact:true}).click();
  // Re-select the reusable timeline after reopening.
  await page.getByLabel('Timeline show').selectOption({label:'New Song'});
  await expect(page.locator('.timeline-audio-block')).not.toHaveClass(/missing/);
  await page.getByRole('button',{name:'Show Library',exact:true}).click();
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='dmx-controller.show-library.v1')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
  await page.getByRole('button',{name:'＋ New Show',exact:true}).click();
  const show=await page.evaluate(()=>JSON.parse(localStorage.getItem('dmx-controller.show.v1')!));
  expect(show.cues).toHaveLength(8);
  await expect(page.getByText(/New Show canceled: storage is full/)).toBeVisible();
});

test('narrow cue panels remain accessible without widening the app',async({page})=>{
  await page.setViewportSize({width:700,height:800});await page.goto('/');
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Cues',exact:true}).click();
  await page.getByRole('button',{name:'Show Cues',exact:true}).click();
  await expect(page.getByLabel('Search songs and cues')).toBeVisible();
  await page.getByRole('button',{name:'Show Inspector',exact:true}).click();
  await expect(page.locator('.cue-inspector-console')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(700);
});

test('a paused live take resumes and opens as timeline clips',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Recordings',exact:true}).click();
  await page.getByPlaceholder('Take 1').fill('Lighting pass');
  await page.getByRole('button',{name:'● RECORD'}).click();
  await expect(page.getByText('RECORDING SHOW')).toBeVisible();
  await page.locator('.console-recording-bar').getByRole('button',{name:'Pause'}).click();
  await expect(page.getByText('RECORDING PAUSED')).toBeVisible();
  const paused=await page.evaluate(()=>JSON.parse(localStorage.getItem('dmx-controller.show.v1')!).recordings?.length??0);
  expect(paused).toBe(0);
  await page.locator('.console-recording-bar').getByRole('button',{name:'Resume'}).click();
  await page.locator('.console-recording-bar').getByRole('button',{name:'Stop + save'}).click();
  await expect(page.locator('.recorded-takes-console article')).toHaveCount(1);
  await page.locator('.recorded-takes-console article').getByRole('button',{name:'Edit in Timeline'}).click();
  await expect(page.getByLabel('Timeline show')).toHaveValue(/.+/);
  await expect(page.locator('.timeline-clip')).toHaveCount(1);
});
