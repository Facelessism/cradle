const strings = [
  { key: "a", note: "Sa", frequency: 261.63 },
  { key: "s", note: "Re", frequency: 293.66 },
  { key: "d", note: "Ga", frequency: 329.63 },
  { key: "f", note: "Ma", frequency: 349.23 },
  { key: "g", note: "Pa", frequency: 392.0 },
  { key: "h", note: "Dha", frequency: 440.0 },
  { key: "j", note: "Ni", frequency: 493.88 },
];

const stringsElement = document.getElementById("strings");
const noteName = document.getElementById("noteName");
const status = document.getElementById("status");
const muteButton = document.getElementById("muteButton");

let audioContext;
let muted = false;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(frequency) {
  if (muted) return;

  const context = getAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    frequency * 0.985,
    context.currentTime + 0.8
  );

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.1);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 1.15);
}

function pluck(index) {
  const item = strings[index];
  const button = stringsElement.children[index];

  button.classList.remove("plucked");
  void button.offsetWidth;
  button.classList.add("plucked");

  setTimeout(() => button.classList.remove("plucked"), 180);

  noteName.textContent = item.note;
  status.textContent = `Plucked string ${index + 1} · ${item.note} · ${item.key.toUpperCase()}`;
  playTone(item.frequency);
}

strings.forEach((item, index) => {
  const button = document.createElement("button");
  button.className = "string";
  button.type = "button";
  button.dataset.index = index;
  button.setAttribute("aria-label", `Sitar string ${index + 1}, ${item.note}, key ${item.key.toUpperCase()}`);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pluck(index);
  });
  stringsElement.appendChild(button);
});

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const index = strings.findIndex((item) => item.key === event.key.toLowerCase());
  if (index !== -1) {
    event.preventDefault();
    pluck(index);
  }
});

muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "Sound off" : "Sound on";
  muteButton.setAttribute("aria-pressed", String(muted));
  status.textContent = muted ? "Sound muted." : "Sound enabled.";
});
