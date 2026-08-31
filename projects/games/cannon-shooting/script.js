let userCanX = 185;
let userCanY = 0;
let fireTime = 13000;
let countdown = fireTime / 1000 - 3;
let hitAudio = new Audio(
  "https://soundbible.com/mp3/Sniper_Rifle-Kibblesbob-2053709564.mp3"
);
let fireAudio = new Audio(
  "https://soundbible.com/mp3/Super%20Punch%20MMA-SoundBible.com-1869306362.mp3"
);

hitAudio.onerror = () => {
  /* audio unavailable */
};
fireAudio.onerror = () => {
  /* audio unavailable */
};

let stats = CannonStorage.loadStats();

function updateHUD() {
  const setTxt = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setTxt("hud-score", stats.score);
  setTxt("hud-high-score", stats.highScore);
  setTxt("hud-streak", stats.currentStreak + "🔥");
  setTxt("hud-best-streak", stats.bestStreak);
  const acc =
    stats.totalShots > 0
      ? Math.round((stats.totalHits / stats.totalShots) * 100)
      : 100;
  setTxt("hud-accuracy", acc + "%");
}

document.addEventListener("DOMContentLoaded", () => {
  updateHUD();
});

// Vanilla replacement for jQuery's $.fn.animate({left: ...}, duration, callback)
function animateLeft(el, targetLeft, duration, callback) {
  el.style.transition = `left ${duration}ms linear`;
  void el.offsetWidth; // force reflow so the transition applies
  el.style.left = targetLeft;
  const onEnd = (e) => {
    if (e.propertyName !== "left") return;
    el.removeEventListener("transitionend", onEnd);
    el.style.transition = "";
    if (callback) callback();
  };
  el.addEventListener("transitionend", onEnd);
}

setInterval(() => {
  countdown = countdown > 0 ? countdown : 0;
  const cd = document.querySelector(".countdown");
  if (cd) cd.textContent = countdown--;
}, 1000);

setInterval(() => {
  let cmCanPipe = document.querySelector(".cm .pipe");
  let allPipe = document.querySelectorAll(".pipe");
  let cmCan = document.querySelector(".cannon.cm");
  let canBalls = document.querySelectorAll(".ball");
  let cmCanAngle = Math.floor(Math.random() * 45);
  let cmCanX = Math.floor(Math.random() * 8) + 2;

  let ballMileage = CannonEngine.calculateBallMileage(cmCanX, cmCanAngle);
  countdown = fireTime / 1000 - 3;

  if (cmCanPipe) cmCanPipe.style.transform = "rotate(" + cmCanAngle + "deg)";
  if (cmCan) cmCan.style.transform = "translateX(" + cmCanX + "cm)";
  const cmWheel = document.querySelector(".cm .wheel");
  if (cmWheel) cmWheel.style.transform = "rotate(" + cmCanX + "deg)";

  const lvlMon = document.querySelector(".level-monitor");
  if (lvlMon) lvlMon.textContent = cmCanAngle;
  canBalls.forEach((ball) => {
    ball.style.transition = "";
    ball.style.left = "0";
  });
  allPipe.forEach((pipe) => pipe.classList.remove("fire"));
  document.querySelector(".game-container")?.classList.remove("defended");
  const levelEl = document.querySelector(".level");
  if (levelEl) levelEl.style.width = ballMileage + "cm";

  setTimeout(() => {
    let comCanX = cmCanX * 37.79;
    let isHit = CannonEngine.validateHit(
      userCanX,
      userCanY,
      comCanX,
      cmCanAngle
    );

    try {
      fireAudio.play().catch(() => { });
    } catch (e) { }
    allPipe.forEach((pipe) => pipe.classList.add("fire"));

    const scoreResult = CannonEngine.calculateScore(
      isHit,
      stats.currentStreak
    );
    stats = CannonStorage.recordShot(
      stats,
      isHit,
      scoreResult.scoreAwarded,
      scoreResult.newStreak
    );
    updateHUD();

    if (isHit) {
      document.querySelector(".game-container")?.classList.add("defended");
      canBalls.forEach((ball) => {
        animateLeft(ball, -ballMileage + 4.23 + "cm", 500, () => {
          try {
            hitAudio.play().catch(() => { });
          } catch (e) { }
        });
      });
    } else {
      canBalls.forEach((ball) => animateLeft(ball, "-100vw", 1000));
    }
  }, fireTime - 2000);
}, fireTime);

document
  .querySelector(".wheel-handle")
  ?.addEventListener("mousedown", function (e) {
    const clickX = e.pageX;
    let canX = userCanX;

    function onMouseMove(e) {
      let canDX = e.pageX - clickX + userCanX;
      canX = canDX < 375 && canDX > 35 ? canDX : canX;

      const userCannon = document.querySelector(".user-col .cannon");
      if (userCannon) userCannon.style.transform = "translateX(" + canX + "px)";
      const userWheel = document.querySelector(".user-col .wheel");
      if (userWheel) userWheel.style.transform = "rotate(" + canX + "deg)";
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      userCanX = canX;
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

document
  .querySelector(".level-handle")
  ?.addEventListener("mousedown", function (e) {
    const clickY = e.pageY;
    let canY = userCanY;

    function onMouseMove(e) {
      let canDY = e.pageY - clickY + userCanY;
      canY = canDY < 65 && canDY > -5 ? canDY : canY;

      const lvlHandle = document.querySelector(".level-handle");
      if (lvlHandle) lvlHandle.textContent = canY;
      const userPipe = document.querySelector(".user-col .pipe");
      if (userPipe) userPipe.style.transform = "rotate(" + canY + "deg)";
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      userCanY = canY;
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });