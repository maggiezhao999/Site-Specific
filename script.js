
import * as Tone from "tone";

// --------------------------------
// CANVAS
// --------------------------------

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// --------------------------------
// IMAGES
// --------------------------------

const cityImage = new Image();
cityImage.src = "/NYC.JPG";

const bgImage = new Image();
bgImage.src = "/bg.png";

// --------------------------------
// SETTINGS
// --------------------------------

const duration = 90;

const bridgeStart = 0.10;
const bridgeEnd = 0.90;

// City image settings
const cityZoom = 1.6;
const cityDarkness = 0.15;
const cityMovement = 1;

// Negative = move image upward
// Positive = move image downward
const cityY = -80;

let currentTime = 0;
let playing = false;
let dragging = false;
let lastFrame = performance.now();

// --------------------------------
// PASSENGER DATA
// --------------------------------

const passengers = [
  [{ start: 7, end: 18 }, { start: 40, end: 51 }],
  [{ start: 9, end: 25 }, { start: 76, end: 86 }],
  [{ start: 16, end: 34 }, { start: 65, end: 80 }],
  [{ start: 5, end: 14 }, { start: 42, end: 59 }],
  [{ start: 20, end: 36 }, { start: 79, end: 89 }],
  [{ start: 12, end: 29 }, { start: 55, end: 72 }],
  [{ start: 4, end: 16 }, { start: 71, end: 85 }],
  [{ start: 30, end: 47 }, { start: 81, end: 90 }],
  [{ start: 8, end: 20 }, { start: 48, end: 61 }],
  [{ start: 25, end: 39 }, { start: 73, end: 88 }]
];

const notes = [
  "C3", "D3", "E3", "G3", "A3",
  "C4", "D4", "E4", "G4", "A4"
];

// --------------------------------
// AUDIO
// --------------------------------

const synths = notes.map(() => {
  const synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.15,
      decay: 0.2,
      sustain: 0.5,
      release: 0.4
    }
  }).toDestination();

  synth.volume.value = -22;
  return synth;
});

const sounding = Array(passengers.length).fill(false);
let audioReady = false;

async function startAudio() {
  if (!audioReady) {
    await Tone.start();
    audioReady = true;
  }
}

function stopAllNotes() {
  synths.forEach(synth => synth.triggerRelease());
  sounding.fill(false);
}

function updateAudio() {
  if (!audioReady) return;

  passengers.forEach((events, i) => {
    const active = events.some(event =>
      currentTime >= event.start &&
      currentTime < event.end
    );

    if (playing && !dragging && active && !sounding[i]) {
      synths[i].triggerAttack(notes[i]);
      sounding[i] = true;
    }

    if ((!playing || dragging || !active) && sounding[i]) {
      synths[i].triggerRelease();
      sounding[i] = false;
    }
  });
}

// --------------------------------
// SPACEBAR PLAY / PAUSE
// --------------------------------

window.addEventListener("keydown", async (e) => {
  if (e.code !== "Space" || e.repeat) return;

  e.preventDefault();

  await startAudio();

  playing = !playing;

  if (!playing) {
    stopAllNotes();
  } else if (currentTime >= duration) {
    currentTime = 0;
  }

  lastFrame = performance.now();
  updateAudio();
});

// --------------------------------
// RESIZE
// --------------------------------

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

// --------------------------------
// LAYOUT
// --------------------------------

function getLayout() {
  const W = canvas.width;
  const H = canvas.height;

  return {
    left: W * 0.08,
    right: W * 0.92,
    tracksTop: H * 0.63,
    tracksBottom: H * 0.88,
    routeY: H * 0.93
  };
}

// --------------------------------
// TIMELINE DRAGGING
// --------------------------------

function seekTo(clientX) {
  const { left, right } = getLayout();

  const progress = Math.max(
    0,
    Math.min(1, (clientX - left) / (right - left))
  );

  currentTime = progress * duration;
}

canvas.addEventListener("pointerdown", (e) => {
  const layout = getLayout();

  if (
    e.clientY >= layout.tracksTop - 15 &&
    e.clientY <= layout.routeY + 20
  ) {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);

    stopAllNotes();
    seekTo(e.clientX);
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (dragging) {
    seekTo(e.clientX);
  }
});

function endDragging() {
  if (!dragging) return;

  dragging = false;
  lastFrame = performance.now();
  updateAudio();
}

canvas.addEventListener("pointerup", endDragging);
canvas.addEventListener("pointercancel", endDragging);

// --------------------------------
// DRAW IMAGE COVER
// --------------------------------

