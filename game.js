const items = [
  { id: "tube-red", label: "Striped charm", pair: "tube", image: "./assets/items/tube_red.png", x: 40, y: 23, size: 60 },
  { id: "tube-rainbow", label: "Striped charm", pair: "tube", image: "./assets/items/tube_rainbow.png", x: 60, y: 23, size: 60 },
  { id: "star-purple", label: "Star ball", pair: "star", image: "./assets/items/star_purple.png", x: 36, y: 49, size: 64 },
  { id: "star-orange", label: "Star ball", pair: "star", image: "./assets/items/star_orange.png", x: 64, y: 49, size: 64 },
  { id: "record-left", label: "Record charm", pair: "record", image: "./assets/items/record_left.png", x: 50, y: 31, size: 62 },
  { id: "record-right", label: "Record charm", pair: "record", image: "./assets/items/record_right.png", x: 50, y: 62, size: 62 },
  { id: "key-round", label: "Island key", pair: "key", image: "./assets/items/key_round.png", x: 38, y: 76, size: 66 },
  { id: "key-blue", label: "Island key", pair: "key", image: "./assets/items/key_blue.png", x: 62, y: 76, size: 66 },
  { id: "coconut-smile", label: "Coconut friend", pair: "coconut", image: "./assets/items/coconut_smile.png", x: 45, y: 85, size: 62 },
  { id: "coconut-eyes", label: "Coconut friend", pair: "coconut", image: "./assets/items/coconut_eyes.png", x: 55, y: 85, size: 62 },
];

const SEGMENT_LENGTH = 3;
const TOTAL_SEGMENTS = 5;

const state = {
  selectedId: null,
  matchedPairs: new Set(),
  matchedItems: new Set(),
  segmentIndex: 0,
  advancing: false,
  metadataReady: null,
  audioReady: false,
  audio: null,
};

const storyVideo = document.querySelector("#storyVideo");
const itemsLayer = document.querySelector("#items");
const links = document.querySelector("#links");
const burstLayer = document.querySelector("#burstLayer");
const statusEl = document.querySelector("#status");
const intro = document.querySelector("#intro");
const outro = document.querySelector("#outro");

function init() {
  renderItems();
  prepareVideo();
  document.querySelector("#startButton").addEventListener("click", startGame);
  document.querySelector("#replayButton").addEventListener("click", restartGame);
}

function startGame() {
  unlockAudio();
  intro.classList.add("is-hidden");
  statusEl.textContent = "Choose two matching memory items.";
}

function restartGame() {
  state.selectedId = null;
  state.matchedPairs.clear();
  state.matchedItems.clear();
  state.segmentIndex = 0;
  state.advancing = false;
  storyVideo.pause();
  storyVideo.currentTime = 0;
  renderItems();
  outro.classList.add("is-hidden");
  statusEl.textContent = "Choose two matching memory items.";
}

function showWin() {
  outro.classList.remove("is-hidden");
  document.querySelector("#replayButton").focus({ preventScroll: true });
}

function prepareVideo() {
  storyVideo.pause();
  storyVideo.controls = false;
  state.metadataReady = new Promise((resolve) => {
    if (storyVideo.readyState >= 1) {
      resolve();
      return;
    }
    storyVideo.addEventListener("loadedmetadata", resolve, { once: true });
  });

  state.metadataReady.then(() => {
    if (state.segmentIndex === 0 && !state.advancing) {
      storyVideo.currentTime = 0;
      storyVideo.pause();
    }
  });
}

function renderItems() {
  itemsLayer.innerHTML = "";
  items.forEach((item) => {
    const button = document.createElement("button");
    button.className = "memory-item";
    button.type = "button";
    button.dataset.id = item.id;
    button.dataset.pair = item.pair;
    button.style.setProperty("--x", `${item.x}%`);
    button.style.setProperty("--y", `${item.y}%`);
    button.style.setProperty("--item-size", `${item.size}px`);
    button.setAttribute("aria-label", item.label);
    button.innerHTML = `<img src="${item.image}" alt="" draggable="false" />`;
    button.addEventListener("click", () => chooseItem(item));
    itemsLayer.appendChild(button);
  });
}

function chooseItem(item) {
  if (state.advancing || state.matchedItems.has(item.id)) return;
  unlockAudio();

  if (!state.selectedId) {
    state.selectedId = item.id;
    getButton(item.id).classList.add("selected");
    statusEl.textContent = `${item.label} selected.`;
    playTone(540, 0.04, "sine", 0.035);
    return;
  }

  if (state.selectedId === item.id) return;

  const first = items.find((candidate) => candidate.id === state.selectedId);
  const firstButton = getButton(first.id);
  const secondButton = getButton(item.id);
  firstButton.classList.remove("selected");
  state.selectedId = null;

  if (first.pair === item.pair) {
    handleMatch(first, item);
  } else {
    handleMiss(first, item, firstButton, secondButton);
  }
}

