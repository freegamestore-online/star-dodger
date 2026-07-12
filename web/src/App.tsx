import { useEffect, useRef } from "react";
import {
  Actor,
  CollisionType,
  Color,
  DisplayMode,
  Engine,
  Font,
  Keys,
  Label,
  Rectangle,
  TextAlign,
  Timer,
  vec,
} from "excalibur";
import { Shell } from "./components/Shell";

// A complete, playable reference game on Excalibur.js. It demonstrates every
// pattern you need: an Actor subclass with a graphic, keyboard + pointer input,
// a spawn Timer, collision handling (evt.other.owner + instanceof), a Label HUD,
// and game-over + restart. Replace the game rules; keep the patterns.

const WIDTH = 400;
const HEIGHT = 600;

// A falling hazard. Actors carry pos/vel/rotation/collision as typed properties.
class Rock extends Actor {
  constructor(x: number) {
    super({ x, y: -20, width: 28, height: 28, color: Color.fromHex("#f87171") });
    this.body.collisionType = CollisionType.Passive;
    this.vel = vec(0, 160 + Math.random() * 120);
    this.angularVelocity = 2;
  }
}

// The player ship. Steered by pointer (follows x) and arrow keys.
class Ship extends Actor {
  constructor() {
    super({ x: WIDTH / 2, y: HEIGHT - 60, width: 40, height: 40, color: Color.fromHex("#34d399") });
    this.body.collisionType = CollisionType.Active;
    this.graphics.use(new Rectangle({ width: 40, height: 40, color: Color.fromHex("#34d399") }));
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const game = new Engine({
      canvasElement,
      width: WIDTH,
      height: HEIGHT,
      displayMode: DisplayMode.FitContainer,
      backgroundColor: Color.fromHex("#0f172a"),
      antialiasing: true,
    });

    let score = 0;
    let over = false;

    const ship = new Ship();
    game.add(ship);

    const font = new Font({ size: 22, family: "Manrope", color: Color.White, textAlign: TextAlign.Left });
    const scoreLabel = new Label({ text: "Score: 0", pos: vec(12, 12), font });
    game.add(scoreLabel);

    const bigFont = new Font({ size: 34, family: "Manrope", color: Color.White, textAlign: TextAlign.Center });
    const overLabel = new Label({ text: "", pos: vec(WIDTH / 2, HEIGHT / 2), font: bigFont });
    game.add(overLabel);

    // Pointer: ship follows the horizontal position of touch / mouse.
    game.input.pointers.primary.on("move", (evt) => {
      if (!over) ship.pos.x = Math.max(20, Math.min(WIDTH - 20, evt.worldPos.x));
    });

    // Collision: evt.other is a Collider — reach the actor via .owner, narrow with instanceof.
    ship.on("collisionstart", (evt) => {
      if (over) return;
      if (evt.other.owner instanceof Rock) {
        over = true;
        overLabel.text = "Game Over — press Space";
      }
    });

    const spawn = new Timer({
      interval: 700,
      repeats: true,
      action: () => {
        if (!over) game.add(new Rock(20 + Math.random() * (WIDTH - 40)));
      },
    });
    game.currentScene.add(spawn);
    spawn.start();

    game.onPostUpdate = (_engine, elapsed) => {
      if (over) {
        if (game.input.keyboard.wasPressed(Keys.Space)) {
          score = 0;
          over = false;
          overLabel.text = "";
          for (const actor of game.currentScene.actors) {
            if (actor instanceof Rock) actor.kill();
          }
        }
        return;
      }
      // Keyboard steering (arrow keys), in addition to the pointer.
      const dx = (game.input.keyboard.isHeld(Keys.Right) ? 1 : 0) - (game.input.keyboard.isHeld(Keys.Left) ? 1 : 0);
      ship.pos.x = Math.max(20, Math.min(WIDTH - 20, ship.pos.x + dx * 6));
      score += elapsed / 1000;
      scoreLabel.text = `Score: ${Math.floor(score)}`;
      // Cull rocks that fell off-screen.
      for (const actor of game.currentScene.actors) {
        if (actor instanceof Rock && actor.pos.y > HEIGHT + 40) actor.kill();
      }
    };

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
