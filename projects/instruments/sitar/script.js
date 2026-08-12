const notes = [
  { key: "a", note: "C4", frequency: 261.63 },
  { key: "s", note: "D4", frequency: 293.66 },
  { key: "d", note: "E4", frequency: 329.63 },
  { key: "f", note: "G4", frequency: 392.00 },
  { key: "g", note: "A4", frequency: 440.00 },
  { key: "h", note: "C5", frequency: 523.25 },
  { key: "j", note: "D5", frequency: 587.33 }
];

const strings = document.querySelector("#strings");
const status = document.querySelector("#status");
const soundButton = document.querySelector("#soundButton");
let audioContext;
let soundEnabled = true;

function getAudioContext() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function pluck(index) {
  const item = notes[index];
  const element = document.querySelector(`[data-index="${index}"]`);
  element.classList.remove("active");
  void element.offsetWidth;
  element.classList.add("active");
  setTimeout(() => element.classList.remove("active"), 120);
  status.textContent = `${item.note} · string ${index + 1}`;

  if (!soundEnabled) return;

  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(item.frequency, now);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2600, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.34, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);

  oscillator.connect(filter).connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 1.2);
}

notes.forEach((item, index) => {
  const button = document.createElement("button");
  button.className = "string";
  button.dataset.index = index;
  button.style.setProperty("--thickness", `${2 + index * 0.35}px`);
  button.setAttribute("aria-label", `Play ${item.note}, string ${index + 1}`);
  button.innerHTML = `<span class="string-label">${item.key.toUpperCase()}</span>`;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pluck(index);
  });
  strings.appendChild(button);
});

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const index = notes.findIndex((item) => item.key === event.key.toLowerCase());
  if (index !== -1) {
    event.preventDefault();
    pluck(index);
  }
});

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "Sound on" : "Sound off";
  soundButton.setAttribute("aria-pressed", String(!soundEnabled));
  status.textContent = soundEnabled ? "Sound enabled." : "Sound muted.";
});
