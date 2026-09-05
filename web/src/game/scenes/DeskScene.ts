import Phaser from 'phaser';

import { rejectionPhrase, resultPhrase, STUDY_PHRASES } from '@/content/i18n/en';
import { describeCard } from '@/domain/cardDetail';
import {
  BILL_DOCKET_TARGET_ID,
  resolveDropIntent,
  wouldDropBeAccepted,
} from '@/domain/dropIntent';
import { remainingWorkMs } from '@/domain/work';
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
const DOCKET_X = 1_080;
const DOCKET_Y = 315;
const DOCKET_WIDTH = 250;
const DOCKET_HEIGHT = 300;

export interface DeskSceneData {
  session: GameSession;
  onResult: (phrase: string) => void;
  onSelect: (cardId: string) => void;
  onHover: (cardId: string | undefined) => void;
}

export class DeskScene extends Phaser.Scene {
  static readonly KEY = 'Desk';

  private session!: GameSession;
  private onResult!: (phrase: string) => void;
  private onSelect!: (cardId: string) => void;
  private onHover!: (cardId: string | undefined) => void;
  private views = new Map<string, CardView>();
  private docketBackground?: Phaser.GameObjects.Rectangle;
  private docketRevision?: Phaser.GameObjects.Text;
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
    this.onSelect = context.onSelect ?? (() => undefined);
    this.onHover = context.onHover ?? (() => undefined);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#e9e2d3');
    this.drawDeskSurface();
    if (this.session.getState().mode !== 'interaction-spike') this.drawBillDocket();

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
            getDocketScreenPoint: () => { x: number; y: number } | undefined;
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
        getDocketScreenPoint: () => {
          if (!this.docketBackground) return undefined;
          const camera = this.cameras.main;
          return {
            x: (DOCKET_X - camera.worldView.x) * camera.zoom,
            y: (DOCKET_Y - camera.worldView.y) * camera.zoom,
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
    const cards = state.cards.filter((card) => card.location === 'desk');
    if (cards.length === 0) return;

    const left = Math.min(...cards.map((card) => card.x), ...(this.docketBackground ? [DOCKET_X] : [])) - CARD_WIDTH / 2;
    const right = Math.max(...cards.map((card) => card.x), ...(this.docketBackground ? [DOCKET_X + DOCKET_WIDTH / 2] : [])) + CARD_WIDTH / 2;
    const top = Math.min(...cards.map((card) => card.y), ...(this.docketBackground ? [DOCKET_Y] : [])) - CARD_HEIGHT / 2;
    const bottom = Math.max(...cards.map((card) => card.y), ...(this.docketBackground ? [DOCKET_Y + DOCKET_HEIGHT / 2] : [])) + CARD_HEIGHT / 2;

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

  private drawBillDocket(): void {
    this.docketBackground = this.add.rectangle(
      DOCKET_X,
      DOCKET_Y,
      DOCKET_WIDTH,
      DOCKET_HEIGHT,
      0xfff8e8,
      0.96,
    );
    this.docketBackground.setStrokeStyle(4, 0xb6503a, 1).setDepth(-10);
    this.add.text(DOCKET_X - DOCKET_WIDTH / 2 + 18, DOCKET_Y - DOCKET_HEIGHT / 2 + 18, 'BILL DOCKET', {
      color: '#203b49',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
    }).setDepth(-9);
    this.add.text(
      DOCKET_X - DOCKET_WIDTH / 2 + 18,
      DOCKET_Y - 45,
      'Drop finished\ndrafted language here',
      { color: '#4a5c68', fontFamily: 'system-ui, sans-serif', fontSize: '16px', lineSpacing: 6 },
    ).setDepth(-9);
    this.docketRevision = this.add.text(
      DOCKET_X - DOCKET_WIDTH / 2 + 18,
      DOCKET_Y + DOCKET_HEIGHT / 2 - 48,
      'Revision 0 · 0 provisions',
      { color: '#b6503a', fontFamily: 'system-ui, sans-serif', fontSize: '15px', fontStyle: 'bold' },
    ).setDepth(-9);
  }

  private setDocketHighlight(valid: boolean): void {
    this.docketBackground?.setStrokeStyle(valid ? 7 : 4, valid ? 0x2878a8 : 0xb6503a, 1);
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
    this.docketRevision?.setText(
      `Revision ${state.bill.revision} · ${state.bill.provisionIds.length} provision${state.bill.provisionIds.length === 1 ? '' : 's'}`,
    );

    for (const stack of state.stacks) {
      stack.cardIds.forEach((cardId, indexInStack) => {
        const instance = state.cards.find((card) => card.id === cardId);
        if (!instance || instance.location !== 'desk') return;
        seen.add(cardId);

        // Fanned stacks keep every card's top 42px — the family band, label and
        // title — readable.
        const anchor = state.cards.find((card) => card.id === stack.cardIds[0]) ?? instance;
        const placed: CardInstance = {
          ...instance,
          remainingMs: state.mode === 'interaction-spike'
            ? instance.remainingMs
            : remainingWorkMs(state, instance.id),
          x: anchor.x,
          y: anchor.y + indexInStack * STACK_OFFSET_Y,
        };

        // What using this card costs and where it came from, both read on every
        // redraw. Cost appears the moment a rule is discovered; origin exists only
        // on cards produced in play.
        const detail = describeCard(state, this.session.getScenario(), cardId);
        const costLine = detail?.costs[0]?.short;
        const originLine = detail?.origin?.short;

        const existing = this.views.get(cardId);
        if (existing) {
          if (cardId === this.draggingCardId) {
            // Held by the pointer: refresh its state, but leave the pointer in charge
            // of where it is and what it sits on top of.
            existing.refresh(
              { ...placed, x: existing.x, y: existing.y },
              this.definitionFor(instance),
              costLine,
              originLine,
            );
          } else {
            existing.refresh(placed, this.definitionFor(instance), costLine, originLine);
            existing.setDepth(indexInStack);
          }
        } else {
          const view = new CardView(this, {
            instance: placed,
            definition: this.definitionFor(instance),
            reducedMotion: this.reducedMotion,
          });
          view.refresh(placed, this.definitionFor(instance), costLine, originLine);
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
    const stackTargets = state.stacks
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
    if (state.mode !== 'interaction-spike') {
      stackTargets.push({
        stackId: BILL_DOCKET_TARGET_ID,
        x: DOCKET_X - DOCKET_WIDTH / 2,
        y: DOCKET_Y - DOCKET_HEIGHT / 2,
        width: DOCKET_WIDTH,
        height: DOCKET_HEIGHT,
        z: 10_000,
      });
    }
    return stackTargets;
  }

  /**
   * Would this drop be accepted? Used only for the valid-hover cue.
   *
   * The rule lives in the domain layer, because a cue that disagrees with the
   * engine is worse than no cue: it used to glow for a stack the office could not
   * afford, and for a staffer not allowed to study the Tactic.
   */
  private wouldAccept(cardId: string, stackId: string): boolean {
    return wouldDropBeAccepted(this.session.getState(), this.session.getScenario(), cardId, stackId);
  }

  private installInput(): void {
    // Phaser defaults both drag thresholds to zero, which starts a drag on the
    // initial press. Requiring real movement keeps a stationary tap available for
    // inspection/staging and lets the existing distance guard distinguish the two.
    if (this.session.getState().mode !== 'interaction-spike') {
      this.input.dragDistanceThreshold = 8;
    }
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
        this.setDocketHighlight(false);
        if (!targetId) return;

        if (targetId === BILL_DOCKET_TARGET_ID) {
          this.setDocketHighlight(this.wouldAccept(view.cardId, targetId));
          return;
        }

        const stack = this.session.getState().stacks.find((s) => s.id === targetId);
        const head = stack ? this.views.get(stack.cardIds[0]) : undefined;
        head?.setHighlight(this.wouldAccept(view.cardId, targetId) ? 'valid' : 'none');
      },
    );

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, view: CardView) => {
      for (const candidate of this.views.values()) candidate.setHighlight('none');
      this.setDocketHighlight(false);

      const targetId = resolveDropTarget({ x: view.x, y: view.y }, this.dropTargets(view.cardId));
      if (!targetId) {
        const state = this.session.getState();
        const card = state.cards.find((candidate) => candidate.id === view.cardId);
        const stack = state.stacks.find((candidate) => candidate.id === card?.stackId);
        const x = Math.round(view.x);
        const y = Math.round(view.y);

        // Dropping a card that is part of a pile onto open desk takes it OUT of the
        // pile — the gesture decision 002 promises. MOVE_CARD only changes
        // coordinates, and a stacked card is drawn from its stack's anchor, so the
        // card sprang straight back and the player saw nothing happen.
        this.session.dispatch(
          stack && stack.cardIds.length > 1
            ? { type: 'SEPARATE_STACK', stackId: stack.id, cardId: view.cardId, x, y }
            : { type: 'MOVE_CARD', cardId: view.cardId, x, y },
        );
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
      if (targetId === BILL_DOCKET_TARGET_ID) {
        this.draggingCardId = undefined;
        this.syncViews();
        return;
      }
      this.snap(view);
    });

    // The approved design opens the inspector on "hover, focus, long press or an
    // explicit Inspect command". Hover matters most: it lets a player learn every
    // card by sweeping the mouse, instead of clicking thirteen times.
    this.input.on('gameobjectover', (_pointer: Phaser.Input.Pointer, gameObject: unknown) => {
      const view = gameObject as CardView;
      if (!view?.cardId || this.draggingCardId) return;
      this.onHover(view.cardId);
    });

    this.input.on('gameobjectout', (_pointer: Phaser.Input.Pointer, gameObject: unknown) => {
      const view = gameObject as CardView;
      if (!view?.cardId) return;
      this.onHover(undefined);
    });

    // A press that never turned into a drag is a tap: open the inspector.
    this.input.on('gameobjectup', (pointer: Phaser.Input.Pointer, gameObject: unknown) => {
      const view = gameObject as CardView;
      if (!view?.cardId) return;
      if (pointer.getDistance() > 8) return;
      this.onSelect(view.cardId);
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

  private titleOf(cardId: string): string {
    const instance = this.session.getState().cards.find((card) => card.id === cardId);
    if (!instance) return cardId;
    return this.definitionFor(instance).title;
  }

  /**
   * Mark the cards that came back from an assignment.
   *
   * The result phrase says a staffer is free again; this is where a player sees
   * which one. Reduced motion still gets the cue — it simply holds rather than
   * fading, because the state change has to be readable either way.
   */
  private flagReturned(cardIds: string[]): void {
    for (const cardId of cardIds) {
      const view = this.views.get(cardId);
      if (!view) continue;
      view.setHighlight('valid');

      if (this.reducedMotion) {
        this.time.delayedCall(TRANSFORM_MS * 4, () => view.setHighlight('none'));
        continue;
      }
      this.tweens.add({
        targets: view,
        y: view.y - 6,
        duration: VALID_HOVER_MS,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => view.setHighlight('none'),
      });
    }
  }

  /** Turn engine events into the single one-line result phrase. */
  private announce(events: { type: string; [key: string]: unknown }[]): void {
    for (const event of events) {
      if (event.type === 'CARD_TRANSFORMED') {
        const returned = Array.isArray(event.returnedCardIds)
          ? (event.returnedCardIds as string[])
          : [];
        this.onResult(
          resultPhrase(String(event.explanationKey), returned.map((id) => this.titleOf(id))),
        );
        this.flagReturned(returned);
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
        this.onResult(
          rejectionPhrase(
            String(event.reason),
            typeof event.message === 'string' ? event.message : undefined,
          ),
        );
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
