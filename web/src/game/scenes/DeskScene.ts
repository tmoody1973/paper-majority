import Phaser from 'phaser';

import { rejectionPhrase, resultPhrase, STUDY_PHRASES } from '@/content/i18n/en';
import { resolveDropIntent } from '@/domain/dropIntent';
import { buildMatchInputs, matchPattern } from '@/domain/recipes';
import type { CardDefinition, CardInstance } from '@/domain/types';
import { resolveDropTarget, type DropTarget } from '@/game/input/dropResolver';
import { CardView, CARD_HEIGHT, CARD_WIDTH } from '@/game/objects/CardView';
import type { GameSession } from '@/game/session';

export const ZOOM_MIN = 0.65;
export const ZOOM_MAX = 1.5;

/** Approved tactile motion timings. */
const PICKUP_MS = 90;
const VALID_HOVER_MS = 100;
const SNAP_MS = 140;
const REJECT_MS = 160;
const TRANSFORM_MS = 260;

const STACK_OFFSET_Y = 34;

export interface DeskSceneData {
  session: GameSession;
  onResult: (phrase: string) => void;
}

export class DeskScene extends Phaser.Scene {
  static readonly KEY = 'Desk';

  private session!: GameSession;
  private onResult!: (phrase: string) => void;
  private views = new Map<string, CardView>();
  private dragOrigin = { x: 0, y: 0 };
  /**
   * The card the pointer is currently holding.
   *
   * The clock redraws the desk from authoritative state ten times a second. Without
   * this, that redraw fights the pointer: it resets the held card's position and its
   * depth, and the lost depth made the pan handler mistake a card drag for a desk pan.
   */
  private draggingCardId?: string;
  private lastTickAt = 0;

  constructor() {
    super({ key: DeskScene.KEY, active: false });
  }

  init(data?: Partial<DeskSceneData>): void {
    // Phaser's boot queue can start a scene with no data, so the registry is the
    // reliable source. Explicit `scene.start` data still wins when it is present.
    const context = (data?.session ? data : this.registry.get('deskData')) as DeskSceneData;
    if (!context?.session) throw new Error('DeskScene started without a GameSession');
    this.session = context.session;
    this.onResult = context.onResult;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#e9e2d3');
    this.drawDeskSurface();

    this.syncViews();
    this.frameDesk();
    this.installInput();

    this.session.subscribe((result) => {
      this.syncViews();
      this.announce(result.events);
    });

    this.lastTickAt = this.time.now;

    // Development-only camera probe so the E2E suite can assert the real zoom
    // clamp instead of guessing at it. Read-only: it cannot move the camera.
    if (process.env.NODE_ENV !== 'production') {
      (
        window as unknown as {
          __congressGameCamera?: {
            getZoom: () => number;
            getViewY: (cardId: string) => number | undefined;
            getProgress: (cardId: string) => number | undefined;
            getScreenPoint: (cardId: string) => { x: number; y: number } | undefined;
          };
        }
      ).__congressGameCamera = {
        getZoom: () => this.cameras.main.zoom,
        getViewY: (cardId: string) => this.views.get(cardId)?.y,
        getProgress: (cardId: string) => this.views.get(cardId)?.progress01,
        getScreenPoint: (cardId: string) => {
          const view = this.views.get(cardId);
          if (!view) return undefined;
          // `worldView` is the visible world rectangle, which already accounts for
          // Phaser zooming about the camera midpoint. `scrollX` alone does not.
          const camera = this.cameras.main;
          return {
            x: (view.x - camera.worldView.x) * camera.zoom,
            y: (view.y - camera.worldView.y) * camera.zoom,
          };
        },
      };
    }
  }

  update(time: number): void {
    // The engine owns the clock; the scene only reports elapsed wall time to it.
    const delta = time - this.lastTickAt;
    if (delta < 100) return;
    this.lastTickAt = time;
    if (this.session.getState().paused) return;
    this.session.dispatch({ type: 'TICK', deltaMs: Math.min(1_000, Math.round(delta)) });
  }

  private get reducedMotion(): boolean {
    return this.session.getState().settings.reducedMotion;
  }

  /**
   * Open with every card on screen.
   *
   * A card the player cannot see is a card they cannot use, and the spike has no
   * tutorial to tell them to pan. Zoom stays inside the approved 0.65–1.5 clamp.
   */
  private frameDesk(): void {
    const state = this.session.getState();
    if (state.cards.length === 0) return;

    const left = Math.min(...state.cards.map((card) => card.x)) - CARD_WIDTH / 2;
    const right = Math.max(...state.cards.map((card) => card.x)) + CARD_WIDTH / 2;
    const top = Math.min(...state.cards.map((card) => card.y)) - CARD_HEIGHT / 2;
    const bottom = Math.max(...state.cards.map((card) => card.y)) + CARD_HEIGHT / 2;

    const camera = this.cameras.main;
    const margin = 24;
    const zoom = Phaser.Math.Clamp(
      Math.min(
        (camera.width - margin * 2) / (right - left),
        (camera.height - margin * 2) / (bottom - top),
      ),
      ZOOM_MIN,
      ZOOM_MAX,
    );

    camera.setZoom(zoom);
    camera.centerOn((left + right) / 2, (top + bottom) / 2);
  }

