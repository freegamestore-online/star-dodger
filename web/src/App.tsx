import { useEffect, useRef } from "react";
import {
  Actor,
  Circle,
  CollisionType,
  Color,
  DisplayMode,
  Engine,
  Font,
  Keys,
  Label,
  Polygon,
  Scene,
  TextAlign,
  Timer,
  vec,
  Vector,
} from "excalibur";
import { Shell } from "./components/Shell";

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 480;
const H = 700;

const NEON_SHIP   = "#00f5ff";   // cyan
const NEON_THRUST = "#ff00ff";   // magenta thruster glow
const NEON_ROCK_A = "#ff6b35";   // orange-red
const NEON_ROCK_B = "#ff3cac";   // hot pink
const NEON_ROCK_C = "#a855f7";   // purple
const BG          = "#050a14";
const STAR_DODGER_HS_KEY = "stardodger_highscore";

const ROCK_COLORS = [NEON_ROCK_A, NEON_ROCK_B, NEON_ROCK_C];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomRockColor(): Color {
  const hex = ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)] ?? NEON_ROCK_A;
  return Color.fromHex(hex);
}

/** Build a rough polygon that looks like an asteroid chunk */
function asteroidPolygon(r: number): Vector[] {
  const sides = 7 + Math.floor(Math.random() * 4); // 7–10 sides
  const pts: Vector[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const jitter = 0.65 + Math.random() * 0.45; // 65%–110% of radius
    pts.push(vec(Math.cos(angle) * r * jitter, Math.sin(angle) * r * jitter));
  }
  return pts;
}

// ─── Actors ───────────────────────────────────────────────────────────────────

class Asteroid extends Actor {
  constructor(x: number, speed: number, size: number, vx: number) {
    super({ x, y: -size - 10, width: size * 2, height: size * 2 });
    this.body.collisionType = CollisionType.Passive;
    this.vel = vec(vx, speed);
    this.angularVelocity = (Math.random() - 0.5) * 3;

    const color = randomRockColor();
    this.graphics.use(
      new Polygon({
        points: asteroidPolygon(size),
        color,
        strokeColor: Color.fromHex("#ffffff"),
        lineWidth: 1,
      })
    );
  }
}

/** A tiny particle that drifts upward from the ship thruster */
class ThrustParticle extends Actor {
  private life = 0;
  private maxLife: number;

  constructor(x: number, y: number) {
    const size = 3 + Math.random() * 4;
    super({ x, y, width: size, height: size });
    this.body.collisionType = CollisionType.PreventCollision;
    this.maxLife = 300 + Math.random() * 200;
    this.vel = vec((Math.random() - 0.5) * 40, 60 + Math.random() * 60);
    this.graphics.use(new Circle({ radius: size / 2, color: Color.fromHex(NEON_THRUST) }));
  }

  onPreUpdate(_engine: Engine, delta: number) {
    this.life += delta;
    if (this.life >= this.maxLife) {
      this.kill();
    } else {
      // fade out
      const alpha = 1 - this.life / this.maxLife;
      this.graphics.opacity = alpha;
    }
  }
}

/** Neon ship drawn as a triangle polygon */
class Ship extends Actor {
  private speed = 340;

  constructor() {
    super({ x: W / 2, y: H - 80, width: 36, height: 44 });
    this.body.collisionType = CollisionType.Active;

    // Triangle pointing up
    const shipPoints = [
      vec(0, -22),   // nose
      vec(18, 18),   // bottom-right
      vec(0, 10),    // inner bottom center
      vec(-18, 18),  // bottom-left
    ];
    this.graphics.use(
      new Polygon({
        points: shipPoints,
        color: Color.fromHex(NEON_SHIP),
        strokeColor: Color.fromHex("#ffffff"),
        lineWidth: 1.5,
      })
    );
  }

  onPreUpdate(engine: Engine, delta: number) {
    const dt = delta / 1000;
    const kb = engine.input.keyboard;
    let dx = 0;
    let dy = 0;

    if (kb.isHeld(Keys.Left)  || kb.isHeld(Keys.A)) dx -= 1;
    if (kb.isHeld(Keys.Right) || kb.isHeld(Keys.D)) dx += 1;
    if (kb.isHeld(Keys.Up)    || kb.isHeld(Keys.W)) dy -= 1;
    if (kb.isHeld(Keys.Down)  || kb.isHeld(Keys.S)) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      this.pos.x = Math.max(20, Math.min(W - 20, this.pos.x + (dx / len) * this.speed * dt));
      this.pos.y = Math.max(20, Math.min(H - 20, this.pos.y + (dy / len) * this.speed * dt));
    }
  }
}

// ─── Scenes ───────────────────────────────────────────────────────────────────

