const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  title: "未命名画册",
  width: 210,
  height: 280,
  pages: 12,
  currentSpread: 0,
  preset: "custom",
  images: [],
  pageImages: [],
  physicalPages: [],
  layoutSpreads: [],
  interiorItems: [],
  itemLocations: {},
  coverImage: null,
  backCoverImage: null,
  wrapCoverImage: null,
  panoramas: {},
  zoom: 1,
  fillPages: true,
  texture: true,
  margins: false,
  marginValues: { top: 10, right: 10, bottom: 12, left: 12 },
  bleed: 3,
  guides: false,
  spreadMode: true,
  binding: "left",
  quality: "high",
  view: "flip",
  isFlipping: false,
  presentation: false,
  draggedImageIndex: null,
  modelRotation: { x: -8, y: -17 },
  modelZoom: 1,
};

const imageCache = new Map();
let modelCanvasRedrawTimer = null;

const presetSizes = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  square: { width: 210, height: 210 },
};

const artColors = ["#c66748", "#d5a743", "#557765", "#805a74", "#c27a50", "#5e7681", "#a65a44"];

const els = {
  root: document.documentElement,
  pageList: $("#pageList"),
  pageCountBadge: $("#pageCountBadge"),
  assetStrip: $("#assetStrip"),
  assetCount: $("#assetCount"),
  uploadButton: $("#uploadButton"),
  fileInput: $("#fileInput"),
  coverUploadButton: $("#coverUploadButton"),
  backCoverUploadButton: $("#backCoverUploadButton"),
  wrapCoverUploadButton: $("#wrapCoverUploadButton"),
  coverInput: $("#coverInput"),
  backCoverInput: $("#backCoverInput"),
  wrapCoverInput: $("#wrapCoverInput"),
  spreadUploadButton: $("#spreadUploadButton"),
  spreadInput: $("#spreadInput"),
  spreadAssetStatus: $("#spreadAssetStatus"),
  coverPreview: $("#coverPreview"),
  backCoverPreview: $("#backCoverPreview"),
  wrapCoverPreview: $("#wrapCoverPreview"),
  removeCoverButton: $("#removeCoverButton"),
  removeBackCoverButton: $("#removeBackCoverButton"),
  removeWrapCoverButton: $("#removeWrapCoverButton"),
  nameInput: $("#nameInput"),
  documentName: $("#documentName"),
  widthInput: $("#widthInput"),
  heightInput: $("#heightInput"),
  pagesInput: $("#pagesInput"),
  pagesHelp: $("#pagesHelp"),
  pagesMinusButton: $("#pagesMinusButton"),
  pagesPlusButton: $("#pagesPlusButton"),
  ratioLabel: $("#ratioLabel"),
  presetGrid: $("#presetGrid"),
  book: $("#book"),
  bookScene: $("#bookScene"),
  leftPage: $("#leftPage"),
  rightPage: $("#rightPage"),
  flipLeaf: $("#flipLeaf"),
  flipFront: $("#flipFront"),
  flipBack: $("#flipBack"),
  panoramaLayer: $("#panoramaLayer"),
  flipView: $("#flipView"),
  modelView: $("#modelView"),
  modelStage: $("#modelStage"),
  modelScene: $("#modelScene"),
  modelBook: $("#modelBook"),
  modelBackCoverContent: $("#modelBackCoverContent"),
  modelFrontCoverPreview: $("#modelFrontCoverPreview"),
  modelBackCoverPreview: $("#modelBackCoverPreview"),
  modelFrontCoverPreviewCanvas: $("#modelFrontCoverPreviewCanvas"),
  modelBackCoverPreviewCanvas: $("#modelBackCoverPreviewCanvas"),
  modelLeftPage: $("#modelLeftPage"),
  modelRightPage: $("#modelRightPage"),
  modelFlipLeaf: $("#modelFlipLeaf"),
  modelFlipFront: $("#modelFlipFront"),
  modelFlipBack: $("#modelFlipBack"),
  modelPanoramaLayer: $("#modelPanoramaLayer"),
  modelResetButton: $("#modelResetButton"),
  modelThicknessInfo: $("#modelThicknessInfo"),
  overviewView: $("#overviewView"),
  spreadGrid: $("#spreadGrid"),
  stage: $("#stage"),
  zoomLabel: $("#zoomLabel"),
  currentSpreadLabel: $("#currentSpreadLabel"),
  currentPageLabel: $("#currentPageLabel"),
  progressBar: $("#progressBar"),
  prevButton: $("#prevButton"),
  nextButton: $("#nextButton"),
  footerNav: $(".spread-nav"),
  prevZone: $("#prevZone"),
  nextZone: $("#nextZone"),
  firstButton: $("#firstButton"),
  lastButton: $("#lastButton"),
  dragOverlay: $("#dragOverlay"),
  presentationOverlay: $("#presentationOverlay"),
  presentationStage: $("#presentationStage"),
  presentationTitle: $("#presentationTitle"),
  presentationCounter: $("#presentationCounter"),
  presentationPrev: $("#presentationPrev"),
  presentationNext: $("#presentationNext"),
  shortcutModal: $("#shortcutModal"),
  toastRegion: $("#toastRegion"),
  fileStatus: $("#fileStatus"),
  marginsToggle: $("#marginsToggle"),
  marginTopInput: $("#marginTopInput"),
  marginRightInput: $("#marginRightInput"),
  marginBottomInput: $("#marginBottomInput"),
  marginLeftInput: $("#marginLeftInput"),
  bleedInput: $("#bleedInput"),
  coverToggle: $("#coverToggle"),
  textureToggle: $("#textureToggle"),
  guidesButton: $("#guidesButton"),
  spreadButton: $("#spreadButton"),
  flipNav: $("#flipNav"),
  flipNavIndex: $("#flipNavIndex"),
  viewerPrevButton: $("#viewerPrevButton"),
  viewerNextButton: $("#viewerNextButton"),
  detailLoupe: $("#detailLoupe"),
  detailLoupeImage: $("#detailLoupeImage"),
  qualityHelp: $("#qualityHelp"),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lockViewportScroll() {
  if (window.scrollY !== 0) window.scrollTo(0, 0);
  if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0;
  if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageImageAt(index) {
  return state.physicalPages[index]?.image ?? null;
}

function coverFaceSource(face) {
  const directImage = face === "front" ? state.coverImage : state.backCoverImage;
  if (directImage) return { image: directImage, crop: null };
  if (state.wrapCoverImage) {
    const frontIsRightHalf = state.binding === "left";
    const shouldUseRightHalf = face === "front" ? frontIsRightHalf : !frontIsRightHalf;
    return {
      image: state.wrapCoverImage,
      crop: shouldUseRightHalf ? "right" : "left",
    };
  }
  return { image: null, crop: null };
}

function syncPageSlots() {
  const demoPageCount = Math.max(0, state.pages - 4);
  const units = state.interiorItems.length
    ? state.interiorItems
    : Array.from({ length: demoPageCount }, (_, index) => ({
        id: `demo-page-${index}`,
        type: "page",
        image: null,
        demo: true,
      }));
  const physicalPages = [];
  const layoutSpreads = [];
  const panoramas = {};
  const locations = {};
  let nextInnerNumber = 1;

  const pushPage = (page) => {
    physicalPages.push(page);
    return physicalPages.length - 1;
  };
  const pushSpread = (spread) => {
    layoutSpreads.push(spread);
    return layoutSpreads.length - 1;
  };
  const padded = (number) => String(number).padStart(2, "0");

  const frontFace = coverFaceSource("front");
  const backFace = coverFaceSource("back");
  const frontCoverIndex = pushPage({
    kind: "front-cover",
    image: frontFace.image,
    crop: frontFace.crop,
    label: "封面",
  });
  pushSpread({ kind: "front-cover", pageIndex: frontCoverIndex, label: "封面" });

  const coverReverseIndex = pushPage({
    kind: "pure-blank",
    image: null,
    label: "封面反面",
  });
  pushSpread({
    kind: "cover-reverse",
    pageIndex: coverReverseIndex,
    label: "封面反面",
    note: "纯空白",
  });

  if (units.length) {
    const firstUnit = units[0];
    if (firstUnit.type === "panorama") {
      const firstNumber = nextInnerNumber;
      const leftPageIndex = pushPage({
        kind: "panorama-half",
        image: firstUnit.image,
        innerNumber: firstNumber,
        itemId: firstUnit.id,
      });
      const rightPageIndex = pushPage({
        kind: "panorama-half",
        image: firstUnit.image,
        innerNumber: firstNumber + 1,
        itemId: firstUnit.id,
      });
      const spreadIndex = pushSpread({
        kind: "panorama",
        leftPageIndex,
        rightPageIndex,
        label: `内页 ${padded(firstNumber)}–${padded(firstNumber + 1)}`,
      });
      panoramas[spreadIndex] = firstUnit.image;
      locations[firstUnit.id] = {
        spreadIndex,
        startInner: firstNumber,
        endInner: firstNumber + 1,
      };
      nextInnerNumber += 2;
    } else {
      const firstNumber = nextInnerNumber;
      const pageIndex = pushPage({
        kind: "inner-page",
        image: firstUnit.image,
        innerNumber: firstNumber,
        itemId: firstUnit.id,
      });
      const spreadIndex = pushSpread({
        kind: "single-inner",
        pageIndex,
        label: `内页 ${padded(firstNumber)}`,
      });
      if (!firstUnit.demo) {
        locations[firstUnit.id] = {
          spreadIndex,
          startInner: firstNumber,
          endInner: firstNumber,
        };
      }
      nextInnerNumber += 1;
    }

    let pending = [];
    const flushPendingPair = () => {
      const [first, second] = pending;
      const spreadIndex = pushSpread({
        kind: "inner-spread",
        leftPageIndex: first.pageIndex,
        rightPageIndex: second.pageIndex,
        label: `内页 ${padded(first.innerNumber)}–${padded(second.innerNumber)}`,
      });
      [first, second].forEach((entry) => {
        if (!entry.unit.demo) {
          locations[entry.unit.id] = {
            spreadIndex,
            startInner: entry.innerNumber,
            endInner: entry.innerNumber,
          };
        }
      });
      pending = [];
    };

    units.slice(1).forEach((unit) => {
      if (unit.type === "panorama") {
        if (pending.length === 1) {
          const single = pending.pop();
          const spreadIndex = pushSpread({
            kind: "single-inner",
            pageIndex: single.pageIndex,
            label: `内页 ${padded(single.innerNumber)}`,
          });
          if (!single.unit.demo) {
            locations[single.unit.id] = {
              spreadIndex,
              startInner: single.innerNumber,
              endInner: single.innerNumber,
            };
          }
        }
        const firstNumber = nextInnerNumber;
        const leftPageIndex = pushPage({
          kind: "panorama-half",
          image: unit.image,
          innerNumber: firstNumber,
          itemId: unit.id,
        });
        const rightPageIndex = pushPage({
          kind: "panorama-half",
          image: unit.image,
          innerNumber: firstNumber + 1,
          itemId: unit.id,
        });
        const spreadIndex = pushSpread({
          kind: "panorama",
          leftPageIndex,
          rightPageIndex,
          label: `内页 ${padded(firstNumber)}–${padded(firstNumber + 1)}`,
        });
        panoramas[spreadIndex] = unit.image;
        locations[unit.id] = {
          spreadIndex,
          startInner: firstNumber,
          endInner: firstNumber + 1,
        };
        nextInnerNumber += 2;
        return;
      }

      const innerNumber = nextInnerNumber;
      const pageIndex = pushPage({
        kind: "inner-page",
        image: unit.image,
        innerNumber,
        itemId: unit.id,
      });
      pending.push({ unit, pageIndex, innerNumber });
      nextInnerNumber += 1;
      if (pending.length === 2) flushPendingPair();
    });

    if (pending.length === 1) {
      const single = pending.pop();
      const spreadIndex = pushSpread({
        kind: "single-inner",
        pageIndex: single.pageIndex,
        label: `内页 ${padded(single.innerNumber)}`,
      });
      if (!single.unit.demo) {
        locations[single.unit.id] = {
          spreadIndex,
          startInner: single.innerNumber,
          endInner: single.innerNumber,
        };
      }
    }
  }

  const backReverseIndex = pushPage({
    kind: "pure-blank",
    image: null,
    label: "封底反面",
  });
  pushSpread({
    kind: "back-reverse",
    pageIndex: backReverseIndex,
    label: "封底反面",
    note: "纯空白",
  });

  const backCoverIndex = pushPage({
    kind: "back-cover",
    image: backFace.image,
    crop: backFace.crop,
    label: "封底",
  });
  pushSpread({ kind: "back-cover", pageIndex: backCoverIndex, label: "封底" });

  state.physicalPages = physicalPages;
  state.layoutSpreads = layoutSpreads;
  state.pages = physicalPages.length;
  state.pageImages = physicalPages.map((page) => page.image ?? null);
  state.panoramas = panoramas;
  state.itemLocations = locations;
  els.pagesInput.value = state.pages;
  updatePageCountControls();
}

function updatePageCountControls() {
  const automatic = state.interiorItems.length > 0;
  els.pagesInput.readOnly = automatic;
  els.pagesInput.title = automatic ? "页数根据内页和跨页大图自动计算" : "";
  els.pagesMinusButton.disabled = automatic;
  els.pagesPlusButton.disabled = automatic;
  els.pagesHelp.textContent = automatic
    ? "已自动计算：封面 1 页 + 内页内容 + 封底 1 页；跨页大图占 2 页。"
    : "上传图片后将自动计算总页数。";
}

function blankPageMarkup(index) {
  return `
    <div class="page-fallback blank-page">
      <span class="fallback-index">PAGE ${String(index + 1).padStart(2, "0")}</span>
    </div>
  `;
}

function artPageMarkup(index) {
  const pageNumber = index + 1;
  return `
    <div class="page-fallback art-page" style="--art-color:${artColors[index % artColors.length]}">
      <div class="art-shape"></div>
      <div class="art-circle"></div>
      <div class="art-copy">
        <span class="art-kicker">FORM / ${String(pageNumber).padStart(2, "0")}</span>
        <div class="art-title">${index === 2 ? "留白也是\\n画面的一部分" : "形态与秩序"}</div>
      </div>
      <span class="fallback-index">FOLIO COLLECTION — 2026</span>
    </div>
  `;
}

function coverMarkup() {
  return `
    <div class="page-fallback cover-page">
      <div class="cover-field"></div>
      <div class="cover-orbit"></div>
      <div class="cover-disc"></div>
      <div class="cover-copy">
        <span class="cover-kicker">VISUAL ARCHIVE / VOL. 01</span>
        <div class="cover-title">${escapeHtml(state.title)}</div>
        <span class="cover-subtitle">一本关于形态、留白与秩序的书。</span>
      </div>
      <div class="cover-footer">
        <span>FOLIO EDITIONS</span>
        <span>MMXXVI</span>
      </div>
    </div>
  `;
}

function backCoverMarkup() {
  return `
    <div class="page-fallback back-cover-page">
      <div class="back-cover-grid" aria-hidden="true"></div>
      <div class="back-cover-copy">
        <span>FOLIO EDITIONS / MMXXVI</span>
        <strong>${escapeHtml(state.title)}</strong>
        <p>形态、留白与秩序之间的视觉记录。</p>
      </div>
      <div class="back-cover-mark" aria-hidden="true">
        <span>F</span>
        <i>${String(state.pages).padStart(3, "0")} PAGES</i>
      </div>
    </div>
  `;
}

function pureBlankPageMarkup() {
  return '<div class="page-fallback pure-blank-page"></div>';
}

function pageContent(index, options = {}) {
  const {
    includeNumber = true,
    highResolution = false,
  } = options;
  const page = state.physicalPages[index];
  const image = page?.image ?? null;
  const pageKind = page?.kind;
  const crop = page?.crop ?? "";
  const isCover = pageKind === "front-cover";
  const isBackCover = pageKind === "back-cover";
  const objectPosition = crop === "left" ? "left center" : crop === "right" ? "right center" : "center center";
  let content;

  if (pageKind === "pure-blank") {
    content = pureBlankPageMarkup();
  } else if (isCover && !image) {
    content = coverMarkup();
  } else if (isBackCover && !image) {
    content = backCoverMarkup();
  } else if (image) {
    content = highResolution
      ? `
        <div class="page-media">
          <canvas class="hd-page-canvas" data-src="${escapeHtml(image.url)}" data-crop="${crop}" aria-label="第 ${index + 1} 页高清预览"></canvas>
        </div>
      `
      : `
        <div class="page-media">
          <img src="${escapeHtml(image.url)}" alt="第 ${index + 1} 页图片" style="object-position:${objectPosition}" draggable="false" />
        </div>
      `;
  } else if (index % 3 === 1) {
    content = blankPageMarkup(index);
  } else {
    content = artPageMarkup(index);
  }

  const margin = state.marginValues;
  const marginStyle = `top:${(margin.top / state.height) * 100}%;right:${
    (margin.right / state.width) * 100
  }%;bottom:${(margin.bottom / state.height) * 100}%;left:${(margin.left / state.width) * 100}%`;
  const bleedStyle = `top:${(state.bleed / state.height) * 100}%;right:${
    (state.bleed / state.width) * 100
  }%;bottom:${(state.bleed / state.height) * 100}%;left:${(state.bleed / state.width) * 100}%`;

  return `
    ${content}
    <div class="page-margins" style="${marginStyle}" aria-hidden="true"></div>
    <div class="bleed-guide" style="${bleedStyle}" aria-hidden="true"></div>
    <div class="guide-corners" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    ${includeNumber && pageKind === "inner-page" ? `<span class="page-number">${String(page.innerNumber).padStart(2, "0")}</span>` : ""}
  `;
}

function loadImageSource(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}

function drawHighResolutionCanvases(root) {
  $$(".hd-page-canvas", root).forEach((canvas) => {
    const url = canvas.dataset.src;
    const container = canvas.parentElement;
    const cssWidth = Math.max(1, Math.round(canvas.clientWidth || container?.clientWidth || 1));
    const cssHeight = Math.max(1, Math.round(canvas.clientHeight || container?.clientHeight || 1));
    const isModelCanvas = Boolean(root.closest?.("#modelBook"));
    const deviceScale = Math.min(2, window.devicePixelRatio || 1);
    const perspectiveScale = Math.max(
      0.5,
      Math.abs(Math.cos((state.modelRotation.y * Math.PI) / 180))
    );
    const multiplier = isModelCanvas
      ? clamp(state.modelZoom * deviceScale * perspectiveScale, 0.75, 4)
      : state.quality === "halftone"
        ? 5
        : state.quality === "high"
          ? 4
          : 2.5;
    const maxDimension = 3800;
    const scale = Math.min(multiplier, maxDimension / Math.max(cssWidth, cssHeight));
    canvas.width = Math.max(1, Math.round(cssWidth * scale));
    canvas.height = Math.max(1, Math.round(cssHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    context.fillStyle = "#fbfaf4";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    loadImageSource(url)
      .then((image) => {
        if (!canvas.isConnected) return;
        const scaleMode = canvas.dataset.fit || (state.fillPages ? "cover" : "contain");
        const sourceRatio = image.naturalWidth / image.naturalHeight;
        const targetRatio = canvas.width / canvas.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (scaleMode === "cover") {
          if (sourceRatio > targetRatio) {
            drawHeight = canvas.height;
            drawWidth = drawHeight * sourceRatio;
          } else {
            drawWidth = canvas.width;
            drawHeight = drawWidth / sourceRatio;
          }
        } else if (sourceRatio > targetRatio) {
          drawWidth = canvas.width;
          drawHeight = drawWidth / sourceRatio;
        } else {
          drawHeight = canvas.height;
          drawWidth = drawHeight * sourceRatio;
        }
        const crop = canvas.dataset.crop;
        offsetX =
          crop === "left"
            ? 0
            : crop === "right"
              ? canvas.width - drawWidth
              : (canvas.width - drawWidth) / 2;
        offsetY = (canvas.height - drawHeight) / 2;
        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      })
      .catch(() => {
        canvas.setAttribute("aria-label", "图片加载失败");
      });
  });
}

function scheduleHighResolutionDraw(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => drawHighResolutionCanvases(root)));
}

function scheduleModelCanvasRedraw() {
  if (state.view !== "model") return;
  window.clearTimeout(modelCanvasRedrawTimer);
  modelCanvasRedrawTimer = window.setTimeout(() => {
    scheduleHighResolutionDraw(els.modelBook);
    scheduleHighResolutionDraw(els.modelFlipLeaf);
  }, 120);
}

function spreadCount() {
  return state.layoutSpreads.length;
}

function pagesForSpread(spreadIndex) {
  const spread = state.layoutSpreads[spreadIndex];
  if (!spread) return { left: null, right: null };
  if (spread.kind === "inner-spread" || spread.kind === "panorama") {
    return { left: spread.leftPageIndex, right: spread.rightPageIndex };
  }
  return state.binding === "right"
    ? { left: spread.pageIndex, right: null }
    : { left: null, right: spread.pageIndex };
}

function visualPair(pair) {
  if (state.binding !== "right" || pair.left === null || pair.right === null) return pair;
  return { left: pair.right, right: pair.left };
}

function spreadPairLabel(spreadIndex) {
  return state.layoutSpreads[spreadIndex]?.label ?? "页面";
}

function isClosedSpread(spreadIndex) {
  const pair = pagesForSpread(spreadIndex);
  return pair.left === null || pair.right === null;
}

function setBookDimensions() {
  const stageRect = els.stage.getBoundingClientRect();
  const ratio = state.width / state.height;
  const availableWidth = Math.max(250, stageRect.width - 180);
  const availableHeight = Math.max(240, stageRect.height - 130);

  let width;
  let height;
  if (state.spreadMode && !isClosedSpread(state.currentSpread)) {
    width = Math.min(availableWidth, availableHeight * ratio * 2);
    height = width / (ratio * 2);
  } else {
    width = Math.min(availableWidth * 0.72, availableHeight * ratio);
    height = width / ratio;
  }
  if (height > availableHeight * 0.93) {
    height = availableHeight * 0.93;
    width = height * ratio * (state.spreadMode && !isClosedSpread(state.currentSpread) ? 2 : 1);
  }

  const renderedWidth = Math.round(width / 2) * 2;
  const renderedHeight = Math.round(height);
  els.bookScene.style.setProperty("--book-width", `${renderedWidth}px`);
  els.bookScene.style.setProperty("--book-height", `${renderedHeight}px`);
  els.book.style.setProperty("--book-width", `${renderedWidth}px`);
  els.book.style.setProperty("--book-height", `${renderedHeight}px`);

  const fitZoom = state.zoom === "fit" ? 1 : state.zoom;
  els.bookScene.style.setProperty("--zoom", fitZoom);
  els.zoomLabel.textContent = state.zoom === "fit" ? "适合" : `${Math.round(state.zoom * 100)}%`;
}

function panoramaForSpread(spreadIndex) {
  return state.panoramas[spreadIndex] ?? null;
}

function renderPanoramaLayer(layer, spreadIndex) {
  const panorama = panoramaForSpread(spreadIndex);
  if (!panorama || spreadIndex === 0 || spreadIndex === spreadCount() - 1) {
    layer.hidden = true;
    layer.replaceChildren();
    return;
  }
  layer.hidden = false;
  layer.innerHTML = `<canvas class="hd-page-canvas" data-src="${escapeHtml(
    panorama.url
  )}" aria-label="跨页大图预览"></canvas>`;
  scheduleHighResolutionDraw(layer);
}

function renderBook(animate = false, direction = "next") {
  if (state.isFlipping) return;
  const pair = pagesForSpread(state.currentSpread);
  const orderedPair = visualPair(pair);
  const currentSpread = state.layoutSpreads[state.currentSpread];
  const isCover = currentSpread?.kind === "front-cover";
  const isBackCover = currentSpread?.kind === "back-cover";
  const isSingle = !state.spreadMode && !isClosedSpread(state.currentSpread);
  els.book.classList.toggle("is-cover", isCover);
  els.book.classList.toggle("is-back-cover", isBackCover);
  els.book.classList.toggle("is-single", isSingle);
  els.book.classList.toggle("binding-right", state.binding === "right");
  els.book.dataset.spread = state.currentSpread;
  const displayPair =
    isSingle && !isClosedSpread(state.currentSpread)
      ? { left: null, right: orderedPair.right ?? orderedPair.left }
      : orderedPair;
  els.book.classList.toggle("is-left-only", displayPair.left !== null && displayPair.right === null);
  els.book.classList.toggle("is-right-only", displayPair.left === null && displayPair.right !== null);
  els.bookPageLeftContent = displayPair.left;
  els.bookPageRightContent = displayPair.right;

  const renderInto = (element, index) => {
    element.dataset.pageIndex = index ?? "";
    if (index === null || index >= state.pages) {
      element.innerHTML = '<div class="page-fallback blank-page"></div>';
      return;
    }
    element.innerHTML = pageContent(index, { highResolution: true });
  };

  if (!animate) {
    renderInto(els.leftPage, displayPair.left);
    renderInto(els.rightPage, displayPair.right);
    renderPanoramaLayer(els.panoramaLayer, state.currentSpread);
    scheduleHighResolutionDraw(els.book);
    updateBookDecorations();
    setBookDimensions();
    return;
  }

  state.isFlipping = true;
  const sourcePair = pagesForSpread(
    clamp(state.currentSpread + (direction === "next" ? -1 : 1), 0, spreadCount() - 1)
  );
  const outgoingPage =
    direction === "next" ? sourcePair.right ?? sourcePair.left : sourcePair.left ?? sourcePair.right;
  const incomingPage =
    direction === "next" ? pair.left ?? pair.right : pair.right ?? pair.left;
  els.flipFront.innerHTML = pageContent(outgoingPage ?? 0);
  els.flipBack.innerHTML = pageContent(incomingPage ?? 0);
  const flipStyle = state.binding === "right" ? `rtl-${direction}` : `flip-${direction}`;
  els.flipLeaf.className = `flip-leaf is-flipping ${flipStyle}`;
  scheduleHighResolutionDraw(els.flipLeaf);

  window.setTimeout(() => {
    renderInto(els.leftPage, displayPair.left);
    renderInto(els.rightPage, displayPair.right);
    renderPanoramaLayer(els.panoramaLayer, state.currentSpread);
    scheduleHighResolutionDraw(els.book);
    updateBookDecorations();
    setBookDimensions();
  }, 250);

  els.flipLeaf.addEventListener(
    "animationend",
    () => {
      els.flipLeaf.className = "flip-leaf";
      state.isFlipping = false;
    },
    { once: true }
  );
}

function setModelDimensions() {
  const rect = els.modelView.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;
  const ratio = state.width / state.height;
  const isSinglePage = isClosedSpread(state.currentSpread) || !state.spreadMode;
  const availableWidth = Math.max(220, rect.width * 0.66);
  const availableHeight = Math.max(220, rect.height - 160);
  let width;
  let height;

  if (isSinglePage) {
    width = Math.min(availableWidth * 0.78, availableHeight * ratio);
    height = width / ratio;
  } else {
    width = Math.min(availableWidth, availableHeight * ratio * 2);
    height = width / (ratio * 2);
  }

  const pageWidth = isSinglePage ? width : width / 2;
  const pixelsPerMillimeter = pageWidth / state.width;
  const sheetCount = Math.ceil(state.pages / 2);
  const paperThicknessMm = sheetCount * 0.12 + 1.2;
  const depth = clamp(paperThicknessMm * pixelsPerMillimeter, 4, 48);
  els.modelBook.style.setProperty("--model-width", `${Math.round(width / 2) * 2}px`);
  els.modelBook.style.setProperty("--model-book-height", `${Math.round(height)}px`);
  els.modelStage.style.setProperty("--model-cover-ratio", state.width / state.height);
  els.modelBook.style.setProperty("--model-depth", `${depth.toFixed(1)}px`);
  els.modelThicknessInfo.textContent = `${state.pages} 页 · ${sheetCount} 张纸 · 约 ${paperThicknessMm.toFixed(
    1
  )} mm`;
}

function renderModelCoverPreviews() {
  const faces = [
    ["front", els.modelFrontCoverPreviewCanvas],
    ["back", els.modelBackCoverPreviewCanvas],
  ];
  faces.forEach(([face, container]) => {
    const source = coverFaceSource(face);
    if (!source.image) {
      container.innerHTML = face === "front" ? coverMarkup() : backCoverMarkup();
      return;
    }
    container.innerHTML = `<canvas class="hd-page-canvas" data-src="${escapeHtml(
      source.image.url
    )}" data-crop="${source.crop ?? ""}" data-fit="contain" aria-label="${
      face === "front" ? "封面预览" : "封底预览"
    }"></canvas>`;
  });
  scheduleHighResolutionDraw(els.modelFrontCoverPreview);
  scheduleHighResolutionDraw(els.modelBackCoverPreview);
}

function updateModelTransform() {
  els.modelBook.style.setProperty("--model-rot-x", `${state.modelRotation.x}deg`);
  els.modelBook.style.setProperty("--model-rot-y", `${state.modelRotation.y}deg`);
  els.modelBook.style.setProperty("--model-zoom", state.modelZoom);
  const normalizedY = ((state.modelRotation.y % 360) + 360) % 360;
  els.modelBook.classList.toggle(
    "show-back-cover",
    normalizedY > 82 && normalizedY < 278
  );
  scheduleModelCanvasRedraw();
}

function renderModel(animate = false, direction = "next") {
  const pair = pagesForSpread(state.currentSpread);
  const orderedPair = visualPair(pair);
  const currentSpread = state.layoutSpreads[state.currentSpread];
  const isCover = currentSpread?.kind === "front-cover";
  const isBackCover = currentSpread?.kind === "back-cover";
  const isSingle = !state.spreadMode && !isClosedSpread(state.currentSpread);
  const displayPair =
    isSingle && !isClosedSpread(state.currentSpread)
      ? { left: null, right: orderedPair.right ?? orderedPair.left }
      : orderedPair;

  els.modelBook.classList.toggle("is-cover", isCover);
  els.modelBook.classList.toggle("is-back-cover", isBackCover);
  els.modelBook.classList.toggle("is-single", isSingle);
  els.modelBook.classList.toggle("binding-right", state.binding === "right");
  els.modelBook.classList.toggle(
    "is-left-only",
    displayPair.left !== null && displayPair.right === null
  );
  els.modelBook.classList.toggle(
    "is-right-only",
    displayPair.left === null && displayPair.right !== null
  );

  const renderInto = (element, index) => {
    element.dataset.pageIndex = index ?? "";
    if (index === null || index >= state.pages) {
      element.innerHTML = '<div class="page-fallback blank-page"></div>';
      return;
    }
    element.innerHTML = pageContent(index, { highResolution: true });
  };

  const renderTargetPages = () => {
    renderInto(els.modelLeftPage, displayPair.left);
    renderInto(els.modelRightPage, displayPair.right);
    renderPanoramaLayer(els.modelPanoramaLayer, state.currentSpread);
    const backIndex = state.pages - 1;
    const backPage = state.physicalPages[backIndex];
    const backImage = backPage?.image ?? null;
    els.modelBackCoverContent.innerHTML = backImage
      ? `<div class="page-media"><canvas class="hd-page-canvas" data-src="${escapeHtml(
          backImage.url
        )}" data-crop="${backPage?.crop ?? ""}" aria-label="封底高清预览"></canvas></div>`
      : backCoverMarkup();
    renderModelCoverPreviews();
    setModelDimensions();
    updateModelTransform();
    scheduleHighResolutionDraw(els.modelBook);
  };

  if (!animate || !state.spreadMode || state.isFlipping) {
    renderTargetPages();
    return;
  }

  state.isFlipping = true;
  const sourcePair = pagesForSpread(
    clamp(state.currentSpread + (direction === "next" ? -1 : 1), 0, spreadCount() - 1)
  );
  const outgoingPage =
    direction === "next" ? sourcePair.right ?? sourcePair.left : sourcePair.left ?? sourcePair.right;
  const incomingPage =
    direction === "next" ? pair.left ?? pair.right : pair.right ?? pair.left;
  els.modelFlipFront.innerHTML = pageContent(outgoingPage ?? 0, { highResolution: true });
  els.modelFlipBack.innerHTML = pageContent(incomingPage ?? 0, { highResolution: true });
  scheduleHighResolutionDraw(els.modelFlipLeaf);
  const flipStyle = state.binding === "right" ? `rtl-${direction}` : `flip-${direction}`;
  els.modelFlipLeaf.className = `flip-leaf model-flip-leaf is-flipping ${flipStyle}`;

  window.setTimeout(renderTargetPages, 250);
  els.modelFlipLeaf.addEventListener(
    "animationend",
    () => {
      els.modelFlipLeaf.className = "flip-leaf model-flip-leaf";
      state.isFlipping = false;
    },
    { once: true }
  );
}

function updateBookDecorations() {
  els.book.classList.toggle("fill-pages", state.fillPages);
  els.book.classList.toggle("paper-texture", state.texture);
  els.book.classList.toggle("guides-visible", state.guides);
  els.book.classList.toggle("reference-visible", state.margins);
  els.book.classList.toggle("quality-standard", state.quality === "standard");
  els.book.classList.toggle("quality-high", state.quality === "high");
  els.book.classList.toggle("quality-halftone", state.quality === "halftone");
  els.bookScene.classList.toggle("binding-right", state.binding === "right");
  els.footerNav.classList.toggle("binding-right", state.binding === "right");
  els.modelBook.classList.toggle("fill-pages", state.fillPages);
  els.modelBook.classList.toggle("paper-texture", state.texture);
  els.modelBook.classList.toggle("guides-visible", state.guides);
  els.modelBook.classList.toggle("reference-visible", state.margins);
  els.modelBook.classList.toggle("quality-standard", state.quality === "standard");
  els.modelBook.classList.toggle("quality-high", state.quality === "high");
  els.modelBook.classList.toggle("quality-halftone", state.quality === "halftone");
  els.modelBook.classList.toggle(
    "is-single",
    !state.spreadMode && !isClosedSpread(state.currentSpread)
  );
  const hasPrevious = state.currentSpread > 0;
  const hasNext = state.currentSpread < spreadCount() - 1;
  els.prevZone.classList.toggle("is-disabled", !hasPrevious);
  els.nextZone.classList.toggle("is-disabled", !hasNext);
  els.prevButton.disabled = !hasPrevious;
  els.nextButton.disabled = !hasNext;
  els.viewerPrevButton.disabled = !hasPrevious;
  els.viewerNextButton.disabled = !hasNext;
  els.progressBar.style.width = `${((state.currentSpread + 1) / spreadCount()) * 100}%`;
  els.flipNavIndex.textContent = `${String(state.currentSpread + 1).padStart(2, "0")} / ${String(
    spreadCount()
  ).padStart(2, "0")}`;
  els.flipNav.hidden = state.view === "overview";
  const currentSpread = state.layoutSpreads[state.currentSpread];
  els.currentSpreadLabel.textContent = spreadPairLabel(state.currentSpread);
  els.currentPageLabel.textContent = currentSpread?.note
    ? currentSpread.note
    : currentSpread?.kind === "inner-spread" || currentSpread?.kind === "panorama"
      ? "跨页预览"
      : currentSpread?.kind === "single-inner"
        ? "单页预览"
        : "书页预览";
  updateSpreadAssetStatus();
}

function goToSpread(index, options = {}) {
  const { animate = true } = options;
  const target = clamp(index, 0, spreadCount() - 1);
  if (target === state.currentSpread || state.isFlipping) return;
  const direction = target > state.currentSpread ? "next" : "prev";
  state.currentSpread = target;
  if (state.view === "model") {
    state.modelRotation = { x: -8, y: -17 };
    updateModelTransform();
    renderModel(animate, direction);
    renderBook(false);
  } else {
    renderBook(animate && state.spreadMode, direction);
    renderModel(false);
  }
  renderPageList();
  updateBookDecorations();
  updatePresentation();
}

function nextSpread() {
  goToSpread(state.currentSpread + 1);
}

function prevSpread() {
  goToSpread(state.currentSpread - 1);
}

function buildPageList() {
  const list = [];
  const pageThumbHeight = clamp((54 * state.height) / state.width, 36, 72);
  const frontPage = state.physicalPages[0];
  const backPage = state.physicalPages[state.pages - 1];
  const coverImage = frontPage?.image ?? null;
  const backCoverImage = backPage?.image ?? null;
  const coverPosition = frontPage?.crop === "right" ? "right center" : "center center";
  const backPosition = backPage?.crop === "left" ? "left center" : "center center";
  const coverThumbMarkup = coverImage
    ? `<img src="${coverImage.url}" alt="" style="object-position:${coverPosition}" />`
    : '<div class="page-fallback cover-page" style="position:relative;width:100%;height:100%;transform:scale(.45)"></div>';
  const backThumbMarkup = backCoverImage
    ? `<img src="${backCoverImage.url}" alt="" style="object-position:${backPosition}" />`
    : '<div class="page-fallback back-cover-page" style="position:relative;width:100%;height:100%"><div class="back-cover-grid"></div></div>';

  list.push(`
    <div class="page-list-tip">
      <span>拖动缩略图调整顺序</span>
      <span>跨页大图占 2 页</span>
    </div>
  `);

  list.push(`
    <div class="page-thumb ${state.currentSpread === 0 ? "active" : ""} fixed-page" data-page-kind="cover" data-page="0">
      <div class="thumb-paper" style="height:${pageThumbHeight}px" aria-hidden="true">${coverThumbMarkup}</div>
      <div class="thumb-copy">
        <strong>封面</strong>
        <span>${coverImage ? "COVER IMAGE" : "GENERATED"}</span>
      </div>
      <span class="thumb-number">1</span>
      ${
        state.coverImage
          ? '<button class="asset-remove page-remove" type="button" data-remove-cover="front" aria-label="移除封面图片">×</button>'
          : ""
      }
    </div>
  `);

  if (state.interiorItems.length) {
    state.interiorItems.forEach((item, itemIndex) => {
      const location = state.itemLocations[item.id] ?? {};
      const active = state.currentSpread === location.spreadIndex;
      if (item.type === "panorama") {
        list.push(`
          <div class="page-thumb panorama-thumb ${active ? "active" : ""}" data-item-index="${itemIndex}" data-item-id="${item.id}" draggable="true" title="${escapeHtml(item.image.name)}">
            <div class="panorama-thumb-paper" aria-hidden="true">
              <img src="${escapeHtml(item.image.url)}" alt="" />
              <span class="panorama-fold"></span>
            </div>
            <div class="thumb-copy">
              <strong>跨页大图</strong>
              <span>内页 ${String(location.startInner ?? "–").padStart(2, "0")}–${String(
                location.endInner ?? "–"
              ).padStart(2, "0")}</span>
            </div>
            <span class="thumb-drag" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
            <button class="asset-remove page-remove" type="button" data-remove-item="${item.id}" aria-label="移除跨页大图">×</button>
          </div>
        `);
        return;
      }

      list.push(`
        <div class="page-thumb ${active ? "active" : ""}" data-item-index="${itemIndex}" data-item-id="${item.id}" draggable="true" title="${escapeHtml(item.image.name)}">
          <div class="thumb-paper" style="height:${pageThumbHeight}px" aria-hidden="true">
            <img src="${escapeHtml(item.image.url)}" alt="" />
          </div>
          <div class="thumb-copy">
            <strong>内页 ${String(location.startInner ?? "–").padStart(2, "0")}</strong>
            <span>IMAGE PAGE</span>
          </div>
          <span class="thumb-number">${location.startInner ?? "–"}</span>
          <span class="thumb-drag" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
          <button class="asset-remove page-remove" type="button" data-remove-item="${item.id}" aria-label="移除内页图片">×</button>
        </div>
      `);
    });
  } else {
    for (let spreadIndex = 2; spreadIndex < spreadCount() - 2; spreadIndex += 1) {
      const spread = state.layoutSpreads[spreadIndex];
      list.push(`
        <div class="page-thumb ${state.currentSpread === spreadIndex ? "active" : ""}" data-page-kind="demo-spread" data-spread-index="${spreadIndex}">
          <div class="thumb-paper" style="height:${pageThumbHeight}px" aria-hidden="true">
            <div class="page-fallback blank-page"></div>
          </div>
          <div class="thumb-copy">
            <strong>${spread.label}</strong>
            <span>${spread.kind === "inner-spread" ? "SPREAD" : "SINGLE"}</span>
          </div>
          <span class="thumb-number">–</span>
        </div>
      `);
    }
  }

  list.push(`
    <div class="page-thumb ${state.currentSpread === spreadCount() - 1 ? "active" : ""} fixed-page" data-page-kind="back" data-page="${state.pages - 1}">
      <div class="thumb-paper" style="height:${pageThumbHeight}px" aria-hidden="true">${backThumbMarkup}</div>
      <div class="thumb-copy">
        <strong>封底</strong>
        <span>${backCoverImage ? "BACK COVER" : "GENERATED"}</span>
      </div>
      <span class="thumb-number">${state.pages}</span>
      ${
        state.backCoverImage
          ? '<button class="asset-remove page-remove" type="button" data-remove-cover="back" aria-label="移除封底图片">×</button>'
          : ""
      }
    </div>
  `);
  return list.join("");
}

function renderPageList() {
  els.pageList.innerHTML = buildPageList();
  els.pageCountBadge.textContent = `${state.pages} 页`;
  bindPageDrag();
}

function renderAssetStrip() {
  if (!state.images.length) {
    els.assetStrip.innerHTML = '<p class="asset-empty">上传后，图片会出现在这里</p>';
  } else {
    els.assetStrip.innerHTML = state.images
      .map(
        (image, index) => `
          <span class="asset-thumb" title="${escapeHtml(image.name)}">
            <img src="${escapeHtml(image.url)}" alt="素材 ${index + 1}" />
            <button class="asset-remove" type="button" data-remove-item="${image.id}" aria-label="移除${escapeHtml(
              image.name
            )}">×</button>
          </span>
        `
      )
      .join("");
  }
  const panoramaCount = state.interiorItems.filter((item) => item.type === "panorama").length;
  els.assetCount.textContent = `${state.images.length} 张${
    panoramaCount ? ` · ${panoramaCount} 跨页` : ""
  }`;
  const previewMarkup = (image) =>
    image
      ? `<img src="${escapeHtml(image.url)}" alt="" />`
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"></path></svg>';
  els.coverPreview.innerHTML = previewMarkup(state.coverImage);
  els.backCoverPreview.innerHTML = previewMarkup(state.backCoverImage);
  els.wrapCoverPreview.innerHTML = previewMarkup(state.wrapCoverImage);
  els.removeCoverButton.hidden = !state.coverImage;
  els.removeBackCoverButton.hidden = !state.backCoverImage;
  els.removeWrapCoverButton.hidden = !state.wrapCoverImage;
  els.fileStatus.textContent = state.interiorItems.length
    ? `${state.images.length} 张内页${panoramaCount ? ` + ${panoramaCount} 张跨页大图` : ""} · 仅保存在本地`
    : "所有内容仅保存在本地";
  updateSpreadAssetStatus();
}

function updateSpreadAssetStatus() {
  const panorama = panoramaForSpread(state.currentSpread);
  if (panorama) {
    els.spreadAssetStatus.textContent = `当前跨页：${spreadPairLabel(state.currentSpread)}`;
    els.spreadUploadButton.classList.add("has-panorama");
  } else {
    els.spreadAssetStatus.textContent = "上传后加入内页队列";
    els.spreadUploadButton.classList.remove("has-panorama");
  }
}

function renderOverview() {
  const ratio = state.width / state.height;
  const items = [];
  for (let spread = 0; spread < spreadCount(); spread += 1) {
    const spreadDescriptor = state.layoutSpreads[spread];
    const pair = visualPair(pagesForSpread(spread));
    const isCover = spreadDescriptor?.kind === "front-cover";
    const isBackCover = spreadDescriptor?.kind === "back-cover";
    const isClosed = pair.left === null || pair.right === null;
    const pages = [pair.left, pair.right].filter((page) => page !== null && page < state.pages);
    items.push(`
      <div class="overview-spread" data-spread="${spread}" role="button" tabindex="0" aria-label="查看${spreadPairLabel(spread)}">
        <div class="overview-paper ${isClosed ? "is-closed" : ""} ${isCover ? "is-cover" : ""} ${isBackCover ? "is-back-cover" : ""}">
          ${pages
            .map((page) => {
              const image = pageImageAt(page);
              const pageData = state.physicalPages[page];
              const objectPosition =
                pageData?.crop === "left"
                  ? "left center"
                  : pageData?.crop === "right"
                    ? "right center"
                    : "center center";
              const pageKind = state.physicalPages[page]?.kind;
              const fallback =
                pageKind === "front-cover"
                  ? coverMarkup()
                  : pageKind === "back-cover"
                    ? backCoverMarkup()
                    : pageKind === "pure-blank"
                      ? pureBlankPageMarkup()
                      : page % 3 === 1
                        ? blankPageMarkup(page)
                        : artPageMarkup(page);
              return `<div class="overview-page" style="--page-ratio:${ratio}">${
                image
                  ? `<img src="${image.url}" alt="第 ${page + 1} 页" style="object-position:${objectPosition}" />`
                  : fallback
              }</div>`;
            })
            .join("")}
        </div>
        <div class="overview-meta">
          <strong>${spreadPairLabel(spread)}</strong>
          <span>${isCover ? "FRONT COVER" : isBackCover ? "BACK COVER" : `SPREAD ${String(spread).padStart(2, "0")}`}</span>
        </div>
      </div>
    `);
  }
  els.spreadGrid.innerHTML = items.join("");
}

function renderAll(options = {}) {
  const { preserveSpread = false } = options;
  syncPageSlots();
  state.currentSpread = preserveSpread ? clamp(state.currentSpread, 0, spreadCount() - 1) : 0;
  renderBook(false);
  renderModel(false);
  renderPageList();
  renderAssetStrip();
  renderOverview();
  updateBookDecorations();
  updatePresentation();
  updateRatio();
}

function updateRatio() {
  const ratio = state.width / state.height;
  const divisor = gcd(state.width, state.height);
  const ratioW = Math.round(state.width / divisor);
  const ratioH = Math.round(state.height / divisor);
  els.ratioLabel.textContent = ratioW <= 20 && ratioH <= 20 ? `${ratioW} : ${ratioH}` : ratio.toFixed(2);
}

function gcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function updatePresentation() {
  els.presentationCounter.textContent = `${state.currentSpread + 1} / ${spreadCount()}`;
  els.presentationTitle.textContent = state.title;
}

function applyPresentationBookSize(book = els.presentationStage.querySelector(".book")) {
  if (!book) return;
  const stageRect = els.presentationStage.getBoundingClientRect();
  const availableWidth = Math.max(280, stageRect.width - 32);
  const availableHeight = Math.max(220, stageRect.height - 28);
  const ratio = state.width / state.height;
  const pair = visualPair(pagesForSpread(state.currentSpread));
  const isSpread = pair.left !== null && pair.right !== null;
  let width;
  let height;

  if (isSpread) {
    width = Math.min(availableWidth, availableHeight * ratio * 2);
    height = width / (ratio * 2);
  } else {
    width = Math.min(availableWidth, availableHeight * ratio);
    height = width / ratio;
  }

  book.style.setProperty("--book-width", `${Math.floor(width / 2) * 2}px`);
  book.style.setProperty("--book-height", `${Math.floor(height)}px`);
}

function enterPresentation() {
  if (state.presentation) return;
  state.presentation = true;
  els.presentationOverlay.hidden = false;
  const isCover = state.layoutSpreads[state.currentSpread]?.kind === "front-cover";
  const presentationPair = visualPair(pagesForSpread(state.currentSpread));
  const leftOnly = presentationPair.left !== null && presentationPair.right === null;
  const rightOnly = presentationPair.left === null && presentationPair.right !== null;
  els.presentationStage.innerHTML = `
    <div class="book ${isCover ? "is-cover" : ""} ${leftOnly ? "is-left-only" : ""} ${rightOnly ? "is-right-only" : ""} ${state.fillPages ? "fill-pages" : ""} ${state.texture ? "paper-texture" : ""} ${state.margins ? "reference-visible" : ""} quality-${state.quality}"
      >
      <div class="book-page book-page-left">${
        presentationPair.left !== null ? pageContent(presentationPair.left) : ""
      }</div>
      <div class="book-page book-page-right">${pageContent(presentationPair.right ?? 0)}</div>
      <div class="book-spine" aria-hidden="true"></div>
      <div class="edge edge-top"></div>
      <div class="edge edge-bottom"></div>
    </div>
  `;
  const book = els.presentationStage.querySelector(".book");
  book?.classList.add("presentation-book");
  applyPresentationBookSize(book);
  updatePresentation();
}

function updatePresentationContent() {
  if (!state.presentation) return;
  const pair = visualPair(pagesForSpread(state.currentSpread));
  const book = els.presentationStage.querySelector(".book");
  if (!book) return;
  const cover = state.layoutSpreads[state.currentSpread]?.kind === "front-cover";
  book.classList.toggle("is-cover", cover);
  book.classList.toggle("is-left-only", pair.left !== null && pair.right === null);
  book.classList.toggle("is-right-only", pair.left === null && pair.right !== null);
  $(".book-page-left", book).innerHTML = pair.left !== null ? pageContent(pair.left) : "";
  $(".book-page-right", book).innerHTML = pageContent(pair.right ?? 0);
  applyPresentationBookSize(book);
  updatePresentation();
}

function exitPresentation() {
  state.presentation = false;
  els.presentationOverlay.hidden = true;
  els.presentationStage.innerHTML = "";
}

function setView(view) {
  state.view = view;
  $$(".view-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  els.flipView.hidden = view !== "flip";
  els.modelView.hidden = view !== "model";
  els.overviewView.hidden = view !== "overview";
  els.detailLoupe.classList.remove("visible");
  if (view === "overview") renderOverview();
  if (view === "flip") requestAnimationFrame(setBookDimensions);
  if (view === "model") {
    requestAnimationFrame(() => {
      setModelDimensions();
      renderModel(false);
    });
  }
  updateBookDecorations();
}

function setZoom(zoom) {
  state.zoom = zoom === "fit" ? "fit" : clamp(zoom, 0.35, 2.2);
  setBookDimensions();
}

function setPageCount(next) {
  if (state.interiorItems.length) {
    els.pagesInput.value = state.pages;
    showToast("上传内容后，总页数会根据内页与跨页大图自动计算");
    return;
  }
  const sanitized = clamp(Math.round(Number(next) || 4), 4, 200);
  state.pages = sanitized;
  els.pagesInput.value = sanitized;
  syncPageSlots();
  state.currentSpread = clamp(state.currentSpread, 0, spreadCount() - 1);
  renderAll({ preserveSpread: true });
}

function setDimensions(width, height) {
  state.width = clamp(Math.round(Number(width) || 1), 50, 1000);
  state.height = clamp(Math.round(Number(height) || 1), 50, 1000);
  els.widthInput.value = state.width;
  els.heightInput.value = state.height;
  updateRatio();
  renderBook(false);
  renderModel(false);
  renderOverview();
}

function setPreset(preset) {
  state.preset = preset;
  $$(".preset-card").forEach((card) => card.classList.toggle("active", card.dataset.preset === preset));
  if (presetSizes[preset]) {
    setDimensions(presetSizes[preset].width, presetSizes[preset].height);
  }
}

function applyBindingButtonOrder() {
  const progress = $(".page-progress", els.footerNav);
  if (state.binding === "right") {
    els.flipNav.append(els.viewerNextButton, els.flipNavIndex, els.viewerPrevButton);
    els.footerNav.append(
      els.firstButton,
      els.nextButton,
      progress,
      els.prevButton,
      els.lastButton
    );
  } else {
    els.flipNav.append(els.viewerPrevButton, els.flipNavIndex, els.viewerNextButton);
    els.footerNav.append(
      els.firstButton,
      els.prevButton,
      progress,
      els.nextButton,
      els.lastButton
    );
  }
  els.flipNav.classList.toggle("binding-right", state.binding === "right");
}

function setBinding(binding) {
  state.binding = binding === "right" ? "right" : "left";
  $$(".binding-card").forEach((card) =>
    card.classList.toggle("active", card.dataset.binding === state.binding)
  );
  applyBindingButtonOrder();
  syncPageSlots();
  renderBook(false);
  renderModel(false);
  renderPageList();
  renderOverview();
  updateBookDecorations();
  showToast(state.binding === "right" ? "已切换为右开本" : "已切换为左开本");
}

function setQuality(quality) {
  state.quality = ["standard", "high", "halftone"].includes(quality) ? quality : "high";
  $$(".quality-control button").forEach((button) =>
    button.classList.toggle("active", button.dataset.quality === state.quality)
  );
  const help = {
    standard: "流畅浏览模式，适合页数较多时快速翻页。",
    high: "保留原图像素并以高质量采样显示，适合漫画与线稿。",
    halftone: "关闭干扰纹理并优先保留硬边；悬停页面可使用 4× 网点检查。建议原图达到 60 线所需的高分辨率扫描。",
  };
  els.qualityHelp.textContent = help[state.quality];
  els.detailLoupe.classList.remove("visible");
  renderBook(false);
  renderModel(false);
  updateBookDecorations();
}

function updateReferenceLines() {
  state.marginValues = {
    top: clamp(Number(els.marginTopInput.value) || 0, 0, Math.min(100, state.height / 2)),
    right: clamp(Number(els.marginRightInput.value) || 0, 0, Math.min(100, state.width / 2)),
    bottom: clamp(Number(els.marginBottomInput.value) || 0, 0, Math.min(100, state.height / 2)),
    left: clamp(Number(els.marginLeftInput.value) || 0, 0, Math.min(100, state.width / 2)),
  };
  state.bleed = clamp(Number(els.bleedInput.value) || 0, 0, 25);
  state.margins = true;
  els.marginsToggle.checked = true;
  applyReferenceGuideStyles();
  updateBookDecorations();
}

function applyReferenceGuideStyles() {
  const margin = state.marginValues;
  const marginValues = {
    top: `${(margin.top / state.height) * 100}%`,
    right: `${(margin.right / state.width) * 100}%`,
    bottom: `${(margin.bottom / state.height) * 100}%`,
    left: `${(margin.left / state.width) * 100}%`,
  };
  const bleedValues = {
    top: `${(state.bleed / state.height) * 100}%`,
    right: `${(state.bleed / state.width) * 100}%`,
    bottom: `${(state.bleed / state.height) * 100}%`,
    left: `${(state.bleed / state.width) * 100}%`,
  };
  $$(".page-margins").forEach((guide) => {
    Object.entries(marginValues).forEach(([property, value]) =>
      guide.style.setProperty(property, value)
    );
  });
  $$(".bleed-guide").forEach((guide) => {
    Object.entries(bleedValues).forEach(([property, value]) =>
      guide.style.setProperty(property, value)
    );
  });
}

function hideLoupe() {
  els.detailLoupe.classList.remove("visible");
  els.detailLoupeImage.replaceChildren();
}

function updateLoupe(event) {
  if (state.quality !== "halftone" || state.view === "overview") {
    hideLoupe();
    return;
  }
  const pageElement = event.target.closest?.(".book-page");
  if (!pageElement || els.modelStage.classList.contains("is-dragging")) {
    hideLoupe();
    return;
  }
  const pageIndex = Number(pageElement.dataset.pageIndex);
  const image = Number.isFinite(pageIndex) ? pageImageAt(pageIndex) : null;
  if (!image) {
    hideLoupe();
    return;
  }

  const pageRect = pageElement.getBoundingClientRect();
  const stageRect = els.stage.getBoundingClientRect();
  const relativeX = (event.clientX - pageRect.left) / Math.max(1, pageRect.width);
  const relativeY = (event.clientY - pageRect.top) / Math.max(1, pageRect.height);
  const zoom = 4;
  const imageWidth = Math.max(1, pageRect.width * zoom);
  const imageHeight = Math.max(1, pageRect.height * zoom);

  let previewImage = $("img", els.detailLoupeImage);
  if (!previewImage) {
    previewImage = document.createElement("img");
    els.detailLoupeImage.append(previewImage);
  }
  if (previewImage.src !== image.url) previewImage.src = image.url;
  previewImage.style.width = `${imageWidth}px`;
  previewImage.style.height = `${imageHeight}px`;
  previewImage.style.objectFit = "fill";
  previewImage.style.left = `${84 - relativeX * imageWidth}px`;
  previewImage.style.top = `${84 - relativeY * imageHeight}px`;

  const loupeSize = 168;
  const left = clamp(event.clientX - stageRect.left + 24, 8, stageRect.width - loupeSize - 8);
  const top = clamp(event.clientY - stageRect.top + 24, 8, stageRect.height - loupeSize - 8);
  els.detailLoupe.style.left = `${left}px`;
  els.detailLoupe.style.top = `${top}px`;
  els.detailLoupe.classList.add("visible");
}

function setCoverImage(kind, file) {
  if (!file?.type.startsWith("image/")) {
    showToast("请选择有效的 JPG、PNG 或 WEBP 图片");
    return;
  }
  const isBack = kind === "back";
  const current = isBack ? state.backCoverImage : state.coverImage;
  if (current?.url) {
    URL.revokeObjectURL(current.url);
    imageCache.delete(current.url);
  }
  const image = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: file.name,
    url: URL.createObjectURL(file),
  };
  if (isBack) state.backCoverImage = image;
  else state.coverImage = image;
  syncPageSlots();
  state.modelRotation = { x: -8, y: -17 };
  state.modelZoom = 1;
  updateModelTransform();
  renderPageList();
  renderAssetStrip();
  renderBook(false);
  renderModel(false);
  renderOverview();
  showToast(isBack ? "封底图片已更新" : "封面图片已更新");
}

function removeCoverImage(kind) {
  const key =
    kind === "front" ? "coverImage" : kind === "back" ? "backCoverImage" : "wrapCoverImage";
  const current = state[key];
  if (!current) return;
  URL.revokeObjectURL(current.url);
  imageCache.delete(current.url);
  state[key] = null;
  syncPageSlots();
  state.modelRotation = { x: -8, y: -17 };
  state.modelZoom = 1;
  updateModelTransform();
  renderPageList();
  renderAssetStrip();
  renderBook(false);
  renderModel(false);
  renderOverview();
  const label = kind === "front" ? "封面" : kind === "back" ? "封底" : "封面封底展开图";
  showToast(`${label}已移除`);
}

function removeInteriorItem(itemId) {
  const itemIndex = state.interiorItems.findIndex((item) => item.id === itemId);
  if (itemIndex < 0) return;
  const [item] = state.interiorItems.splice(itemIndex, 1);
  URL.revokeObjectURL(item.image.url);
  imageCache.delete(item.image.url);
  state.images = state.images.filter((image) => image.id !== item.id);
  if (!state.interiorItems.length) state.pages = 12;
  syncPageSlots();
  renderAll({ preserveSpread: true });
  showToast(item.type === "panorama" ? "跨页大图已移除" : "内页图片已移除");
}

function setWrapCoverImage(file) {
  if (!file?.type.startsWith("image/")) {
    showToast("请选择有效的封面封底展开图");
    return;
  }
  if (state.wrapCoverImage?.url) {
    URL.revokeObjectURL(state.wrapCoverImage.url);
    imageCache.delete(state.wrapCoverImage.url);
  }
  state.wrapCoverImage = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: file.name,
    url: URL.createObjectURL(file),
  };
  syncPageSlots();
  state.modelRotation = { x: -8, y: -17 };
  state.modelZoom = 1;
  updateModelTransform();
  renderPageList();
  renderAssetStrip();
  renderBook(false);
  renderModel(false);
  renderOverview();
  showToast("封面封底展开图已自动分配到封面与封底");
}

function setPanoramaImage(file) {
  if (!file?.type.startsWith("image/")) {
    showToast("请选择有效的 JPG、PNG 或 WEBP 图片");
    return;
  }
  const image = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: file.name,
    url: URL.createObjectURL(file),
  };
  const item = { id: image.id, type: "panorama", image };
  state.interiorItems.push(item);
  syncPageSlots();
  const location = state.itemLocations[item.id];
  state.currentSpread = location?.spreadIndex ?? 0;
  renderAll({ preserveSpread: true });
  showToast(
    location
      ? `跨页大图已加入内页顺序：内页 ${String(location.startInner).padStart(
          2,
          "0"
        )}–${String(location.endInner).padStart(2, "0")}`
      : "跨页大图已加入内页顺序"
  );
}