  private drawDeskSurface(): void {
    const surface = this.add.graphics();
    surface.fillStyle(0xefe8d9, 1);
    surface.fillRect(-200, -200, 2400, 1600);
    surface.lineStyle(1, 0xd8cdb8, 1);
    for (let x = -200; x < 2200; x += 120) surface.lineBetween(x, -200, x, 1400);
    for (let y = -200; y < 1400; y += 120) surface.lineBetween(-200, y, 2200, y);
    surface.setDepth(-100);
  }

  private definitionFor(instance: CardInstance): CardDefinition {
    const definition = this.session
      .getScenario()
      .cards.find((card) => card.id === instance.definitionId);
    if (!definition) throw new Error(`No definition for ${instance.definitionId}`);
    return definition;
  }

  /** Redraw from authoritative state. The scene never invents card positions. */
  private syncViews(): void {
    const state = this.session.getState();
    const seen = new Set<string>();

    for (const stack of state.stacks) {
      stack.cardIds.forEach((cardId, indexInStack) => {
        const instance = state.cards.find((card) => card.id === cardId);
        if (!instance) return;
        seen.add(cardId);

        // Fanned stacks keep every card's top 42px — the family band, label and
        // title — readable.
        const anchor = state.cards.find((card) => card.id === stack.cardIds[0]) ?? instance;
        const placed: CardInstance = {
          ...instance,
          x: anchor.x,
          y: anchor.y + indexInStack * STACK_OFFSET_Y,
        };

        const existing = this.views.get(cardId);
        if (existing) {
          if (cardId === this.draggingCardId) {
            // Held by the pointer: refresh its state, but leave the pointer in charge
            // of where it is and what it sits on top of.
            existing.refresh(
              { ...placed, x: existing.x, y: existing.y },
              this.definitionFor(instance),
            );
          } else {
            existing.refresh(placed, this.definitionFor(instance));
            existing.setDepth(indexInStack);
          }
        } else {
          const view = new CardView(this, {
            instance: placed,
            definition: this.definitionFor(instance),
            reducedMotion: this.reducedMotion,
          });
          view.setDepth(indexInStack);
          this.views.set(cardId, view);
        }
      });
    }

    for (const [cardId, view] of this.views) {
      if (seen.has(cardId)) continue;
      this.retireView(cardId, view);
    }
  }

  private retireView(cardId: string, view: CardView): void {
    this.views.delete(cardId);
    if (this.reducedMotion) {
      view.destroy();
      return;
    }
    this.tweens.add({
      targets: view,
      alpha: 0,
      scale: 0.86,
      duration: TRANSFORM_MS,
      onComplete: () => view.destroy(),
    });
  }

  private dropTargets(excludeCardId: string): DropTarget[] {
    const state = this.session.getState();
    return state.stacks
      .filter((stack) => !stack.cardIds.includes(excludeCardId))
      .map((stack, index) => {
        const view = this.views.get(stack.cardIds[0]);
        if (!view) return undefined;
        return {
          stackId: stack.id,
          x: view.x - CARD_WIDTH / 2,
          y: view.y - CARD_HEIGHT / 2,
          width: CARD_WIDTH,
          height: CARD_HEIGHT + (stack.cardIds.length - 1) * STACK_OFFSET_Y,
          z: index,
        };
      })
      .filter((target): target is DropTarget => target !== undefined);
  }

  /** Would this drop be accepted? Used only for the valid-hover cue. */
  private wouldAccept(cardId: string, stackId: string): boolean {
    const state = this.session.getState();
    const stack = state.stacks.find((candidate) => candidate.id === stackId);
    if (!stack) return false;

    const members = [...stack.cardIds, cardId]
      .map((id) => state.cards.find((card) => card.id === id))
      .filter((card): card is CardInstance => card !== undefined);
    if (members.some((card) => card.status !== 'idle')) return false;

    // Studying a Tactic is a valid drop even though it matches no pattern.
    const intent = resolveDropIntent(state, this.session.getScenario(), cardId, stackId);
    if (intent?.type === 'START_ASSIGNMENT') return true;

    const inputs = buildMatchInputs(members, this.session.getScenario(), state.player.party);
    return Boolean(
      matchPattern(
        inputs,
        this.session.getScenario().patterns,
        Object.values(state.unlockedSlotExpansions).flat(),
        this.session.getScenario().tacticExpansions,
      ),
    );
  }

