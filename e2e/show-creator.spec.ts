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
  await page
    .getByRole("button", { name: "Preview Section", exact: true })
    .click();
  await page.getByRole("button", { name: "Stop Preview", exact: true }).click();
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
    .poll(async () => ((await readShow(page)).timeline ?? {}).audioOffsetBars)
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
    "relink audio",
  );
  expect((await readShow(page)).timeline.audioOffsetBars).toBe(1);
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
        .locator(".programmer-attribute-deck-v4>.color-deck")
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

test('color input, compact panels and detached stage follow actual output', async ({page},info)=>{
 await seed(page);await page.goto('/');
 await page.getByRole('button',{name:'CREATE',exact:true}).click();
 await page.getByRole('button',{name:'Programmer',exact:true}).click();
 await expect(page.locator('.position-module')).toHaveCount(0);
 const hue=page.getByRole('slider',{name:'Color hue',exact:true});
 await hue.fill('120');
 await expect(page.locator('.selected-color-readout strong')).toHaveText('#00FF00');
 const wheel=page.getByRole('slider',{name:'Color wheel',exact:true});await wheel.click({position:{x:39,y:5}});
 await page.getByRole('button',{name:'Stage Monitor',exact:true}).click();
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
 await page.getByRole('button',{name:'Stage Monitor',exact:true}).click();
 await page.getByRole('button',{name:'Play Show',exact:true}).click();
 await expect.poll(()=>page.locator('.floating-stage-monitor [data-fixture="f0"]').getAttribute('data-level')).not.toBe('0');
 await page.getByRole('button',{name:'Stop / Rewind',exact:true}).click();
 console.log('VISUAL_REVIEW_CUES:'+ (await page.screenshot({type:'jpeg',quality:55})).toString('base64'));
 await page.getByRole('button',{name:'Close stage monitor',exact:true}).click();
 await page.getByRole('button',{name:'Close timeline',exact:true}).click();
 const show=await readShow(page);show.name='Imported Song';
 await page.getByLabel('Import timeline show',{exact:true}).setInputFiles({name:'song.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(show))});
 await expect(page.locator('.song-cue-group')).toHaveCount(2);
 await expect.poll(async()=>((await readShow(page)).timelineShows??[]).length).toBe(1);
 await page.getByRole('button',{name:'Open timeline for Imported Song',exact:true}).click();
 await expect(page.locator('.timeline-clip')).toHaveCount(8);
 await page.reload();await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.getByRole('button',{name:'Cues',exact:true}).click();
 await expect(page.locator('.song-cue-group')).toHaveCount(2);
 expect((await readShow(page)).timelineShows[0].timeline.clips).toHaveLength(8);
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
 console.log('VISUAL_REVIEW_LIVE:'+ (await page.screenshot({type:'jpeg',quality:55})).toString('base64'));
 await page.getByRole('button',{name:'SHOW',exact:true}).click();
 await page.locator('.show-subtabs').getByRole('button',{name:'Timeline',exact:true}).click();
 const data=await page.evaluateHandle(bytes=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(bytes)],'drop-song.wav',{type:''}));return d;},Array.from(wav()));
 await page.locator('.show-bar-timeline').dispatchEvent('drop',{dataTransfer:data});
 await expect(page.locator('.timeline-audio-block')).toContainText('drop-song.wav');
 await page.locator('audio').evaluate(el=>{el.setAttribute('data-seeks','0');el.addEventListener('seeking',()=>el.setAttribute('data-seeks',String(Number(el.getAttribute('data-seeks'))+1)));});
 await page.getByRole('button',{name:'Play Show',exact:true}).click();
 await expect.poll(()=>page.locator('audio').evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(1.5);
 expect(Number(await page.locator('audio').getAttribute('data-seeks'))).toBeLessThanOrEqual(1);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
});