function addImages(files) {
  const imageFiles = [...files].filter((file) => file.type.startsWith("image/"));
  if (!imageFiles.length) {
    showToast("请选择 JPG、PNG 或 WEBP 图片");
    return;
  }
  const tasks = imageFiles.map(
    (file) =>
      new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const image = { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, name: file.name, url };
        state.images.push(image);
        state.interiorItems.push({ id: image.id, type: "page", image });
        resolve(image);
      })
  );

  Promise.all(tasks).then(() => {
    syncPageSlots();
    renderPageList();
    renderAssetStrip();
    renderBook(false);
    renderModel(false);
    renderOverview();
    showToast(`已添加 ${imageFiles.length} 张内页图片，共 ${state.pages} 页`);
  });
}

function addImagesFromClipboard(event) {
  const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
  if (files.length) {
    event.preventDefault();
    addImages(files);
  }
}

function bindPageDrag() {
  let draggedIndex = null;
  $$(".page-thumb", els.pageList).forEach((item) => {
    item.addEventListener("click", (event) => {
      const removeItemButton = event.target.closest("[data-remove-item]");
      if (removeItemButton) {
        event.preventDefault();
        event.stopPropagation();
        removeInteriorItem(removeItemButton.dataset.removeItem);
        return;
      }
      const removeCoverButton = event.target.closest("[data-remove-cover]");
      if (removeCoverButton) {
        event.preventDefault();
        event.stopPropagation();
        removeCoverImage(removeCoverButton.dataset.removeCover);
        return;
      }
      if (item.dataset.spreadIndex !== undefined) {
        goToSpread(Number(item.dataset.spreadIndex));
        return;
      }
      if (item.dataset.itemIndex !== undefined) {
        const itemIndex = Number(item.dataset.itemIndex);
        const contentItem = state.interiorItems[itemIndex];
        const spread = state.itemLocations[contentItem?.id]?.spreadIndex;
        if (Number.isFinite(spread)) goToSpread(spread);
        return;
      }
      const page = Number(item.dataset.page);
      const pageKind = item.dataset.pageKind;
      const spread =
        pageKind === "cover"
          ? 0
          : pageKind === "cover-reverse"
            ? 1
            : pageKind === "back-reverse"
              ? spreadCount() - 2
          : pageKind === "back"
            ? spreadCount() - 1
            : Math.floor((page - 1) / 2) + 1;
      goToSpread(spread);
    });
    item.addEventListener("dragstart", (event) => {
      if (item.dataset.itemIndex === undefined || event.target.closest("button")) {
        event.preventDefault();
        return;
      }
      draggedIndex = Number(item.dataset.itemIndex);
      item.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(draggedIndex));
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      $$(".page-thumb", els.pageList).forEach((thumb) => thumb.classList.remove("drag-target"));
    });
    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      item.classList.add("drag-target");
    });
    item.addEventListener("dragleave", () => item.classList.remove("drag-target"));
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("drag-target");
      const from = Number(event.dataTransfer.getData("text/plain") || draggedIndex);
      const to = Number(item.dataset.itemIndex);
      if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
      const moved = state.interiorItems.splice(from, 1)[0];
      state.interiorItems.splice(to, 0, moved);
      syncPageSlots();
      const location = state.itemLocations[moved.id];
      if (location) state.currentSpread = location.spreadIndex;
      renderAll({ preserveSpread: true });
      showToast("内页与跨页大图顺序已更新");
    });
  });
}

