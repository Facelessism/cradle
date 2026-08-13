const instruments = [
  { name: "Kick Drum", key: "a", type: "kick" },
  { name: "Snare", key: "s", type: "snare" },
  { name: "Hi-Hat", key: "d", type: "hihat" },
  { name: "Tom", key: "f", type: "tom" },
  { name: "Clap", key: "g", type: "clap" },
  { name: "Cymbal", key: "h", type: "cymbal" },
];

const container = document.getElementById("percussionSet");
const status = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");

let audioContext;

function getAudioContext() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playSound(index) {
  const ctx = getAudioContext();
  const instrument = instruments[index];
  const now = ctx.currentTime;

  if (instrument.type === "kick" || instrument.type === "tom") {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startFrequency = instrument.type === "kick" ? 150 : 220;
    const endFrequency = instrument.type === "kick" ? 45 : 90;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + 0.15);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  } else {
    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    source.buffer = buffer;
    filter.type = instrument.type === "hihat" ? "highpass" : "bandpass";
    filter.frequency.value = instrument.type === "clap" ? 1200 : 5000;

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
  }

  const pad = container.children[index];
  pad.classList.add("active");
  status.textContent = `Playing ${instrument.name}`;

  window.setTimeout(() => pad.classList.remove("active"), 120);
}

instruments.forEach((instrument, index) => {
  const pad = document.createElement("button");

  pad.className = "pad";
  pad.type = "button";
  pad.setAttribute("aria-label", `Play ${instrument.name}`);
  pad.innerHTML = `<strong>${instrument.name}</strong><span>Key: ${instrument.key.toUpperCase()}</span>`;

  pad.addEventListener("pointerdown", () => playSound(index));
  container.appendChild(pad);
});

document.addEventListener("keydown", event => {
  if (event.repeat) return;

  const index = instruments.findIndex(
    instrument => instrument.key === event.key.toLowerCase()
  );

  if (index !== -1) {
    event.preventDefault();
    playSound(index);
  }
});

resetBtn.addEventListener("click", () => {
  status.textContent = "Choose an instrument to play";
  document.querySelectorAll(".pad").forEach(pad => {
    pad.classList.remove("active");
  });
});