function buildStartScene(game: Engine, onStart: () => void): Scene {
  const scene = new Scene();

  const titleFont = new Font({ size: 42, family: "Fraunces", color: Color.fromHex(NEON_SHIP), textAlign: TextAlign.Center });
  const subFont   = new Font({ size: 18, family: "Manrope",  color: Color.fromHex("#94a3b8"), textAlign: TextAlign.Center });
  const tipFont   = new Font({ size: 14, family: "Manrope",  color: Color.fromHex("#475569"), textAlign: TextAlign.Center });

  const title = new Label({ text: "STAR DODGER", pos: vec(W / 2, H / 2 - 80), font: titleFont });
  const sub   = new Label({ text: "Survive the asteroid field", pos: vec(W / 2, H / 2 - 20), font: subFont });
  const start = new Label({ text: "Tap / Press SPACE to start", pos: vec(W / 2, H / 2 + 50), font: subFont });
  const tip   = new Label({ text: "Arrow keys · WASD · or drag to steer", pos: vec(W / 2, H / 2 + 90), font: tipFont });

  scene.add(title);
  scene.add(sub);
  scene.add(start);
  scene.add(tip);

  // Decorative drifting asteroids behind the title
  const deco = new Timer({
    interval: 900,
    repeats: true,
    action: () => {
      const a = new Asteroid(
        20 + Math.random() * (W - 40),
        60 + Math.random() * 80,
        12 + Math.random() * 14,
        (Math.random() - 0.5) * 30
      );
      scene.add(a);
    },
  });
  scene.add(deco);
  deco.start();

  // Pulse the start label
  let pulse = 0;
  scene.onPostUpdate = (_engine: Engine, delta: number) => {
    pulse += delta / 1000;
    start.graphics.opacity = 0.5 + 0.5 * Math.sin(pulse * 3);

    if (
      game.input.keyboard.wasPressed(Keys.Space) ||
      game.input.keyboard.wasPressed(Keys.Enter)
    ) {
      onStart();
    }
  };

  game.input.pointers.primary.on("down", () => {
    if (game.currentSceneName === "start") onStart();
  });

  return scene;
}

function buildGameScene(
  game: Engine,
  getHighScore: () => number,
  onGameOver: (score: number) => void
): Scene {
  const scene = new Scene();

  // ── Ship
  const ship = new Ship();
  scene.add(ship);

  // ── HUD labels
  const hudFont  = new Font({ size: 20, family: "Manrope", color: Color.fromHex("#e2e8f0"), textAlign: TextAlign.Left });
  const hsFont   = new Font({ size: 16, family: "Manrope", color: Color.fromHex("#64748b"), textAlign: TextAlign.Right });

  const scoreLabel = new Label({ text: "0s", pos: vec(14, 14), font: hudFont });
  const hsLabel    = new Label({ text: `Best: ${getHighScore()}s`, pos: vec(W - 14, 14), font: hsFont });
  scene.add(scoreLabel);
  scene.add(hsLabel);

  // ── State
  let survival = 0;    // seconds survived
  let alive    = true;

  // ── Pointer steering
  game.input.pointers.primary.on("move", (evt) => {
    if (alive) {
      ship.pos.x = Math.max(20, Math.min(W - 20, evt.worldPos.x));
      ship.pos.y = Math.max(20, Math.min(H - 20, evt.worldPos.y));
    }
  });

  // ── Collision
  ship.on("collisionstart", (evt) => {
    if (!alive) return;
    if (evt.other.owner instanceof Asteroid) {
      alive = false;
      onGameOver(Math.floor(survival));
    }
  });

  // ── Asteroid spawner — speeds up over time
  const spawner = new Timer({
    interval: 800,
    repeats: true,
    action: () => {
      if (!alive) return;
      const elapsed = survival;
      const baseSpeed  = 120 + elapsed * 5;   // ramps from 120 → fast
      const speedRange = 80  + elapsed * 3;
      const size = 14 + Math.random() * 20;   // radius 14–34
      const vx   = (Math.random() - 0.5) * (40 + elapsed * 2);
      const speed = Math.min(baseSpeed + Math.random() * speedRange, 600);
      scene.add(new Asteroid(20 + Math.random() * (W - 40), speed, size, vx));
    },
  });
  scene.add(spawner);
  spawner.start();

  // ── Thruster particles
  const thruster = new Timer({
    interval: 60,
    repeats: true,
    action: () => {
      if (!alive) return;
      scene.add(new ThrustParticle(ship.pos.x + (Math.random() - 0.5) * 10, ship.pos.y + 18));
    },
  });
  scene.add(thruster);
  thruster.start();

  // ── Game loop
  scene.onPostUpdate = (_engine: Engine, delta: number) => {
    if (!alive) return;

    survival += delta / 1000;
    scoreLabel.text = `${Math.floor(survival)}s`;
    hsLabel.text    = `Best: ${getHighScore()}s`;

    // Cull off-screen asteroids
    for (const actor of scene.actors) {
      if (actor instanceof Asteroid) {
        if (actor.pos.y > H + 60 || actor.pos.x < -80 || actor.pos.x > W + 80) {
          actor.kill();
        }
      }
    }
  };

  return scene;
}