function clearImages() {
  [
    ...state.images,
    state.coverImage,
    state.backCoverImage,
    state.wrapCoverImage,
    ...state.interiorItems.filter((item) => item.type === "panorama").map((item) => item.image),
  ]
    .filter(Boolean)
    .forEach((image) => {
      URL.revokeObjectURL(image.url);
      imageCache.delete(image.url);
    });
  state.images = [];
  state.interiorItems = [];
  state.itemLocations = {};
  state.pageImages = [];
  state.pages = 12;
  state.coverImage = null;
  state.backCoverImage = null;
  state.wrapCoverImage = null;
  state.panoramas = {};
  renderAll({ preserveSpread: true });
  showToast("图片已清除");
}

function shufflePages() {
  if (!state.interiorItems.length) {
    showToast("请先上传图片");
    return;
  }
  const shuffled = [...state.interiorItems];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  state.interiorItems = shuffled;
  syncPageSlots();
  renderAll({ preserveSpread: true });
  showToast("内页与跨页大图已重新排列");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  els.toastRegion.append(toast);
  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 280);
  }, 2400);
}

function toggleTheme() {
  const isDark = els.root.dataset.theme === "dark";
  els.root.dataset.theme = isDark ? "light" : "dark";
  localStorage.setItem("folio-theme", els.root.dataset.theme);
}