  private installInput(): void {
    // Dragging works while paused: planning is never a timed activity.
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, view: CardView) => {
      this.dragOrigin = { x: view.x, y: view.y };
      this.draggingCardId = view.cardId;
      view.setDepth(1_000);
      view.setHighlight('lifted');
      if (this.reducedMotion) return;
      // The card lifts in the SAME frame as the press. Waiting for a tween's first
      // frame pushed first visible feedback past the 100 ms budget.
      view.setY(view.y - 2);
      this.tweens.add({ targets: view, y: view.y - 4, duration: PICKUP_MS, ease: 'Quad.easeOut' });
    });

    this.input.on(
      'drag',
      (_pointer: Phaser.Input.Pointer, view: CardView, dragX: number, dragY: number) => {
        view.setPosition(dragX, dragY);

        const targetId = resolveDropTarget({ x: dragX, y: dragY }, this.dropTargets(view.cardId));
        for (const [cardId, candidate] of this.views) {
          if (cardId === view.cardId) continue;
          candidate.setHighlight('none');
        }
        if (!targetId) return;

        const stack = this.session.getState().stacks.find((s) => s.id === targetId);
        const head = stack ? this.views.get(stack.cardIds[0]) : undefined;
        head?.setHighlight(this.wouldAccept(view.cardId, targetId) ? 'valid' : 'none');
      },
    );

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, view: CardView) => {
      for (const candidate of this.views.values()) candidate.setHighlight('none');

      const targetId = resolveDropTarget({ x: view.x, y: view.y }, this.dropTargets(view.cardId));
      if (!targetId) {
        this.session.dispatch({
          type: 'MOVE_CARD',
          cardId: view.cardId,
          x: Math.round(view.x),
          y: Math.round(view.y),
        });
        view.setDepth(0);
        this.draggingCardId = undefined;
        return;
      }

      const intent = resolveDropIntent(
        this.session.getState(),
        this.session.getScenario(),
        view.cardId,
        targetId,
      );
      if (!intent) {
        this.bounceBack(view);
        return;
      }
      const result = this.session.dispatch(intent);

      const rejected = result.events.find(
        (event) => event.type === 'STACK_REJECTED' || event.type === 'COMMAND_REJECTED',
      );
      if (rejected) {
        this.bounceBack(view);
        return;
      }
      this.snap(view);
    });

    this.input.on(
      'wheel',
      (_p: unknown, _o: unknown, _dx: number, deltaY: number) => {
        const camera = this.cameras.main;
        const next = Phaser.Math.Clamp(camera.zoom - deltaY * 0.001, ZOOM_MIN, ZOOM_MAX);
        camera.setZoom(next);
      },
    );

    // Pan empty desk space.
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || this.input.activePointer.getDistance() === 0) return;
      if (this.draggingCardId) return;
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
      camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
    });
  }

  /** An invalid stack separates with a short nonverbal cue. No dialog, no cost. */
  private bounceBack(view: CardView): void {
    view.setDepth(0);
    if (this.reducedMotion) {
      view.setPosition(this.dragOrigin.x, this.dragOrigin.y);
      view.setHighlight('invalid');
      this.draggingCardId = undefined;
      this.time.delayedCall(REJECT_MS, () => view.setHighlight('none'));
      return;
    }

    view.setHighlight('invalid');
    this.tweens.add({
      targets: view,
      x: { from: view.x, to: this.dragOrigin.x },
      y: { from: view.y, to: this.dragOrigin.y },
      duration: REJECT_MS,
      ease: 'Back.easeOut',
      onComplete: () => {
        view.setHighlight('none');
        this.draggingCardId = undefined;
      },
    });
  }

  private snap(view: CardView): void {
    view.setDepth(0);
    if (this.reducedMotion) {
      this.draggingCardId = undefined;
      this.syncViews();
      return;
    }
    this.tweens.add({
      targets: view,
      scale: { from: 1.04, to: 1 },
      duration: SNAP_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.draggingCardId = undefined;
        this.syncViews();
      },
    });
  }

  /** Turn engine events into the single one-line result phrase. */
  private announce(events: { type: string; [key: string]: unknown }[]): void {
    for (const event of events) {
      if (event.type === 'CARD_TRANSFORMED') {
        this.onResult(resultPhrase(String(event.explanationKey)));
        return;
      }
      if (event.type === 'TACTIC_EXPANSION_ACTIVATED') {
        this.onResult(STUDY_PHRASES.completed);
        return;
      }
      if (event.type === 'ACTION_STARTED' && event.assignmentKind === 'study-tactic') {
        this.onResult(STUDY_PHRASES.started);
        return;
      }
      if (event.type === 'STACK_REJECTED' || event.type === 'COMMAND_REJECTED') {
        this.onResult(rejectionPhrase(String(event.reason)));
        return;
      }
    }
  }
}

export const MOTION_TIMINGS = {
  PICKUP_MS,
  VALID_HOVER_MS,
  SNAP_MS,
  REJECT_MS,
  TRANSFORM_MS,
};