function buildOverScene(
  game: Engine,
  score: number,
  highScore: number,
  onRestart: () => void
): Scene {
  const scene = new Scene();

  const titleFont = new Font({ size: 38, family: "Fraunces", color: Color.fromHex("#ff3cac"), textAlign: TextAlign.Center });
  const bodyFont  = new Font({ size: 22, family: "Manrope",  color: Color.fromHex("#e2e8f0"), textAlign: TextAlign.Center });
  const subFont   = new Font({ size: 16, family: "Manrope",  color: Color.fromHex("#64748b"), textAlign: TextAlign.Center });
  const btnFont   = new Font({ size: 20, family: "Manrope",  color: Color.fromHex(NEON_SHIP), textAlign: TextAlign.Center });

  const isNewRecord = score >= highScore && score > 0;

  const over   = new Label({ text: "GAME OVER",                         pos: vec(W / 2, H / 2 - 110), font: titleFont });
  const scored = new Label({ text: `You survived ${score}s`,            pos: vec(W / 2, H / 2 - 50),  font: bodyFont });
  const best   = new Label({ text: `Best: ${highScore}s`,               pos: vec(W / 2, H / 2 - 10),  font: subFont });
  const record = new Label({ text: isNewRecord ? "🏆 New Record!" : "", pos: vec(W / 2, H / 2 + 30),  font: btnFont });
  const restart = new Label({ text: "Tap / SPACE to play again",        pos: vec(W / 2, H / 2 + 90),  font: subFont });

  scene.add(over);
  scene.add(scored);
  scene.add(best);
  scene.add(record);
  scene.add(restart);

  // Decorative drifting asteroids
  const deco = new Timer({
    interval: 1000,
    repeats: true,
    action: () => {
      const a = new Asteroid(
        20 + Math.random() * (W - 40),
        50 + Math.random() * 70,
        10 + Math.random() * 12,
        (Math.random() - 0.5) * 25
      );
      scene.add(a);
    },
  });
  scene.add(deco);
  deco.start();

  let pulse = 0;
  scene.onPostUpdate = (_engine: Engine, delta: number) => {
    pulse += delta / 1000;
    restart.graphics.opacity = 0.5 + 0.5 * Math.sin(pulse * 3);

    if (
      game.input.keyboard.wasPressed(Keys.Space) ||
      game.input.keyboard.wasPressed(Keys.Enter) ||
      game.input.keyboard.wasPressed(Keys.R)
    ) {
      onRestart();
    }
  };

  game.input.pointers.primary.on("down", () => {
    if (game.currentSceneName === "over") onRestart();
  });

  return scene;
}

// ─── Root React component ─────────────────────────────────────────────────────

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    // ── High score (localStorage)
    function getHighScore(): number {
      return parseInt(localStorage.getItem(STAR_DODGER_HS_KEY) ?? "0", 10) || 0;
    }
    function saveHighScore(s: number) {
      if (s > getHighScore()) localStorage.setItem(STAR_DODGER_HS_KEY, String(s));
    }

    const game = new Engine({
      canvasElement,
      width: W,
      height: H,
      displayMode: DisplayMode.FitContainer,
      backgroundColor: Color.fromHex(BG),
      antialiasing: true,
    });

    // ── Scene wiring
    function goStart() {
      // Remove old scenes to reset state
      if (game.scenes["game"]) game.removeScene("game");
      if (game.scenes["over"])  game.removeScene("over");

      const startScene = buildStartScene(game, goGame);
      game.addScene("start", startScene);
      void game.goToScene("start");
    }

    function goGame() {
      if (game.scenes["game"]) game.removeScene("game");

      const gameScene = buildGameScene(game, getHighScore, (score) => {
        saveHighScore(score);
        goOver(score);
      });
      game.addScene("game", gameScene);
      void game.goToScene("game");
    }

    function goOver(score: number) {
      if (game.scenes["over"]) game.removeScene("over");

      const overScene = buildOverScene(game, score, getHighScore(), goGame);
      game.addScene("over", overScene);
      void game.goToScene("over");
    }

    goStart();
    void game.start();

    return () => game.dispose();
  }, []);

  return (
    <Shell>
      <div className="w-full h-full min-h-[400px]">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </Shell>
  );
}