function resetAll() {
  clearImages();
  state.title = "未命名画册";
  state.width = 210;
  state.height = 280;
  state.pages = 12;
  state.currentSpread = 0;
  state.zoom = 1;
  state.preset = "custom";
  state.fillPages = true;
  state.texture = true;
  state.margins = false;
  state.marginValues = { top: 10, right: 10, bottom: 12, left: 12 };
  state.bleed = 3;
  state.guides = false;
  state.binding = "left";
  state.quality = "high";
  state.modelRotation = { x: -8, y: -17 };
  state.modelZoom = 1;
  els.nameInput.value = state.title;
  els.documentName.textContent = state.title;
  els.widthInput.value = state.width;
  els.heightInput.value = state.height;
  els.pagesInput.value = state.pages;
  els.coverToggle.checked = true;
  els.textureToggle.checked = true;
  els.marginsToggle.checked = false;
  els.marginTopInput.value = "10";
  els.marginRightInput.value = "10";
  els.marginBottomInput.value = "12";
  els.marginLeftInput.value = "12";
  els.bleedInput.value = "3";
  els.guidesButton.setAttribute("aria-pressed", "false");
  $$(".binding-card").forEach((card) =>
    card.classList.toggle("active", card.dataset.binding === "left")
  );
  $$(".quality-control button").forEach((button) =>
    button.classList.toggle("active", button.dataset.quality === "high")
  );
  els.qualityHelp.textContent = "保留原图像素并以高质量采样显示，适合漫画与线稿。";
  applyBindingButtonOrder();
  setPreset("custom");
  updateModelTransform();
  renderAll();
  showToast("已恢复默认设置");
}