function handleMatch(a, b) {
  state.matchedPairs.add(a.pair);
  state.matchedItems.add(a.id);
  state.matchedItems.add(b.id);

  getButton(a.id).classList.add("matched");
  getButton(b.id).classList.add("matched");
  drawLine(a, b, "memory-line");
  burstAt(a.x, a.y);
  burstAt(b.x, b.y);
  statusEl.textContent = "Correct match.";
  playMatchSound();
  playNextSegment();
}

function handleMiss(a, b, firstButton, secondButton) {
  drawLine(a, b, "memory-line wrong");
  firstButton.classList.add("wrong");
  secondButton.classList.add("wrong");
  setTimeout(() => {
    firstButton.classList.remove("wrong");
    secondButton.classList.remove("wrong");
  }, 380);
  statusEl.textContent = "Try another pair.";
  playTone(160, 0.12, "triangle", 0.07);
}

function playNextSegment() {
  if (state.segmentIndex >= TOTAL_SEGMENTS) return;
  state.advancing = true;
  setItemsLocked(true);

  const playSegment = () => {
    const start = state.segmentIndex * SEGMENT_LENGTH;
    const end = Math.min((state.segmentIndex + 1) * SEGMENT_LENGTH, storyVideo.duration || 15);
    state.segmentIndex += 1;
    storyVideo.pause();
    storyVideo.currentTime = start;
    const playPromise = storyVideo.play();
    if (playPromise) {
      playPromise.catch(() => {
        state.advancing = false;
        setItemsLocked(false);
      });
    }

    const stop = () => {
      if (storyVideo.currentTime >= end - 0.035 || storyVideo.ended) {
        storyVideo.removeEventListener("timeupdate", stop);
        storyVideo.pause();
        state.advancing = false;
        setItemsLocked(false);
        if (state.segmentIndex === TOTAL_SEGMENTS) {
          statusEl.textContent = "All memories matched.";
          playVictorySound();
          setTimeout(showWin, 1200);
        }
      }
    };
    storyVideo.addEventListener("timeupdate", stop);
    stop();
  };

  if (storyVideo.readyState >= 1) {
    playSegment();
    return;
  }

  state.metadataReady.then(playSegment);
}

function setItemsLocked(locked) {
  document.querySelectorAll(".memory-item:not(.matched)").forEach((button) => {
    button.classList.toggle("locked", locked);
  });
}

function drawLine(a, b, className) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", a.x);
  line.setAttribute("y1", a.y);
  line.setAttribute("x2", b.x);
  line.setAttribute("y2", b.y);
  line.setAttribute("class", className);
  links.appendChild(line);
  if (className.includes("wrong")) {
    setTimeout(() => line.remove(), 440);
  } else {
    setTimeout(() => line.classList.add("complete"), 520);
    setTimeout(() => line.remove(), 980);
  }
}

function burstAt(x, y) {
  for (let i = 0; i < 16; i += 1) {
    const spark = document.createElement("span");
    spark.className = "spark";
    spark.style.setProperty("--x", `${x}%`);
    spark.style.setProperty("--y", `${y}%`);
    spark.style.setProperty("--angle", `${i * 22.5}deg`);
    spark.style.setProperty("--distance", `${38 + (i % 4) * 10}px`);
    burstLayer.appendChild(spark);
    setTimeout(() => spark.remove(), 820);
  }
}

function getButton(id) {
  return document.querySelector(`[data-id="${id}"]`);
}

function unlockAudio() {
  if (state.audioReady) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  state.audio = new AudioContext();
  state.audioReady = true;
}

function playTone(frequency, duration, type = "sine", gainValue = 0.05, delay = 0) {
  if (!state.audioReady || !state.audio) return;
  const now = state.audio.currentTime + delay;
  const oscillator = state.audio.createOscillator();
  const gain = state.audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(state.audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function playMatchSound() {
  playTone(520, 0.11, "sine", 0.045);
  playTone(780, 0.12, "sine", 0.04, 0.08);
}

function playVictorySound() {
  [523, 659, 784, 1046].forEach((note, index) => {
    playTone(note, 0.16, "sine", 0.05, index * 0.1);
  });
}

init();
