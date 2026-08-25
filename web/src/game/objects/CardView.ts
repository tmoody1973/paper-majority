import Phaser from 'phaser';

import type { CardDefinition, CardInstance, CardKind, SourceClass } from '@/domain/types';

/**
 * The resting card face.
 *
 * 180 × 252 at 100% zoom, per the approved anatomy: an 8px family band with an icon
 * and a text label, an independent information-class badge, an illustration window,
 * a two-line title limit and one short contextual subtitle. Every label is drawn by
 * Phaser — nothing semantic is baked into artwork.
 */

export const CARD_WIDTH = 180;
export const CARD_HEIGHT = 252;
export const CARD_HEADER_HEIGHT = 42;

export const FAMILY_TOKENS: Record<CardKind, { color: number; label: string; glyph: string }> = {
  staff: { color: 0x6a5485, label: 'Staff', glyph: '👤' },
  policy: { color: 0xb6503a, label: 'Policy', glyph: '📄' },
  evidence: { color: 0x267783, label: 'Evidence', glyph: '📊' },
  coalition: { color: 0x9a6816, label: 'Coalition', glyph: '🤝' },
  constituency: { color: 0x3d754e, label: 'Constituency', glyph: '👥' },
  institution: { color: 0x254f78, label: 'Institution', glyph: '🏛' },
  political: { color: 0x844263, label: 'Political', glyph: '📣' },
  tactic: { color: 0x58636b, label: 'Tactic', glyph: '🧩' },
};

export const SOURCE_TOKENS: Record<
  SourceClass,
  { color: number; label: string; glyph: string; shape: 'rounded-square' | 'diamond' | 'hexagon' }
> = {
  official: { color: 0x2878a8, label: 'Official record', glyph: '✓', shape: 'rounded-square' },
  derived: { color: 0x267783, label: 'Derived context', glyph: '∑', shape: 'diamond' },
  simulated: { color: 0x9a6816, label: 'Simulated', glyph: '✦', shape: 'hexagon' },
};

const INK = 0x203b49;
const PAPER = 0xfbf4df;

export interface CardViewOptions {
  instance: CardInstance;
  definition: CardDefinition;
  reducedMotion: boolean;
}

export class CardView extends Phaser.GameObjects.Container {
  readonly cardId: string;
  readonly definitionId: string;

  private readonly paper: Phaser.GameObjects.Graphics;
  private readonly outline: Phaser.GameObjects.Graphics;
  private readonly deadline: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Graphics;
  private definition: CardDefinition;
  private instance: CardInstance;

  constructor(scene: Phaser.Scene, options: CardViewOptions) {
    super(scene, options.instance.x, options.instance.y);

    this.cardId = options.instance.id;
    this.definitionId = options.instance.definitionId;
    this.definition = options.definition;
    this.instance = options.instance;

    const family = FAMILY_TOKENS[options.definition.kind];
    const source = SOURCE_TOKENS[options.definition.sourceClass];

    this.paper = scene.add.graphics();
    this.drawBody(family.color);
    this.add(this.paper);

    // Family band: colour, icon and text label. Colour never works alone.
    this.add(
      scene.add
        .text(-CARD_WIDTH / 2 + 12, -CARD_HEIGHT / 2 + 14, `${family.glyph} ${family.label}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: '#203b49',
        })
        .setOrigin(0, 0),
    );

    // Information class: colour, shape hint, icon and label — also independent.
    this.add(
      scene.add
        .text(
          CARD_WIDTH / 2 - 12,
          -CARD_HEIGHT / 2 + 14,
          `${source.glyph} ${source.label}`,
          {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '10px',
            color: `#${source.color.toString(16).padStart(6, '0')}`,
          },
        )
        .setOrigin(1, 0),
    );

    this.add(
      scene.add
        .text(0, -18, options.definition.title, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '17px',
          color: '#203b49',
          align: 'center',
          wordWrap: { width: CARD_WIDTH - 28 },
          maxLines: 2,
        })
        .setOrigin(0.5, 0.5),
    );

    if (options.definition.contextualSubtitle) {
      this.add(
        scene.add
          .text(0, 24, options.definition.contextualSubtitle, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '12px',
            color: '#4a5c68',
          })
          .setOrigin(0.5, 0.5),
      );
    }

    if (options.definition.workload > 0) {
      this.add(
        scene.add
          .text(-CARD_WIDTH / 2 + 12, CARD_HEIGHT / 2 - 26, `${options.definition.workload} attention`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '11px',
            color: '#4a5c68',
          })
          .setOrigin(0, 0),
      );
    }

    // A restrained deadline stamp. This is the visible cause a player can point at
    // before any meter moves.
    this.deadline = scene.add
      .text(CARD_WIDTH / 2 - 12, CARD_HEIGHT / 2 - 26, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#b6503a',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);
    this.add(this.deadline);

    this.progress = scene.add.graphics();
    this.add(this.progress);

    this.outline = scene.add.graphics();
    this.add(this.outline);

    this.setSize(CARD_WIDTH, CARD_HEIGHT);
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    scene.input.setDraggable(this);
    scene.add.existing(this);

    this.refresh(options.instance, options.definition);
  }

  private drawBody(familyColor: number): void {
    this.paper.clear();
    this.paper.fillStyle(PAPER, 1);
    this.paper.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 12);
    this.paper.lineStyle(2, INK, 1);
    this.paper.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 12);
    this.paper.fillStyle(familyColor, 1);
    this.paper.fillRect(-CARD_WIDTH / 2 + 2, -CARD_HEIGHT / 2 + 2, CARD_WIDTH - 4, 8);
    // Illustration window. Placeholder for the spike; real art arrives at the pilot.
    this.paper.lineStyle(1, 0xc9bea9, 1);
    this.paper.strokeRect(-79, -CARD_HEIGHT / 2 + CARD_HEADER_HEIGHT + 4, 158, 112);
  }

  refresh(instance: CardInstance, definition: CardDefinition): void {
    this.instance = instance;
    this.definition = definition;
    this.setPosition(instance.x, instance.y);

    const remainingSeconds = Math.ceil(instance.remainingMs / 1000);
    if (instance.status === 'expired') {
      this.deadline.setText('Missed');
      this.setAlpha(0.55);
    } else if (instance.status !== 'working' && instance.remainingMs > 0) {
      this.deadline.setText(`Due in ${remainingSeconds}s`);
      this.setAlpha(1);
    } else {
      this.deadline.setText('');
      this.setAlpha(1);
    }

    this.progress.clear();
    if (instance.status === 'working') {
      // The universal progress strip: an assignment is visibly attached to its cards.
      this.progress.fillStyle(0x3d754e, 1);
      this.progress.fillRect(-CARD_WIDTH / 2 + 2, CARD_HEIGHT / 2 - 10, CARD_WIDTH - 4, 6);
    }
  }

  setHighlight(kind: 'none' | 'valid' | 'invalid' | 'lifted'): void {
    this.outline.clear();
    if (kind === 'none') return;

    const color = kind === 'valid' ? 0x3d754e : kind === 'invalid' ? 0xb6503a : 0x254f78;
    this.outline.lineStyle(4, color, 1);
    this.outline.strokeRoundedRect(
      -CARD_WIDTH / 2 - 3,
      -CARD_HEIGHT / 2 - 3,
      CARD_WIDTH + 6,
      CARD_HEIGHT + 6,
      14,
    );
  }

  get status(): CardInstance['status'] {
    return this.instance.status;
  }

  get kind(): CardKind {
    return this.definition.kind;
  }
}
