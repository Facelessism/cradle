// Cannon Kinematics Physics Engine

function degToRad(deg) {
  return deg * (Math.PI / 180);
}

function calculateBallMileage(cmCanX, cmCanAngle) {
  const angleRad = degToRad(cmCanAngle);
  const cosVal = Math.cos(angleRad);
  if (cosVal === 0) return 0;
  return (cmCanX + 4.23) / cosVal;
}

function validateHit(
  userCanX,
  userCanY,
  comCanX,
  cmCanAngle,
  xTolerance = 5,
  angleTolerance = 2
) {
  const validX =
    userCanX - xTolerance <= comCanX && userCanX + xTolerance >= comCanX;
  const validAngle =
    userCanY - angleTolerance <= cmCanAngle &&
    userCanY + angleTolerance >= cmCanAngle;
  return validX && validAngle;
}

function calculateScore(isHit, currentStreak = 0) {
  if (!isHit) {
    return { scoreAwarded: 0, newStreak: 0, multiplier: 1 };
  }
  const newStreak = currentStreak + 1;
  const multiplier = Math.min(5, 1 + Math.floor((newStreak - 1) / 3));
  const scoreAwarded = 100 * multiplier;
  return { scoreAwarded, newStreak, multiplier };
}

const CannonEngine = {
  degToRad,
  calculateBallMileage,
  validateHit,
  calculateScore,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = CannonEngine;
} else if (typeof window !== "undefined") {
  window.CannonEngine = CannonEngine;
}
