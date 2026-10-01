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
      targetPosition: { x: 72, y: 25 },
    });
  await expect(page.locator(".timeline-clip")).toHaveCount(9);
  await expect(page.getByLabel("Clip lane")).toHaveValue("2");
  await page.getByRole("button", { name: "Delete Clip", exact: true }).click();
  await expect(page.locator(".timeline-clip")).toHaveCount(8);
  const clip = page.locator(".timeline-clip").first();
  await clip.scrollIntoViewIfNeeded();
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
  await expect(page.locator(".timeline-toolbar output")).toHaveText("BAR 1.00");
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
    expect(center.x + center.width).toBeLessThanOrEqual(fx.x + 1);
    expect(fx.x + fx.width).toBeLessThanOrEqual(width);
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
 const intensityBox=(await intensity.boundingBox())!;
 await colorHandle.dragTo(intensity,{targetPosition:{x:4,y:Math.max(4,intensityBox.height/2)}});
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
 const separator=page.getByRole('separator',{name:'Resize left panel'});
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
 await page.getByRole('button',{name:'Song Bank',exact:true}).click();
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
