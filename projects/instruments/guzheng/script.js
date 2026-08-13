const stringNotes = ["D", "E", "F#", "G", "A", "B", "C#", "D", "E", "F#"];
const keyboardKeys = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"];
const container = document.getElementById("strings");
const status = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");

let audioContext;

function getAudioContext() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playNote(index) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  const frequencies = [146.83, 164.81, 185.00, 196.00, 220.00, 246.94, 277.18, 293.66, 329.63, 369.99];
  const now = ctx.currentTime;

  oscillator.type = "triangle";
  oscillator.frequency.value = frequencies[index];
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 1.15);

  const string = container.children[index];
  string.classList.add("active");
  status.textContent = `Playing ${stringNotes[index]}`;
  window.setTimeout(() => string.classList.remove("active"), 120);
}

stringNotes.forEach((note, index) => {
  const string = document.createElement("button");
  string.className = "string";
  string.type = "button";
  string.dataset.note = note;
  string.setAttribute("aria-label", `Play ${note} string`);
  string.addEventListener("pointerdown", () => playNote(index));
  container.appendChild(string);
});

document.addEventListener("keydown", event => {
  if (event.repeat) return;
  const index = keyboardKeys.indexOf(event.key.toLowerCase());
  if (index !== -1) {
    event.preventDefault();
    playNote(index);
  }
});

resetBtn.addEventListener("click", () => {
  status.textContent = "Select a string to play";
  document.querySelectorAll(".string").forEach(string => string.classList.remove("active"));
});