function drawCover(image, W, H, zoom = 1) {
  const scale = Math.max(
    W / image.width,
    H / image.height
  ) * zoom;

  const imgW = image.width * scale;
  const imgH = image.height * scale;

  ctx.drawImage(
    image,
    (W - imgW) / 2,
    (H - imgH) / 2,
    imgW,
    imgH
  );
}

// --------------------------------
// DRAW CITY
// --------------------------------

function drawCity(W, H, progress) {
  if (!cityImage.complete || cityImage.naturalWidth === 0) {
    return;
  }

  const scale = Math.max(
    W / cityImage.width,
    H / cityImage.height
  ) * cityZoom;

  const imgW = cityImage.width * scale;
  const imgH = cityImage.height * scale;

  const bridgeProgress = Math.max(
    0,
    Math.min(
      1,
      (progress - bridgeStart) / (bridgeEnd - bridgeStart)
    )
  );

  // Available horizontal movement
  const maxOffset = Math.max(0, imgW - W);

  // Move image from right to left
  const offset = bridgeProgress * maxOffset * cityMovement;

  const imgX = -offset;

  // Move image upward
  const imgY = (H - imgH) / 2 + cityY;

  ctx.drawImage(
    cityImage,
    imgX,
    imgY,
    imgW,
    imgH
  );

  // Dark overlay
  ctx.fillStyle = `rgba(0, 0, 0, ${cityDarkness})`;
  ctx.fillRect(0, 0, W, H);
}

// --------------------------------
// MAIN DRAW
// --------------------------------

function draw(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  if (playing && !dragging) {
    currentTime += dt;

    if (currentTime >= duration) {
      currentTime = duration;
      playing = false;
      stopAllNotes();
    } else {
      updateAudio();
    }
  }

  const W = canvas.width;
  const H = canvas.height;

  const {
    left,
    right,
    tracksTop,
    tracksBottom,
    routeY
  } = getLayout();

  const w = right - left;
  const progress = currentTime / duration;
  const cursorX = left + progress * w;

  const onBridge =
    progress >= bridgeStart &&
    progress <= bridgeEnd;

  // --------------------------------
  // LAYER 1: CITY BACKGROUND
  // --------------------------------

  ctx.fillStyle = "#0d0d11";
  ctx.fillRect(0, 0, W, H);

  if (onBridge) {
    drawCity(W, H, progress);
  }

  // --------------------------------
  // LAYER 2: SUBWAY INTERIOR
  // --------------------------------

  if (bgImage.complete && bgImage.naturalWidth > 0) {
    drawCover(bgImage, W, H);
  }

  // --------------------------------
  // LAYER 3: ATTENTION LINES
  // --------------------------------

  const sceneTop = H * 0.08;
  const sceneBottom = H * 0.56;

  passengers.forEach((events, i) => {
    const active = events.some(event =>
      currentTime >= event.start &&
      currentTime < event.end
    );

    if (active) {
      const x =
        left + (i + 0.5) *
        (w / passengers.length);

      ctx.strokeStyle = "#ff4650";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(x, sceneTop);
      ctx.lineTo(x, sceneBottom);
      ctx.stroke();
    }
  });

  // --------------------------------
  // LAYER 4: PASSENGER TRACKS
  // --------------------------------

  const rowH =
    (tracksBottom - tracksTop) /
    passengers.length;

  passengers.forEach((events, i) => {
    const y =
      tracksTop + i * rowH + rowH / 2;

    ctx.strokeStyle = "#393943";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    events.forEach(event => {
      const x1 =
        left + (event.start / duration) * w;

      const x2 =
        left + (event.end / duration) * w;

      const active =
        currentTime >= event.start &&
        currentTime < event.end;

      ctx.fillStyle = active
        ? "#ff4650"
        : "#8c303b";

      ctx.fillRect(
        x1,
        y - rowH * 0.28,
        x2 - x1,
        rowH * 0.56
      );
    });
  });

  // --------------------------------
  // LAYER 5: TIME CURSOR
  // --------------------------------

  ctx.strokeStyle = "#ff4650";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(cursorX, sceneTop);
  ctx.lineTo(cursorX, tracksBottom + 8);
  ctx.stroke();

  // --------------------------------
  // LAYER 6: ROUTE PROGRESS
  // --------------------------------

  ctx.strokeStyle = "#44444b";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(left, routeY);
  ctx.lineTo(right, routeY);
  ctx.stroke();

  ctx.strokeStyle = "#ffffffff";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(left + w * bridgeStart, routeY);
  ctx.lineTo(left + w * bridgeEnd, routeY);
  ctx.stroke();

  ctx.fillStyle = "#ff4650";

  ctx.beginPath();
  ctx.arc(cursorX, routeY, 5, 0, Math.PI * 2);
  ctx.fill();

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
