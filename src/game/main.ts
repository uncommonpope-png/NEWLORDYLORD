import Phaser from "phaser";
import { GameScene } from "./GameScene";
import { sfx } from "./audio";

export function initGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#04060f",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: "100%",
      height: "100%",
    },
    scene: [GameScene],
    audio: { disableWebAudio: false },
    render: { antialias: true, pixelArt: false },
  });
  return game;
}

export function destroyGame(game: Phaser.Game) {
  sfx.stopAll();
  game.destroy(true);
}