function bindEvents() {
  els.uploadButton.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (event) => {
    addImages(event.target.files);
    event.target.value = "";
  });
  els.coverUploadButton.addEventListener("click", () => els.coverInput.click());
  els.backCoverUploadButton.addEventListener("click", () => els.backCoverInput.click());
  els.wrapCoverUploadButton.addEventListener("click", () => els.wrapCoverInput.click());
  els.spreadUploadButton.addEventListener("click", () => els.spreadInput.click());
  els.coverInput.addEventListener("change", (event) => {
    setCoverImage("front", event.target.files?.[0]);
    event.target.value = "";
  });
  els.backCoverInput.addEventListener("change", (event) => {
    setCoverImage("back", event.target.files?.[0]);
    event.target.value = "";
  });
  els.wrapCoverInput.addEventListener("change", (event) => {
    setWrapCoverImage(event.target.files?.[0]);
    event.target.value = "";
  });
  els.removeCoverButton.addEventListener("click", () => removeCoverImage("front"));
  els.removeBackCoverButton.addEventListener("click", () => removeCoverImage("back"));
  els.removeWrapCoverButton.addEventListener("click", () => removeCoverImage("wrap"));
  els.assetStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-item]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    removeInteriorItem(button.dataset.removeItem);
  });
  els.spreadInput.addEventListener("change", (event) => {
    setPanoramaImage(event.target.files?.[0]);
    event.target.value = "";
  });

  els.nameInput.addEventListener("input", (event) => {
    state.title = event.target.value.trim() || "未命名画册";
    els.documentName.textContent = state.title;
    renderBook(false);
    renderModel(false);
    updatePresentation();
  });

  $$(".preset-card").forEach((card) => {
    card.addEventListener("click", () => setPreset(card.dataset.preset));
  });
  els.widthInput.addEventListener("input", (event) => {
    setDimensions(event.target.value, state.height);
    setPreset("custom");
  });
  els.heightInput.addEventListener("input", (event) => {
    setDimensions(state.width, event.target.value);
    setPreset("custom");
  });
  $("#swapOrientationButton").addEventListener("click", () => {
    setDimensions(state.height, state.width);
    setPreset("custom");
  });

  els.pagesInput.addEventListener("input", (event) => setPageCount(event.target.value));
  $("#pagesMinusButton").addEventListener("click", () => setPageCount(state.pages - 2));
  $("#pagesPlusButton").addEventListener("click", () => setPageCount(state.pages + 2));
  $$(".binding-card").forEach((card) =>
    card.addEventListener("click", () => setBinding(card.dataset.binding))
  );
  $$(".quality-control button").forEach((button) =>
    button.addEventListener("click", () => setQuality(button.dataset.quality))
  );

  els.marginsToggle.addEventListener("change", (event) => {
    state.margins = event.target.checked;
    const panelScrollTop = $(".settings-scroll").scrollTop;
    updateBookDecorations();
    requestAnimationFrame(() => {
      lockViewportScroll();
      $(".settings-scroll").scrollTop = panelScrollTop;
    });
  });
  [els.marginTopInput, els.marginRightInput, els.marginBottomInput, els.marginLeftInput, els.bleedInput].forEach(
    (input) => input.addEventListener("input", updateReferenceLines)
  );
  els.coverToggle.addEventListener("change", (event) => {
    state.fillPages = event.target.checked;
    updateBookDecorations();
    renderBook(false);
    renderModel(false);
  });
  els.textureToggle.addEventListener("change", (event) => {
    state.texture = event.target.checked;
    updateBookDecorations();
    renderModel(false);
  });

  els.guidesButton.addEventListener("click", () => {
    state.guides = !state.guides;
    els.guidesButton.setAttribute("aria-pressed", String(state.guides));
    updateBookDecorations();
  });
  els.spreadButton.addEventListener("click", () => {
    state.spreadMode = !state.spreadMode;
    els.spreadButton.setAttribute("aria-pressed", String(state.spreadMode));
    renderBook(false);
    renderModel(false);
    renderPageList();
    updateBookDecorations();
  });

  $("#zoomInButton").addEventListener("click", () => setZoom((state.zoom === "fit" ? 1 : state.zoom) + 0.1));
  $("#zoomOutButton").addEventListener("click", () => setZoom((state.zoom === "fit" ? 1 : state.zoom) - 0.1));
  $("#fitButton").addEventListener("click", () => setZoom("fit"));
  $("#zoomLabel").addEventListener("click", () => setZoom("fit"));
  $("#fitWidthButton").addEventListener("click", () => setZoom("fit"));

  els.nextButton.addEventListener("click", nextSpread);
  els.prevButton.addEventListener("click", prevSpread);
  els.nextZone.addEventListener("click", nextSpread);
  els.prevZone.addEventListener("click", prevSpread);
  els.viewerNextButton.addEventListener("click", nextSpread);
  els.viewerPrevButton.addEventListener("click", prevSpread);
  els.firstButton.addEventListener("click", () => goToSpread(0));
  els.lastButton.addEventListener("click", () => goToSpread(spreadCount() - 1));

  $$(".view-tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));
  els.spreadGrid.addEventListener("click", (event) => {
    const spread = event.target.closest(".overview-spread");
    if (!spread) return;
    state.currentSpread = Number(spread.dataset.spread);
    setView("flip");
    renderBook(false);
    renderPageList();
    updateBookDecorations();
  });
  els.spreadGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const spread = event.target.closest(".overview-spread");
    if (!spread) return;
    event.preventDefault();
    spread.click();
  });

  let modelDrag = null;
  els.modelStage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    hideLoupe();
    modelDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rotationX: state.modelRotation.x,
      rotationY: state.modelRotation.y,
    };
    els.modelStage.setPointerCapture(event.pointerId);
    els.modelStage.classList.add("is-dragging");
  });
  els.modelStage.addEventListener("pointermove", (event) => {
    if (!modelDrag || event.pointerId !== modelDrag.pointerId) return;
    const deltaX = event.clientX - modelDrag.startX;
    const deltaY = event.clientY - modelDrag.startY;
    state.modelRotation.y = modelDrag.rotationY + deltaX * 0.32;
    state.modelRotation.x = clamp(modelDrag.rotationX - deltaY * 0.24, -72, 72);
    updateModelTransform();
  });
  const stopModelDrag = (event) => {
    if (!modelDrag || event.pointerId !== modelDrag.pointerId) return;
    modelDrag = null;
    els.modelStage.classList.remove("is-dragging");
  };
  els.modelStage.addEventListener("pointerup", stopModelDrag);
  els.modelStage.addEventListener("pointercancel", stopModelDrag);
  els.modelStage.addEventListener(
    "wheel",
    (event) => {
      if (state.view !== "model") return;
      event.preventDefault();
      const maxZoom = state.quality === "halftone" ? 3.2 : 2.4;
      state.modelZoom = clamp(
        state.modelZoom + (event.deltaY > 0 ? -0.07 : 0.07),
        0.55,
        maxZoom
      );
      updateModelTransform();
    },
    { passive: false }
  );
  els.modelResetButton.addEventListener("click", () => {
    state.modelRotation = { x: -8, y: -17 };
    state.modelZoom = 1;
    updateModelTransform();
    showToast("3D 视角已复位");
  });
  els.modelStage.addEventListener("dblclick", (event) => {
    if (event.target.closest("button")) return;
    state.modelRotation = { x: -8, y: -17 };
    state.modelZoom = 1;
    updateModelTransform();
  });

  $("#presentButton").addEventListener("click", enterPresentation);
  $("#presentationClose").addEventListener("click", exitPresentation);
  els.presentationPrev.addEventListener("click", () => {
    if (state.currentSpread > 0) {
      goToSpread(state.currentSpread - 1);
      updatePresentationContent();
    }
  });
  els.presentationNext.addEventListener("click", () => {
    if (state.currentSpread < spreadCount() - 1) {
      goToSpread(state.currentSpread + 1);
      updatePresentationContent();
    }
  });

  $("#shuffleButton").addEventListener("click", shufflePages);
  $("#clearButton").addEventListener("click", clearImages);
  $("#resetButton").addEventListener("click", resetAll);
  $("#themeButton").addEventListener("click", toggleTheme);
  $("#shortcutsButton").addEventListener("click", () => (els.shortcutModal.hidden = false));
  $$("[data-close-modal]").forEach((node) => node.addEventListener("click", () => (els.shortcutModal.hidden = true)));

  const dropTargets = [els.stage, document.body];
  dropTargets.forEach((target) => {
    target.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      els.dragOverlay.classList.add("visible");
    });
    target.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && target.contains(event.relatedTarget)) return;
      els.dragOverlay.classList.remove("visible");
    });
    target.addEventListener("drop", (event) => {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      els.dragOverlay.classList.remove("visible");
      addImages(event.dataTransfer.files);
    });
  });
  document.addEventListener("paste", addImagesFromClipboard);
  els.stage.addEventListener("pointermove", updateLoupe);
  els.stage.addEventListener("pointerleave", hideLoupe);

  window.addEventListener("resize", () => {
    setBookDimensions();
    setModelDimensions();
    renderOverview();
    if (state.presentation) applyPresentationBookSize();
  });
  window.addEventListener("scroll", lockViewportScroll, { passive: true });
  document.addEventListener(
    "focusin",
    (event) => {
      if (event.target.matches(".toggle-row input")) requestAnimationFrame(lockViewportScroll);
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea")) return;
    if (event.key === "Escape") {
      if (!els.presentationOverlay.hidden) exitPresentation();
      els.shortcutModal.hidden = true;
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prevSpread();
      updatePresentationContent();
    }
    if (event.key === "ArrowRight" || event.key === " ") {
      event.preventDefault();
      nextSpread();
      updatePresentationContent();
    }
    if (event.key.toLowerCase() === "p") {
      if (state.presentation) exitPresentation();
      else enterPresentation();
    }
    if (event.key.toLowerCase() === "u") els.fileInput.click();
    if (event.key === "0") setZoom("fit");
  });
}

function bootstrap() {
  try {
    const savedTheme = localStorage.getItem("folio-theme");
    if (savedTheme) els.root.dataset.theme = savedTheme;
  } catch {
    // Local storage may be unavailable in a strict privacy mode.
  }
  bindEvents();
  applyBindingButtonOrder();
  renderAll();
  lockViewportScroll();
}

bootstrap();
