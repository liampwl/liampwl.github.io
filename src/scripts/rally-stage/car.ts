// Arcade rally handling. Heading rotates toward what the steering asks for;
// world velocity lags behind it and tyre grip pulls it back in line, capped
// at what the surface can give. Low grip or the handbrake lets the gap grow,
// which is the slide.

export interface Surface {
  grip: number;
  top: number; // m/s
  loose: boolean; // throws dust rather than spray
}

export const SURFACES: Record<string, Surface> = {
  tarmac: { grip: 1.0, top: 46, loose: false },
  gravel: { grip: 0.72, top: 42, loose: true },
  clay: { grip: 0.7, top: 41, loose: true },
};

export const WEATHER_GRIP: Record<string, number> = {
  Bright: 1, Dry: 1, Cloudy: 0.97, Drizzle: 0.86, Rain: 0.76, Storm: 0.7,
};

export interface Input {
  throttle: number;
  brake: number;
  steer: number; // −1 right … +1 left
  handbrake: boolean;
}

export interface CarState {
  x: number; y: number; z: number;
  vx: number; vz: number; vy: number;
  heading: number; // forward = (sin, cos)
  yawRate: number;
  steer: number;
  airborne: boolean;
  slip: number; // lateral speed, m/s
  rpm: number;
  gear: number;
  pitch: number;
  roll: number;
  landing: number; // impact speed on the last touchdown
}

const WHEELBASE = 2.8;
const G = 9.81;
const GEARS = [0, 13, 21, 29, 36, 43];

export function newCar(x: number, y: number, z: number, heading: number): CarState {
  return {
    x, y, z, vx: 0, vz: 0, vy: 0, heading, yawRate: 0, steer: 0, airborne: false,
    slip: 0, rpm: 900, gear: 1, pitch: 0, roll: 0, landing: 0,
  };
}

export function forwardSpeed(c: CarState) {
  return c.vx * Math.sin(c.heading) + c.vz * Math.cos(c.heading);
}

export interface Ground {
  y: number;
  slope: number; // dy/ds along the road
  curve: number; // d²y/ds²; negative over a crest
}

export function stepCar(c: CarState, inp: Input, dt: number, grip: number, top: number, offroad: number, ground: Ground) {
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  const rx = -fz, rz = fx;
  let vf = c.vx * fx + c.vz * fz;
  let vl = c.vx * rx + c.vz * rz;
  const speed = Math.hypot(c.vx, c.vz);

  // Steering eases in, snaps back faster, and narrows with speed
  const target = inp.steer;
  const rate = Math.sign(target) !== Math.sign(c.steer) || target === 0 ? 6 : 3.2;
  c.steer += Math.max(-dt * rate, Math.min(dt * rate, target - c.steer));
  const maxSteer = 0.62 - 0.46 * Math.min(1, speed / 38);
  const delta = c.steer * maxSteer;

  const g = grip * (offroad > 0 ? 0.62 : 1);
  if (!c.airborne) {
    // Longitudinal
    const reversing = vf < 0.5 && inp.brake > 0.1 && inp.throttle < 0.1;
    if (reversing) {
      vf -= 5 * inp.brake * dt;
      vf = Math.max(vf, -8);
    } else {
      const drive = inp.throttle * 10.5 * Math.max(0, 1 - Math.max(0, vf) / top) ** 0.8 * (0.6 + 0.4 * g);
      vf += drive * dt;
      if (vf > 0) vf = Math.max(0, vf - inp.brake * 11.5 * g * dt);
    }
    const drag = 0.0016 * vf * Math.abs(vf) + 0.25 * Math.sign(vf) + offroad * 4 * Math.sign(vf) * Math.min(1, Math.abs(vf) / 5);
    vf -= Math.abs(drag * dt) > Math.abs(vf) ? vf : drag * dt;

    // Yaw: what the front wheels ask for, a bit beyond what grip allows
    let w = (vf * Math.tan(delta)) / WHEELBASE;
    const latMax = g * G * 1.35;
    if (Math.abs(w * vf) > latMax) w = (Math.sign(w) * latMax) / Math.max(1, Math.abs(vf));
    let latGrip = g * G;
    if (inp.handbrake) {
      w *= 1.9;
      latGrip *= 0.38;
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), 4 * dt);
    }
    c.yawRate += (w - c.yawRate) * Math.min(1, dt * 7 * g);

    // Tyres pull the lateral slide back toward zero, up to the grip limit
    const pull = Math.min(Math.abs(vl) * (1 - Math.exp(-dt * 9 * g)), latGrip * dt);
    vl -= Math.sign(vl) * pull;
  }

  c.vx = vf * fx + vl * rx;
  c.vz = vf * fz + vl * rz;
  c.heading += c.yawRate * dt;
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  c.slip = vl;

  // Vertical: follow the road until it curves away faster than gravity can
  // pull the car down with it (curvature × speed² beyond g)
  c.landing = 0;
  const v2 = c.vx * c.vx + c.vz * c.vz;
  const rise = ground.slope * Math.sqrt(v2);
  if (c.airborne) {
    c.vy -= G * dt;
    c.y += c.vy * dt;
    if (c.y <= ground.y) {
      c.landing = Math.max(0, rise - c.vy);
      c.y = ground.y;
      c.vy = rise;
      c.airborne = false;
    }
  } else if (ground.curve * v2 < -G * 1.05 && v2 > 64) {
    c.airborne = true;
    c.vy = rise;
    c.y += c.vy * dt;
  } else {
    c.y = ground.y;
    c.vy = rise;
  }

  // Gearbox and tacho, for show
  const v = Math.abs(vf);
  let gear = 1;
  while (gear < 6 && v > GEARS[gear] - (gear < c.gear ? 2 : 0)) gear++;
  c.gear = vf < -0.5 ? 0 : gear;
  const lo = gear === 1 ? 0 : GEARS[gear - 1] - 4;
  const hi = gear === 6 ? top : GEARS[gear];
  const target_rpm = 1100 + 5900 * Math.min(1.05, Math.max(0, (v - lo) / Math.max(1, hi - lo)));
  const spin = c.airborne || Math.abs(vl) > 3 ? 900 * inp.throttle : 0;
  c.rpm += (target_rpm + spin + (inp.throttle > 0 && v < 2 ? 1800 * inp.throttle : 0) - c.rpm) * Math.min(1, dt * 8);

  // Body language
  // Positive roll lifts the left side, so a left turn leans the body right
  c.roll += (Math.max(-0.07, Math.min(0.07, c.yawRate * vf * 0.006)) - c.roll) * Math.min(1, dt * 6);
  const accelPitch = (inp.brake > 0 && vf > 1 ? 0.025 * inp.brake : 0) - inp.throttle * 0.012;
  c.pitch += (accelPitch - c.pitch) * Math.min(1, dt * 5);
}
