import { test, expect, type Page } from "@playwright/test";
const showKey = "dmx-controller.show.v1";
async function seed(page: Page) {
  page.on("pageerror", (error) =>
    console.error("Browser page error:", error.message),
  );
  await page.addInitScript(() => {
    if (!localStorage.getItem("dmx-controller.patch.v1"))
      localStorage.setItem(
        "dmx-controller.patch.v1",
        JSON.stringify(
          Array.from({ length: 4 }, (_, i) => ({
            id: `f${i}`,
            name: `Wash ${i + 1}`,
            profileId: "adj-mega-par-profile-plus",
            modeId: "ch05",
            address: 1 + i * 6,
            group: "Wash",
            selected: true,
            collapsed: false,
          })),
        ),
      );
  });
}
async function readShow(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "{}"),
    showKey,
  );
}
function wav() {
  const rate = 8000,
    count = rate * 3,
    b = Buffer.alloc(44 + count * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    b.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * 220) / rate) * 4000),
      44 + i * 2,
    );
  return b;
}
test("solo creator builds an editable audio-aligned show and preserves the draft", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "SHOW", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "SHOW", exact: true }).click();
  await page.getByRole("button", { name: "Show Creator", exact: true }).click();
  await page.getByRole("button", { name: /Worship Song/ }).click();
  await expect(page.locator(".section-list>article")).toHaveCount(8);
  await page
    .getByLabel("Primary FX", { exact: true })
    .selectOption("row-chase");
  await page.getByLabel("Search FX recipes").fill("Ocean");
  await page
    .locator(".recipe-list article")
    .filter({ hasText: "Ocean Color Wave" })
    .getByRole("button", { name: "＋ Layer", exact: true })
    .click();
  await expect(page.locator(".section-layer")).toHaveCount(1);
  await page.locator(".section-preview-controls").getByRole("button", { name: /Preview/ }).click();
  await page.locator(".section-preview-controls").getByRole("button", { name: /Stop/ }).click();
  await page.getByRole("button", { name: "Preview Verse 1", exact: true }).click();
  await expect(page.locator(".section-preview.active")).toHaveCount(1);
  await page.locator(".section-preview-controls").getByRole("button", { name: /Stop/ }).click();
  await page
    .getByRole("button", { name: "Save Section Preset", exact: true })
    .click();
  await expect(page.locator(".saved-section")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Build / Update 8 Sections", exact: true })
    .click();
  await expect
    .poll(async () => ((await readShow(page)).cues ?? []).length)
    .toBe(8);
  await page
    .getByRole("button", { name: "Build / Update 8 Sections", exact: true })
    .click();
  expect((await readShow(page)).cues).toHaveLength(8);
  expect((await readShow(page)).cues[0].effectStack).toHaveLength(2);
  await page.screenshot({ path: info.outputPath("creator.png") });
  await page
    .getByRole("button", { name: "Open Timeline ↗", exact: true })
    .click();
  await expect(page.locator(".timeline-clip")).toHaveCount(8);
  await page
    .locator(".timeline-cue-library>button")
    .first()
    .dragTo(page.locator('[data-lane="2"]'), {
      targetPosition: { x: 118, y: 55 },
    });
  await expect(page.locator(".timeline-clip")).toHaveCount(9);
  await expect(page.getByLabel("Clip lane")).toHaveValue("2");
  await page.getByRole("button", { name: "Delete Clip", exact: true }).click();
  await expect(page.locator(".timeline-clip")).toHaveCount(8);
  const clip = page.locator(".timeline-clip").first();
  await clip.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));
  let box = (await clip.boundingBox())!;
  const lane = (await page.locator('[data-lane="1"]').boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 102, lane.y + 25, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByLabel("Clip starts at bar")).toHaveValue("3");
  await expect(page.getByLabel("Clip lane")).toHaveValue("1");
  const moved = page.locator('[data-lane="1"] .timeline-clip').first();
  box = (await moved.locator(".clip-resize").boundingBox())!;
  await page.mouse.move(box.x + 6, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 78, box.y + 20, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByLabel("Clip length in bars")).toHaveValue("10");
  await page.getByRole("button", { name: "Undo timeline edit" }).click();
  await expect(page.getByLabel("Clip length in bars")).toHaveValue("8");
  await page.getByRole("button", { name: "Redo timeline edit" }).click();
  await expect(page.getByLabel("Clip length in bars")).toHaveValue("10");
  await page.getByLabel("Load timeline audio").setInputFiles({
    name: "test-song.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(page.locator(".timeline-audio-block")).toContainText(
    "test-song.wav",
  );
  await page.getByLabel("Audio starts at bar", { exact: true }).fill("2");
  await expect
    .poll(async () => ((await readShow(page)).timelineShows?.[0]?.timeline ?? {}).audioOffsetBars)
    .toBe(1);
  const ruler = (await page.locator(".bar-ruler").boundingBox())!;
  await page.mouse.click(ruler.x + 36 * 1.5, ruler.y + 20);
  await page.getByRole("button", { name: "Play Show", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("audio").evaluate((el: HTMLAudioElement) => el.currentTime),
    )
    .toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await page
    .locator("audio")
    .evaluate((el: HTMLAudioElement) => el.paused);
  expect(paused).toBe(true);
  await page
    .getByRole("button", { name: "Stop / Rewind", exact: true })
    .click();
  await expect(page.locator(".timeline-toolbar output")).toHaveText("BAR 1 · BEAT 1");
  await page.screenshot({ path: info.outputPath("timeline.png") });
  await page.reload();
  await page.getByRole("button", { name: "SHOW", exact: true }).click();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".timeline-clip")).toHaveCount(8);
  await expect(page.locator(".timeline-audio-block")).toContainText(
    "test-song.wav",
  );
  expect((await readShow(page)).timelineShows[0].timeline.audioOffsetBars).toBe(1);
  expect((await readShow(page)).cues[0].effectStack).toHaveLength(2);
  await page.getByRole("button", { name: "Show Creator", exact: true }).click();
  await expect(page.locator(".section-list>article")).toHaveCount(8);
  await expect(page.locator(".section-layer")).toHaveCount(1);
  expect(errors).toEqual([]);
});
for (const width of [820, 1024, 1280])
  test(`programmer and FX controls fit a ${width}px window`, async ({
    page,
  }, info) => {
    await seed(page);
    await page.setViewportSize({ width, height: 650 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "SHOW", exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "CREATE", exact: true }).click();
    await page.getByRole("button", { name: "Programmer", exact: true }).click();
    const blackout = page.getByRole("button", {
      name: "BLACKOUT",
      exact: true,
    });
    const black = (await blackout.boundingBox())!;
    expect(black.x).toBeGreaterThanOrEqual(0);
    expect(black.x + black.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const center = (await page.locator(".program-center").boundingBox())!;
    const browser = (await page
      .locator(".create-console-v3>.console-browser")
      .boundingBox())!;
    const fx = (await page
      .locator(".create-console-v3>.effects-inspector")
      .boundingBox())!;
    expect(browser.x + browser.width).toBeLessThanOrEqual(center.x + 1);
    if (fx) {
      expect(center.x + center.width).toBeLessThanOrEqual(fx.x + 1);
      expect(fx.x + fx.width).toBeLessThanOrEqual(width);
    } else {
      await expect(page.getByRole('button',{name:'Show FX',exact:true})).toBeVisible();
      expect(center.width).toBeGreaterThanOrEqual(480);
    }
    expect(
      await page
        .locator(".programmer-attribute-deck-v4")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    expect(
      await page
        .locator(".programmer-attribute-deck-v4 .color-deck")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    expect(
      await page
        .locator(".programmer-attribute-deck-v4 .color-preset-row")
        .evaluate((e) => getComputedStyle(e).display),
    ).toBe("grid");
    const deck = (await page.locator(".programmer-attribute-deck-v4").boundingBox())!;
    const presets = (await page.locator(".programmer-v3>.looks-strip").boundingBox());
    expect(presets).not.toBeNull();
    expect(deck.y + deck.height).toBeLessThanOrEqual(presets!.y + 1);
    expect((await page.locator('.programmer-stage canvas.visualizer-3d-canvas').boundingBox())!.height).toBeGreaterThanOrEqual(180);
    await page.screenshot({ path: info.outputPath(`programmer-${width}.png`) });
    await page.getByRole("button", { name: "FX", exact: true }).click();
    await page.getByRole("button", { name: /Ocean Color Wave/ }).click();
    await expect(page.getByLabel("FX color 1")).toBeVisible();
    await expect(page.getByLabel("FX color 2")).toBeVisible();
    await page.getByRole("button", { name: "RUN FX", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "STOP FX", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "STOP FX", exact: true }).click();
    const layout = page.locator(".fx-editor-layout");
    expect(
      await layout.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`fx-${width}.png`) });
  });

test('programmer panels reorder, resize, collapse into a shelf and stay docked',async({page})=>{
 await seed(page);await page.setViewportSize({width:1280,height:760});await page.goto('/');
 await page.getByRole('button',{name:'CREATE',exact:true}).click();
 await page.getByRole('button',{name:'Programmer',exact:true}).click();
 const deck=page.locator('.draggable-panel-deck');
 await expect(deck).toBeVisible();
 await expect(page.locator('[data-panel-id="buttons"]')).toBeVisible();
 await expect(page.locator('[data-panel-id="buttons"]').getByRole('button',{name:'FULL',exact:true})).toBeVisible();
 const color=page.locator('[data-panel-id="color"]');
 const intensity=page.locator('[data-panel-id="intensity"]');
 const colorHandle=page.locator('[data-panel-id="color"] .draggable-programmer-panel-handle');
 await intensity.scrollIntoViewIfNeeded();
 await colorHandle.dragTo(intensity,{targetPosition:{x:4,y:4}});
 await expect(page.locator('.draggable-programmer-panel').first()).toHaveAttribute('data-panel-id','color');
 const before=(await color.boundingBox())!;
 const resize=page.getByRole('button',{name:'Resize COLOR panel'});
 await resize.scrollIntoViewIfNeeded();
 const handle=(await resize.boundingBox())!;
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
 await page.mouse.move(handle.x+260,handle.y+110,{steps:8});await page.mouse.up();
 const after=(await color.boundingBox())!;
 expect(after.height).toBeGreaterThan(before.height+60);
 expect(after.width).toBeGreaterThanOrEqual(before.width);
 const expandedBefore=await page.locator('.draggable-panel-grid>.draggable-programmer-panel').count();
 await page.getByRole('button',{name:'Collapse COLOR'}).click();
 await expect(page.locator('[data-panel-id="color"]')).toHaveCount(0);
 await expect(page.locator('[data-collapsed-panel="color"]')).toBeVisible();
 await expect(page.locator('.draggable-panel-grid>.draggable-programmer-panel')).toHaveCount(expandedBefore-1);
 await page.reload();
 await page.getByRole('button',{name:'CREATE',exact:true}).click();
 await page.getByRole('button',{name:'Programmer',exact:true}).click();
 await expect(page.locator('[data-panel-id="color"]')).toHaveCount(0);
 await expect(page.locator('[data-collapsed-panel="color"]')).toBeVisible();
 await page.locator('[data-collapsed-panel="color"]').click();
 await expect(page.locator('[data-panel-id="color"]')).toBeVisible();
 await expect(page.locator('.draggable-panel-deck').getByText(/pop out/i)).toHaveCount(0);
});

test('color input, compact panels and detached stage follow actual output', async ({page},info)=>{
 await seed(page);await page.goto('/');
 await page.getByRole('button',{name:'CREATE',exact:true}).click();
 await page.getByRole('button',{name:'Programmer',exact:true}).click();
 await expect(page.locator('.position-module')).toHaveCount(0);
 const hue=page.getByRole('slider',{name:'Color hue',exact:true});
 const oldColor=await page.locator('.selected-color-readout strong').textContent();
 await hue.focus();await hue.press('Home');await hue.press('ArrowRight');
 await expect(hue).toHaveValue('1');
 await expect(page.locator('.selected-color-readout strong')).not.toHaveText(oldColor!);
 const wheel=page.getByRole('slider',{name:'Color wheel',exact:true});await wheel.click({position:{x:39,y:5}});
 await page.getByRole('button',{name:'Visualizer',exact:true}).click();
 await expect(page.locator('.floating-stage-monitor [data-fixture]')).toHaveCount(4);
 await expect.poll(()=>page.locator('.floating-stage-monitor [data-fixture="f0"]').getAttribute('data-level')).not.toBe('0');
 const before=(await page.locator('.program-center').boundingBox())!;
 await page.getByRole('button',{name:'Collapse Fixtures',exact:true}).click();
 expect((await page.locator('.program-center').boundingBox())!.width).toBeGreaterThan(before.width);
 await page.getByRole('button',{name:'Show Fixtures',exact:true}).click();
 const separator=page.getByRole('separator',{name:'Resize Fixtures panel'});
 await separator.focus();await page.keyboard.press('ArrowRight');
 await expect(separator).toHaveAttribute('aria-valuenow','190');
 await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await expect(page.locator('.floating-stage-monitor')).toBeVisible();
 const popupPromise=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Pop out ↗',exact:true}).click();
 const popup=await popupPromise;await popup.waitForLoadState();
 await expect(popup.locator('[data-fixture]')).toHaveCount(4);
 await page.getByRole('button',{name:'BLACKOUT',exact:true}).click();
 await expect.poll(()=>popup.locator('[data-fixture="f0"]').getAttribute('data-level')).toBe('0');
 await popup.close();
 await page.getByRole('button',{name:'MIDI Map',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'MIDI mapping'})).toBeVisible();
 await expect(page.getByRole('dialog').locator('option').filter({hasText:'Row Chase'})).toHaveCount(1);
 await page.getByRole('button',{name:'Close MIDI Map',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});
test('songs collapse, open inline timelines and preserve imported timeline shows',async({page},info)=>{
 await seed(page);await page.goto('/');
 await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.getByRole('button',{name:'Show Creator',exact:true}).click();
 await page.getByRole('button',{name:/Worship Song/}).click();
 await page.getByRole('button',{name:'Build / Update 8 Sections',exact:true}).click();
 await page.getByRole('button',{name:'Cues',exact:true}).click();
 await expect(page.locator('.song-cue-group')).toHaveCount(1);
 await page.locator('.song-toggle').click();await expect(page.locator('.song-cue-group article')).toHaveCount(0);
 await page.locator('.song-toggle').click();await expect(page.locator('.song-cue-group article')).toHaveCount(8);
 await page.getByRole('button',{name:'Open timeline for New Song',exact:true}).click();
 await expect(page.locator('.cue-integrated-timeline .timeline-clip')).toHaveCount(8);
 const integrated=(await page.locator('.cue-integrated-timeline').boundingBox())!;
 const cueWorkspace=(await page.locator('.show-cue-layout').boundingBox())!;
 expect(integrated.x+integrated.width).toBeGreaterThan(cueWorkspace.x+cueWorkspace.width-5);
 await page.getByRole('button',{name:'Visualizer',exact:true}).click();
 const monitorHeader=(await page.locator('.floating-stage-monitor>header').boundingBox())!;
 await page.mouse.move(monitorHeader.x+60,monitorHeader.y+15);await page.mouse.down();await page.mouse.move(monitorHeader.x+710,monitorHeader.y+345,{steps:8});await page.mouse.up();
 await page.getByRole('button',{name:'Play Show',exact:true}).click();
 await expect.poll(()=>page.locator('.floating-stage-monitor [data-fixture="f0"]').getAttribute('data-level')).not.toBe('0');
 await page.getByRole('button',{name:'Stop / Rewind',exact:true}).click();
 await page.getByRole('button',{name:'Close visualizer',exact:true}).click();
 await page.getByRole('button',{name:'Close timeline',exact:true}).click();
 const show=await readShow(page);show.name='Imported Song';
 await page.getByLabel('Import timeline show',{exact:true}).setInputFiles({name:'song.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(show))});
 await expect(page.locator('.song-cue-group')).toHaveCount(2);
 await expect.poll(async()=>((await readShow(page)).timelineShows??[]).length).toBe(2);
 await page.getByRole('button',{name:'Open timeline for Imported Song',exact:true}).click();
 await expect(page.locator('.timeline-clip')).toHaveCount(8);
 await page.reload();await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.getByRole('button',{name:'Cues',exact:true}).click();
 await expect(page.locator('.song-cue-group')).toHaveCount(2);
 expect((await readShow(page)).timelineShows.find((t:any)=>t.name==='Imported Song').timeline.clips).toHaveLength(8);
});
test('LIVE remains bounded with all recipe assignments and audio drop avoids seek loops',async({page},info)=>{
 await seed(page);await page.setViewportSize({width:820,height:650});await page.goto('/');
 await page.getByRole('button',{name:'LIVE',exact:true}).click();
 for(const name of ['FADERS','MA','BUSK']){
  const button=page.locator('.desk-surface-header nav button').filter({hasText:name});
  if(await button.count())await button.click();
  const surface=page.locator('.desk-live-controller');
  expect(await surface.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  const scroll=page.locator('.desk-classic-scroll,.desk-ma-scroll,.desk-busk-scroll');
  expect(await scroll.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }
 await page.locator('.desk-surface-header nav button').first().click();
 const flash=(await page.locator('.desk-surface-flash').first().boundingBox())!;
 const faderArea=(await page.locator('.desk-classic-scroll').boundingBox())!;
 expect(flash.y+flash.height).toBeLessThanOrEqual(faderArea.y+faderArea.height+1);
 await page.getByRole('button',{name:'ASSIGN',exact:true}).click();
 await page.locator('.desk-surface-label').first().click();
 await expect(page.locator('.desk-assignment-view')).toHaveCount(0);
 await expect(page.locator('.desk-assign-panel')).toHaveCSS('grid-template-rows', /.+/);
 await page.getByPlaceholder('Fixtures, groups, looks, effects…').fill('Row Chase');
 await expect(page.locator('.desk-assign-grid button').filter({hasText:'Row Chase'})).toHaveCount(1);
 await page.locator('.desk-assign-grid button').filter({hasText:'Row Chase'}).click();
 await page.getByRole('button',{name:'DONE',exact:true}).click();
 await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.locator('.show-subtabs').getByRole('button',{name:'Timeline',exact:true}).click();
 await page.getByRole('button',{name:'FX recipes',exact:true}).click();
 await page.locator('.timeline-fx-recipe').filter({hasText:'Row Chase'}).dragTo(page.locator('[data-lane="2"]'),{targetPosition:{x:118,y:55}});
 await expect(page.locator('.timeline-clip')).toHaveCount(1);
 expect((await readShow(page)).cues[0].effectStack).toHaveLength(1);
 const data=await page.evaluateHandle(bytes=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(bytes)],'drop-song.wav',{type:''}));return d;},Array.from(wav()));
 await page.locator('.show-bar-timeline').dispatchEvent('drop',{dataTransfer:data});
 await expect(page.locator('.timeline-audio-block')).toContainText('drop-song.wav');
 await page.locator('audio').evaluate(el=>{el.setAttribute('data-seeks','0');el.addEventListener('seeking',()=>el.setAttribute('data-seeks',String(Number(el.getAttribute('data-seeks'))+1)));});
 await page.getByRole('button',{name:'Play Show',exact:true}).click();
 await expect.poll(()=>page.locator('audio').evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(1.5);
 expect(Number(await page.locator('audio').getAttribute('data-seeks'))).toBeLessThanOrEqual(1);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
});


test('cue rundown keeps nested sections and media items after reload',async({page})=>{
 await seed(page);await page.goto('/');
 await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.getByRole('button',{name:'Show Creator',exact:true}).click();
 await page.getByRole('button',{name:/Worship Song/}).click();
 await page.getByRole('button',{name:'Build / Update 8 Sections',exact:true}).click();
 await page.getByRole('button',{name:'Cues',exact:true}).click();

 await expect(page.locator('.show-rundown-section')).toHaveCount(1);
 await page.locator('.rundown-library-head').getByRole('button',{name:'＋ Section',exact:true}).click();
 await expect(page.locator('.show-rundown-section')).toHaveCount(2);

 await page.locator('.song-cue-group article .cue-line').first().click();
 const secondSection=await page.getByLabel('Section name 2').inputValue();
 await page.getByLabel('Cue show section').selectOption({label:secondSection});
 await page.getByLabel('Cue item type').selectOption('media');
 await page.locator('.cue-inspector-console').getByText('Song / media item').locator('..').locator('input').fill('Walk-in Video');

 await expect(page.locator('.rundown-item.media')).toHaveCount(1);
 await expect(page.locator('.rundown-item.media')).toContainText('Walk-in Video');
 await expect.poll(async()=>((await readShow(page)).rundownSections??[]).length).toBe(2);
 await expect.poll(async()=>((await readShow(page)).cues??[]).some((cue:any)=>cue.trackKind==='media'&&cue.trackName==='Walk-in Video')).toBe(true);

 await page.reload();
 await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.getByRole('button',{name:'Cues',exact:true}).click();
 await expect(page.locator('.show-rundown-section')).toHaveCount(2);
 await expect(page.locator('.rundown-item.media')).toContainText('Walk-in Video');
});


test('integrated visualizer keeps venue presets isolated and opens the renderer',async({page})=>{
 await seed(page);
 page.on('dialog',dialog=>void dialog.accept());
 await page.goto('/');

 await page.getByRole('button',{name:'BUILD',exact:true}).click();
 await page.getByRole('button',{name:'Stage',exact:true}).click();
 await page.getByRole('button',{name:/Apostolic Day 2026/}).first().click();

 await expect.poll(async()=>page.evaluate(()=>{
   const doc=JSON.parse(localStorage.getItem('dmx-controller.stage-elements.v1')??'{"elements":[]}');
   return (doc.elements??[]).every((element:any)=>String(element.id).startsWith('apostolic-day-2026:'));
 })).toBe(true);

 await page.getByRole('button',{name:/Cornerstone · Main Sanctuary/}).first().click();
 await expect.poll(async()=>page.evaluate(()=>{
   const doc=JSON.parse(localStorage.getItem('dmx-controller.stage-elements.v1')??'{"elements":[]}');
   const ids=(doc.elements??[]).map((element:any)=>String(element.id));
   return ids.length>0
     && ids.every((id:string)=>id.startsWith('cornerstone-main-sanctuary:'))
     && !ids.some((id:string)=>id.startsWith('apostolic-day-2026:'));
 })).toBe(true);

 await page.getByRole('button',{name:'VISUALIZER',exact:true}).click();
 await expect(page.locator('.visualizer-workspace')).toBeVisible();
 await expect(page.locator('.visualizer-workspace canvas.visualizer-3d-canvas')).toBeVisible();
 await expect(page.getByRole('button',{name:'▶ Flyby',exact:true}).first()).toBeVisible();
 await expect(page.locator('.visualizer-workspace-sidebar')).toHaveCount(0);
 await page.getByRole('button',{name:'Scene Tools',exact:true}).click();
 await expect(page.locator('.visualizer-workspace-sidebar')).toBeVisible();

 const initialObjectCount=await page.evaluate(()=>{
   const doc=JSON.parse(localStorage.getItem('dmx-controller.stage-elements.v1')??'{"elements":[]}');
   return (doc.elements??[]).length;
 });
 const audioWarehouse=page.locator('.visualizer-warehouse details').filter({hasText:'Audio'});
 await audioWarehouse.locator('summary').click();
 await audioWarehouse.getByRole('button',{name:'＋ PA Speaker',exact:true}).click();
 await expect(page.locator('.visualizer-object-inspector')).toContainText('PA Speaker 1');
 await expect.poll(async()=>page.evaluate(()=>{
   const doc=JSON.parse(localStorage.getItem('dmx-controller.stage-elements.v1')??'{"elements":[]}');
   return (doc.elements??[]).length;
 })).toBe(initialObjectCount+1);

 await page.locator('.visualizer-object-inspector').getByRole('button',{name:'Duplicate',exact:true}).click();
 await expect(page.locator('.visualizer-object-inspector')).toContainText('PA Speaker 1 Copy');
 await expect.poll(async()=>page.evaluate(()=>{
   const doc=JSON.parse(localStorage.getItem('dmx-controller.stage-elements.v1')??'{"elements":[]}');
   return (doc.elements??[]).length;
 })).toBe(initialObjectCount+2);

 await page.locator('.visualizer-object-inspector').getByRole('button',{name:'Delete',exact:true}).click();
 await expect.poll(async()=>page.evaluate(()=>{
   const doc=JSON.parse(localStorage.getItem('dmx-controller.stage-elements.v1')??'{"elements":[]}');
   return (doc.elements??[]).length;
 })).toBe(initialObjectCount+1);
});


test('master tempo stays consistent from Creator through Timeline and LIVE',async({page})=>{
 await seed(page);
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/');
 await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.getByRole('button',{name:'Show Creator',exact:true}).click();
 await page.getByLabel('Master tempo').fill('132');
 await expect(page.locator('.tempo-pill strong')).toHaveText('132 BPM');
 await page.getByRole('button',{name:/Worship Song/}).click();
 await page.getByRole('button',{name:'Build / Update 8 Sections',exact:true}).click();
 await page.getByRole('button',{name:'Timeline',exact:true}).click();
 await expect(page.getByLabel('Master BPM')).toHaveValue('132');
 await expect.poll(async()=>((await readShow(page)).timelineShows?.[0]?.timeline??{}).bpm).toBe(132);
 await page.getByRole('button',{name:'LIVE',exact:true}).click();
 await expect(page.locator('.desk-surface-status b')).toContainText('132');
});

test('Stage stays full-size in Build and Programmer',async({page})=>{
 await seed(page);
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/');
 await page.getByRole('button',{name:'BUILD',exact:true}).click();
 await page.getByRole('button',{name:'Stage',exact:true}).click();

 await expect(page.getByRole('button',{name:'3D VISUALIZER',exact:true})).toBeVisible();
 const buildStage=page.locator('.dominant-stage');
 const buildBox=(await buildStage.boundingBox())!;
 expect(buildBox.height).toBeGreaterThanOrEqual(390);
 await expect(buildStage.locator('canvas.visualizer-3d-canvas')).toBeVisible();

 await page.getByRole('button',{name:'PLOT EDITOR',exact:true}).click();
 await expect(buildStage.locator('.physical-stage')).toBeVisible();
 const plotBox=(await buildStage.locator('.physical-stage').boundingBox())!;
 expect(plotBox.height).toBeGreaterThanOrEqual(360);

 await page.getByRole('button',{name:'CREATE',exact:true}).click();
 await page.getByRole('button',{name:'Programmer',exact:true}).click();
 await page.getByRole('button',{name:'3D',exact:true}).click();
 const programmerStage=page.locator('.programmer-stage');
 const programmerBox=(await programmerStage.boundingBox())!;
 expect(programmerBox.height).toBeGreaterThanOrEqual(180);
 const deckBox=(await page.locator('.draggable-panel-deck').boundingBox())!;
 expect(programmerBox.y+programmerBox.height).toBeLessThanOrEqual(deckBox.y+1);
 expect(deckBox.height).toBeGreaterThanOrEqual(190);
 await expect(programmerStage.locator('canvas.visualizer-3d-canvas')).toBeVisible();
});

test('song bank stores separate media and restores songs after restart', async ({page}, info) => {
 await seed(page); await page.goto('/');
 await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.locator('.show-mode-tabs').getByRole('button',{name:'Song Bank',exact:true}).click();
 for(const name of ['First Song','Second Song']) {
  await page.getByLabel('New song name').fill(name);
  await page.getByRole('button',{name:'Add song',exact:true}).click();
  await page.getByLabel(`Link media for ${name}`).setInputFiles({name:name+'.wav',mimeType:'audio/wav',buffer:wav()});
  await expect(page.locator('.song-bank-list article').filter({has:page.getByLabel(`Song name ${name}`)})).toContainText(name+'.wav');
 }
 const first=page.locator('.song-bank-list article').filter({has:page.getByLabel('Song name First Song')});
 await first.getByRole('button',{name:'Build song',exact:true}).click();
 await page.getByLabel('Master tempo',{exact:true}).fill('132');
 await page.getByRole('button',{name:/Worship Song/}).click();
 await page.getByRole('button',{name:'Build / Update 8 Sections',exact:true}).click();
 await page.getByRole('button',{name:'Open Timeline ↗',exact:true}).click();
 await expect(page.locator('.timeline-clip')).toHaveCount(8);
 await expect(page.locator('.timeline-audio-block')).toContainText('First Song.wav');
 await page.getByLabel('Audio starts at bar',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Song Bank',exact:true}).click();
 await page.locator('.song-bank-list article').filter({has:page.getByLabel('Song name Second Song')}).getByRole('button',{name:'Timeline',exact:true}).click();
 await expect(page.locator('.timeline-clip')).toHaveCount(0);
 await expect(page.getByLabel('Master BPM')).toHaveValue('120');
 await expect(page.locator('.timeline-audio-block')).toContainText('Second Song.wav');
 await page.getByLabel('Timeline show').selectOption({label:'First Song'});
 await expect(page.locator('.timeline-clip')).toHaveCount(8);
 await expect(page.getByLabel('Audio starts at bar',{exact:true})).toHaveValue('3');
 await expect(page.locator('.timeline-audio-block')).toContainText('First Song.wav');
 await page.reload();
 await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.getByRole('button',{name:'Timeline',exact:true}).click();
 await expect(page.locator('.timeline-clip')).toHaveCount(8);
 await expect(page.locator('.timeline-audio-block')).toContainText('First Song.wav');
 await expect.poll(()=>page.locator('audio').evaluate((audio:HTMLAudioElement)=>audio.readyState)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Song Bank',exact:true}).click();
 await page.getByLabel('Song name First Song').fill('Renamed Song');
 await page.getByLabel('Search song bank').click();
 await expect(page.getByLabel('Song name Renamed Song')).toBeVisible();
 await page.screenshot({path:info.outputPath('song-bank.png')});
 const show=await readShow(page);
 expect(show.cues.every((c:any)=>c.trackName==='Renamed Song')).toBe(true);
 expect(show.songs.find((s:any)=>s.name==='Renamed Song').mediaName).toBe('First Song.wav');
 expect(show.songs.find((s:any)=>s.name==='Renamed Song').bpm).toBe(132);
 expect(show.songs.find((s:any)=>s.name==='Second Song').bpm).toBe(120);
});

test('Song Library survives New Show, reuse, restart, and Recovery', async ({page}, info) => {
  const errors: string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await seed(page); await page.goto('/');
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.getByLabel('New song name').fill('Hineh Ma Tov');
  await page.getByRole('button',{name:'Add song',exact:true}).click();
  let row=page.locator('.song-bank > .song-bank-list article').filter({has:page.getByLabel('Song name Hineh Ma Tov')});
  await row.getByLabel('Link media for Hineh Ma Tov').setInputFiles({name:'hineh.wav',mimeType:'audio/wav',buffer:wav()});
  await row.getByRole('button',{name:'Build song',exact:true}).click();
  const tempo=page.getByLabel('Master tempo');
  await tempo.fill(''); await tempo.pressSequentially('130.5'); await tempo.press('Tab');
  await expect(page.locator('.tempo-pill strong')).toHaveText('130.5 BPM');
  await expect(page.getByRole('button',{name:'Tempo Locked',exact:true})).toHaveAttribute('aria-pressed','true');
  await tempo.press('ArrowUp'); await expect(tempo).toHaveValue('131.5');
  await tempo.press('ArrowDown'); await expect(tempo).toHaveValue('130.5');
  await tempo.fill('999'); await tempo.press('Tab'); await expect(tempo).toHaveValue('130.5');
  await tempo.hover(); await page.mouse.wheel(0,500);
  await expect(page.locator('.tempo-pill strong')).toHaveText('130.5 BPM');
  await page.getByRole('button',{name:/Worship Song/}).click();
  await page.getByRole('button',{name:'Build / Update 8 Sections',exact:true}).click();
  await expect.poll(async()=>((await readShow(page)).cues??[]).length).toBe(8);
  const original=await readShow(page);
  await page.getByRole('button',{name:'Show Library',exact:true}).click();
  await page.getByRole('button',{name:'＋ New Show',exact:true}).click();
  await expect.poll(async()=>((await readShow(page)).cues??[]).length).toBe(0);
  await page.getByRole('button',{name:'Song Bank',exact:true}).click();
  const saved=page.getByRole('region',{name:'Song Library'}).locator('article').filter({hasText:'Hineh Ma Tov'});
  await expect(saved).toContainText('8 cues'); await expect(saved).toContainText('hineh.wav');
  await saved.getByRole('button',{name:'Add to Show',exact:true}).click();
  await expect.poll(async()=>((await readShow(page)).cues??[]).length).toBe(8);
  row=page.locator('.song-bank > .song-bank-list article').first();
  await row.getByRole('button',{name:'Timeline',exact:true}).click();
  await expect(page.locator('.timeline-audio-block')).toContainText('hineh.wav');
  await expect(page.getByLabel('Master BPM')).toHaveValue('130.5');
  await page.getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.reload();
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  expect((await readShow(page)).cues).toHaveLength(8);
  await page.screenshot({path:info.outputPath('reusable-song-library.png')});
  await page.getByRole('button',{name:'Show Library',exact:true}).click();
  await page.locator('.show-recovery summary').click();
  await page.getByRole('button',{name:'Restore Show',exact:true}).first().click();
  await expect.poll(async()=>((await readShow(page)).cues??[]).map((c:any)=>c.id)).toEqual(original.cues.map((c:any)=>c.id));
  expect(errors).toEqual([]);
});

test('New Show cancels if its atomic checkpoint fails', async ({page}) => {
  await seed(page); await page.goto('/');
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.getByLabel('New song name').fill('Protected Song');
  await page.getByRole('button',{name:'Add song',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  const before=await readShow(page);
  await page.evaluate(()=>{
    const original=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(...args:Parameters<typeof original>){
      if(this.name==='lumarig-program-library') throw new DOMException('Simulated disk full','QuotaExceededError');
      return original.apply(this,args);
    };
  });
  await page.getByRole('button',{name:'Show Library',exact:true}).click();
  await page.getByRole('button',{name:'＋ New Show',exact:true}).click();
  await expect(page.locator('.show-recovery [role="status"]')).toHaveText('Save failed');
  expect(await readShow(page)).toEqual(before);
  await page.reload();
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await expect(page.getByLabel('Song name Protected Song')).toBeVisible();
});


test('Programmer splitters persist, reset, and protect the Stage on narrow windows', async ({page}, info) => {
 await seed(page); await page.goto('/');
 await page.getByRole('button',{name:'CREATE',exact:true}).click();
 const left=page.getByRole('separator',{name:'Resize Fixtures panel'});
 await expect(left).toBeVisible();
 await left.focus(); await left.press('ArrowRight');
 await expect(left).toHaveAttribute('aria-valuenow','190');
 await page.reload();
 await page.getByRole('button',{name:'CREATE',exact:true}).click();
 await expect(left).toHaveAttribute('aria-valuenow','190');
 await left.dblclick();
 await expect(left).toHaveAttribute('aria-valuenow','180');
 await page.setViewportSize({width:820,height:650});
 await expect(page.getByRole('button',{name:'Show FX',exact:true})).toBeVisible();
 const canvas=page.locator('.programmer-stage canvas.visualizer-3d-canvas');
 expect((await canvas.boundingBox())!.height).toBeGreaterThanOrEqual(180);
 expect(await page.locator('.program-center').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('programmer-stage-narrow.png')});
 await page.getByRole('button',{name:'Collapse Fixtures',exact:true}).click();
 await expect(page.locator('.effects-inspector')).toBeVisible();
});

for (const width of [650,820]) test(`P0 workspaces stay bounded at ${width}px`, async ({page},info) => {
  await seed(page); await page.setViewportSize({width,height:760}); await page.goto('/');
  await page.getByRole('button',{name:'LIVE',exact:true}).click();
  for(const name of ['Fixtures','Groups','Masters','Shortcuts','System']) {
    await page.locator('.live-view-tabs').getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.live-detail-view')).toBeVisible();
    const box=(await page.locator('.live-detail-view').boundingBox())!;
    expect(box.x+box.width).toBeLessThanOrEqual(width+1);
    expect(await page.locator('.live-detail-view').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
    expect(await page.locator('.live-command-bar').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
    expect(await page.locator('.live-back').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`live-${name}-${width}.png`)});
  }
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  for(const name of ['Show Creator','Cues','Timeline','Song Bank','Show Library']) {
    await page.getByRole('button',{name,exact:true}).click();
    expect(await page.locator('.show-console-v3').evaluate(e=>e.scrollWidth<=e.clientWidth+1), name).toBe(true);
    if(name==='Show Creator') {
      const contrast=await page.locator('.show-creator').evaluate(root=>{
        const luminance=(rgb:number[])=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        return [...root.querySelectorAll('input[type=text],button:disabled')].map(e=>{
          const style=getComputedStyle(e), fg=luminance(style.color.match(/[\d.]+/g)!.map(Number)), bg=luminance(style.backgroundColor.match(/[\d.]+/g)!.map(Number));
          return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
        });
      });
      expect(contrast.length).toBeGreaterThan(0);
      expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
    }
    expect(await page.locator('.show-console-v3 > .workspace-subtabs').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
    expect(await page.locator('.show-console-v3 > .workspace-subtabs button').evaluateAll(items=>items.every(e=>e.scrollWidth<=e.clientWidth+1))).toBe(true);
    await page.screenshot({path:info.outputPath(`show-${name.replaceAll(' ','-')}-${width}.png`)});
  }
});

test('fixture banks page without expanding the Live surface', async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('dmx-controller.patch.v1',JSON.stringify(Array.from({length:24},(_,i)=>({id:`f${i}`,name:`Fixture ${i+1}`,profileId:'adj-mega-par-profile-plus',modeId:'ch05',address:1+i*6,group:'Wash',selected:true,collapsed:false})))));
  await page.setViewportSize({width:820,height:760}); await page.goto('/');
  await page.getByRole('button',{name:'LIVE',exact:true}).click();
  await page.locator('.live-view-tabs').getByRole('button',{name:'Fixtures',exact:true}).click();
  const bank=page.locator('.fixture-bank-surface');
  await expect(bank.locator('nav > output')).toContainText('Bank 1 /');
  await expect(bank).toContainText('Fixture 1');
  expect(await bank.locator('.override-fader-bank > *').count()).toBeLessThanOrEqual(8);
  await bank.getByRole('button',{name:'Next',exact:true}).click();
  await expect(bank.locator('nav > output')).toContainText('Bank 2 /');
  await expect(bank.getByLabel('Fixture 1 brightness',{exact:true})).toHaveCount(0);
  expect(await bank.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
});

test('Creator, Cues and Timeline splitters resize and reset',async({page})=>{
  await seed(page); await page.setViewportSize({width:1400,height:900}); await page.goto('/');
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  for(const [mode,name,initial] of [['Show Creator','FX Library',310],['Cues','Rundown',250],['Timeline','Cue / FX Library',220]] as const) {
    await page.getByRole('button',{name:mode,exact:true}).click();
    const divider=page.getByRole('separator',{name:`Resize ${name} panel`});
    await expect(divider).toBeVisible();
    const before=Number(await divider.getAttribute('aria-valuenow'));
    await divider.focus(); await divider.press(name==='FX Library'?'ArrowLeft':'ArrowRight');
    expect(Number(await divider.getAttribute('aria-valuenow'))).toBe(before+10);
    await divider.dblclick(); await expect(divider).toHaveAttribute('aria-valuenow',String(initial));
  }
});

test('working songs and rig restart when compatibility storage is full or stale',async({page})=>{
  await seed(page); await page.goto('/');
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.locator('.show-console-v3 > .workspace-subtabs').getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Simulated localStorage full','QuotaExceededError');};});
  await page.getByLabel('New song name').fill('Quota Song');
  await page.getByRole('button',{name:'Add song',exact:true}).click();
  await expect(page.getByLabel('Song name Quota Song')).toBeVisible();
  await page.locator('.song-bank > .song-bank-list article').filter({has:page.getByLabel('Song name Quota Song')}).getByRole('button',{name:'Build song',exact:true}).click();
  await page.getByRole('button',{name:/Worship Song/}).click();
  await page.getByRole('button',{name:'Save Section Preset',exact:true}).click();
  await page.locator('.show-console-v3 > .workspace-subtabs').getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.reload();
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.locator('.show-console-v3 > .workspace-subtabs').getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.getByLabel('Song name Quota Song')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.getByRole('button',{name:'Show Creator',exact:true}).click();
  await expect(page.locator('.saved-section')).toHaveCount(1);
  await page.evaluate(()=>localStorage.setItem('dmx-controller.patch.v1','[]'));
  await page.reload();
  await page.getByRole('button',{name:'CREATE',exact:true}).click();
  await expect(page.locator('.console-browser')).toContainText('Wash 1');
});

test('zero trim height saves, and a corrupt workspace checkpoint is preserved',async({page})=>{
  await seed(page);
  await page.addInitScript(()=>{
    if(!localStorage.getItem('dmx-controller.stage-settings.v2')) localStorage.setItem('dmx-controller.stage-settings.v2',JSON.stringify({schemaVersion:2,unit:'meters',dimensions:{width:14,depth:9,height:6,trimHeight:0,roomWidth:20,roomDepth:20,roomHeight:8}}));
  });
  const readCheckpoint=()=>page.evaluate(()=>new Promise<any>((resolve,reject)=>{
    const open=indexedDB.open('lumarig-program-library',1);
    open.onsuccess=()=>{const db=open.result,request=db.transaction('state').objectStore('state').get('current');request.onsuccess=()=>{db.close();resolve(request.result);};request.onerror=()=>{db.close();reject(request.error);};};
    open.onerror=()=>reject(open.error);
  }));
  await page.goto('/'); await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  expect((await readCheckpoint()).workspace.stageSettings.dimensions.trimHeight).toBe(0);
  await page.reload(); await expect(page.getByRole('status')).toHaveText('Saved');
  expect((await readCheckpoint()).workspace.stageSettings.dimensions.trimHeight).toBe(0);
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const open=indexedDB.open('lumarig-program-library',1);
    open.onsuccess=()=>{const db=open.result,tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),request=store.get('current');request.onsuccess=()=>{const state=request.result;state.workspace.stageSettings.dimensions.trimHeight=-1;store.put(state,'current');};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};};
    open.onerror=()=>reject(open.error);
  }));
  const damaged=await readCheckpoint();
  await page.reload(); await page.getByRole('button',{name:'Show Library',exact:true}).click();
  await expect(page.locator('.show-recovery [role="status"]')).toHaveText('Save unavailable');
  await expect(page.getByRole('button',{name:'＋ New Show',exact:true})).toBeDisabled();
  expect(await readCheckpoint()).toEqual(damaged);
});

test('trimmed media, cached waveform and lane seeking survive Song reuse and restart', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await seed(page); await page.goto('/');
  await page.getByRole('button', { name:'SHOW', exact:true }).click();
  await page.getByRole('button', { name:'Show Creator', exact:true }).click();
  await page.getByRole('button', { name:/Worship Song/ }).click();
  await page.getByRole('button', { name:'Build / Update 8 Sections', exact:true }).click();
  await page.getByRole('button', { name:'Open Timeline ↗', exact:true }).click();
  await page.getByLabel('Load timeline audio').setInputFiles({ name:'trim-test.wav', mimeType:'audio/wav', buffer:wav() });
  await expect(page.getByLabel('Trim out seconds')).toHaveValue('3');
  await expect.poll(() => page.locator('.timeline-audio-block path').getAttribute('d')).toMatch(/M /);
  await page.getByLabel('Trim in seconds').fill('0.5');
  await page.getByLabel('Trim out seconds').fill('2');
  await expect.poll(async () => (await readShow(page)).timelineShows[0].timeline.audioTrimOutMs).toBe(2000);
  await page.getByRole('button', { name:'Rewind timeline' }).click();
  await page.getByRole('button', { name:'Play Show', exact:true }).click();
  await expect.poll(() => page.locator('audio').evaluate((a:HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0.5);
  await page.getByRole('button', { name:'Pause', exact:true }).click();
  const empty = page.locator('[data-lane="2"]');
  await empty.evaluate(el => el.parentElement!.scrollIntoView({ block:'center', inline:'nearest' }));
  await page.getByLabel('Timeline editing area').evaluate(el => { el.scrollLeft=0; });
  const laneBox=(await empty.boundingBox())!;
  await page.mouse.click(laneBox.x+54,laneBox.y+35);
  await expect(page.getByLabel('Timeline position')).toHaveText('BAR 2 · BEAT 3');
  await page.getByLabel('Timeline editing area').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Timeline position')).toHaveText('BAR 2 · BEAT 4');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByLabel('Timeline position')).toHaveText('BAR 3 · BEAT 4');
  await page.getByRole('button', { name:'Rewind timeline' }).click();
  await page.getByLabel('Jump to cue').selectOption({ index:2 });
  await expect(page.getByLabel('Timeline position')).toHaveText('BAR 9 · BEAT 1');
  const cacheCount = await page.evaluate(async () => new Promise<number>((resolve,reject) => {
    const request=indexedDB.open('lumarig-waveforms',1);
    request.onsuccess=()=>{const db=request.result;const tx=db.transaction('peaks');const count=tx.objectStore('peaks').count();count.onsuccess=()=>{resolve(count.result);db.close();};count.onerror=()=>reject(count.error);};
    request.onerror=()=>reject(request.error);
  }));
  expect(cacheCount).toBe(1);
  await page.reload();
  await page.getByRole('button', { name:'SHOW', exact:true }).click();
  await page.getByRole('button', { name:'Timeline', exact:true }).click();
  await expect(page.getByLabel('Trim in seconds')).toHaveValue('0.5');
  await expect(page.getByLabel('Trim out seconds')).toHaveValue('2');
  await expect.poll(() => page.locator('.timeline-audio-block path').getAttribute('d')).toMatch(/M /);
  await page.screenshot({ path:info.outputPath('trimmed-timeline.png') });
  await page.getByRole('button', { name:'Reset Trim', exact:true }).click();
  await expect(page.getByLabel('Trim in seconds')).toHaveValue('0');
  await expect(page.getByLabel('Trim out seconds')).toHaveValue('3');
  expect(errors).toEqual([]);
});

test('section layers keep independent settings, priority and Song library saves', async ({page},info)=>{
  await seed(page); await page.goto('/');
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Show Creator',exact:true}).click();
  await page.getByRole('button',{name:/Worship Song/}).click();
  await page.getByLabel('Search FX recipes').fill('Traveling');
  const recipe=page.locator('.recipe-list article').filter({hasText:'Traveling Wave'});
  await recipe.getByRole('button',{name:'＋ Layer',exact:true}).click();
  await recipe.getByRole('button',{name:'＋ Layer',exact:true}).click();
  await page.getByLabel('Layer 1 intensity',{exact:true}).fill('25');
  await page.getByLabel('Layer 1 color',{exact:true}).fill('#ff0000');
  await page.getByLabel('Layer 1 musical cycle').selectOption('0.25');
  await page.getByLabel('Layer 1 rate',{exact:true}).selectOption('2');
  await page.getByLabel('Layer 2 intensity',{exact:true}).fill('80');
  await page.getByLabel('Layer 2 color',{exact:true}).fill('#0000ff');
  await page.getByLabel('Layer 2 direction',{exact:true}).selectOption('reverse');
  await page.getByLabel('Section notes').fill('Audience hit on beat four');
  await page.getByRole('button',{name:'Move layer 2 up',exact:true}).click();
  await expect(page.getByLabel('Layer 1 intensity',{exact:true})).toHaveValue('80');
  await expect(page.getByLabel('Layer 2 intensity',{exact:true})).toHaveValue('25');
  await page.getByRole('button',{name:'Favorite Traveling Wave',exact:true}).click();
  await page.locator('.recipe-filters').getByRole('button',{name:'Favorites',exact:true}).click();
  await expect(page.locator('.recipe-list article')).toHaveCount(1);
  await page.getByRole('button',{name:'Save to Song Library',exact:true}).click();
  await expect.poll(async()=> (await readShow(page)).cues?.length).toBe(8);
  await page.getByRole('button',{name:'Song Bank',exact:true}).click();
  await expect(page.locator('.reusable-song-library article')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button',{name:'SHOW',exact:true}).click();
  await page.getByRole('button',{name:'Show Creator',exact:true}).click();
  await expect(page.getByLabel('Section notes')).toHaveValue('Audience hit on beat four');
  await expect(page.getByLabel('Layer 1 intensity',{exact:true})).toHaveValue('80');
  await page.screenshot({path:info.outputPath('section-layer-controls.png')});
});

test('Programmer exposes Visualizer-backed orthographic views and keeps them while zooming', async({page},info)=>{
  await seed(page); await page.goto('/');
  await page.getByRole('button',{name:'CREATE',exact:true}).click();
  await page.getByRole('button',{name:'Programmer',exact:true}).click();
  const viz=page.locator('.programmer-stage .visualizer-3d');
  for(const name of ['Top','Front','Side']){
    await viz.getByRole('button',{name,exact:true}).click();
    await expect(viz).toHaveAttribute('data-projection','orthographic');
    await viz.locator('canvas').hover();
    await page.mouse.wheel(0,80);
    await expect(viz).toHaveAttribute('data-camera',name.toLowerCase());
  }
  await viz.getByRole('button',{name:'Perspective',exact:true}).click();
  await expect(viz).toHaveAttribute('data-projection','perspective');
  await page.screenshot({path:info.outputPath('programmer-orthographic-views.png')});
});

test('video output follows source seeks and pauses without editor chrome',async({page,context})=>{
  await page.goto('/?media-output=1');
  const output=await context.newPage();
  await output.goto('/?media-output=1');
  const sourceUrl=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#224488';ctx.fillRect(0,0,320,180);
    const stream=canvas.captureStream(10),chunks:BlobPart[]=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
    const finished=new Promise<Blob>(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});
    let frame=0;
    const animation=setInterval(()=>{ctx.fillStyle=frame++%2?'#224488':'#448822';ctx.fillRect(0,0,320,180);},50);
    recorder.start();await new Promise(resolve=>setTimeout(resolve,1200));clearInterval(animation);recorder.stop();
    const blob=await finished;stream.getTracks().forEach(track=>track.stop());return URL.createObjectURL(blob);
  });
  await page.evaluate(url=>{
    const channel=new BroadcastChannel('lumarig-media-output-v1');
    channel.postMessage({type:'frame',state:{url,name:'video-test',position:.5,playing:false,sentAt:Date.now()}});
    setTimeout(()=>channel.close(),100);
  },sourceUrl);
  await expect.poll(()=>output.getByLabel('Synchronized video output').evaluate((el:HTMLVideoElement)=>el.currentTime)).toBeCloseTo(.5,1);
  expect(await output.getByLabel('Synchronized video output').evaluate((el:HTMLVideoElement)=>el.paused)).toBe(true);
  await expect(output.locator('.show-workspace')).toHaveCount(0);
  await expect(output.getByRole('button',{name:'Fullscreen',exact:true})).toBeAttached();
  await page.evaluate(url=>{
    const channel=new BroadcastChannel('lumarig-media-output-v1');
    channel.postMessage({type:'frame',state:{url,name:'video-test',position:.2,playing:true,sentAt:Date.now()}});
    setTimeout(()=>channel.close(),100);
  },sourceUrl);
  await expect.poll(()=>output.getByLabel('Synchronized video output').evaluate((el:HTMLVideoElement)=>el.currentTime)).toBeGreaterThan(.25);
  await page.evaluate(url=>{
    const channel=new BroadcastChannel('lumarig-media-output-v1');
    channel.postMessage({type:'frame',state:{url,name:'video-test',position:.7,playing:false,sentAt:Date.now()}});
    setTimeout(()=>channel.close(),100);
  },sourceUrl);
  await expect.poll(()=>output.getByLabel('Synchronized video output').evaluate((el:HTMLVideoElement)=>el.paused)).toBe(true);
  await expect.poll(()=>output.getByLabel('Synchronized video output').evaluate((el:HTMLVideoElement)=>el.currentTime)).toBeCloseTo(.7,1);
  await output.close();
});
