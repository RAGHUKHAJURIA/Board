/**
 * Arrowhead geometry.
 *
 * Pure shape maths, kept out of the renderer so it can be tested without a
 * canvas. Every head is described in the same frame: the tip sits at (x, y)
 * and `angle` points along the direction of travel *into* the tip, so the same
 * code serves both ends of a line — the start just passes the reversed tangent.
 */

import { Point } from '@/types';

export const ARROWHEADS = [
  'none',
  'arrow',
  'triangle',
  'triangle_outline',
  'diamond',
  'diamond_outline',
  'dot',
  'circle_outline',
  'bar',
] as const;

export type Arrowhead = (typeof ARROWHEADS)[number];

/** Short human labels for the properties panel. */
export const ARROWHEAD_LABELS: Record<Arrowhead, string> = {
  none: 'None',
  arrow: 'Arrow',
  triangle: 'Triangle',
  triangle_outline: 'Triangle outline',
  diamond: 'Diamond',
  diamond_outline: 'Diamond outline',
  dot: 'Dot',
  circle_outline: 'Circle outline',
  bar: 'Bar',
};

export interface ArrowheadShape {
  /** Polygon or polyline points, tip first where that is meaningful. */
  points: Point[];
  /** Closed shapes are filled or stroked as one path; open ones are polylines. */
  closed: boolean;
  filled: boolean;
  /** Circles can't be described by points; radius is set instead. */
  circle?: { cx: number; cy: number; r: number };
  /**
   * How far back along the line the shape reaches. The line should stop this
   * far short of the tip, otherwise it pokes through an outline head.
   */
  inset: number;
}

const WING = Math.PI / 6; // 30° — the classic arrow spread

/**
 * Build the head. `size` is the length of the head along the line; it scales
 * with stroke width so a thick line doesn't get a pinhead.
 */
export function getArrowheadShape(
  type: Arrowhead,
  x: number,
  y: number,
  angle: number,
  size: number
): ArrowheadShape | null {
  if (type === 'none') return null;

  const back = (dist: number, spread = 0): Point => ({
    x: x - dist * Math.cos(angle - spread),
    y: y - dist * Math.sin(angle - spread),
  });

  switch (type) {
    case 'arrow':
      // Two barbs, drawn as an open polyline — the classic "V".
      return {
        points: [back(size, WING), { x, y }, back(size, -WING)],
        closed: false,
        filled: false,
        inset: 0,
      };

    case 'triangle':
    case 'triangle_outline': {
      const shape: ArrowheadShape = {
        points: [{ x, y }, back(size, WING), back(size, -WING)],
        closed: true,
        filled: type === 'triangle',
        // A filled head hides the line under it; an outline one would show the
        // line running through its middle, so the line must stop at its base.
        inset: type === 'triangle' ? 0 : size * Math.cos(WING),
      };
      return shape;
    }

    case 'diamond':
    case 'diamond_outline': {
      const half = size / 2;
      // Tip, two side points at the midpoint, and the tail.
      const mid = back(half);
      const perp = angle + Math.PI / 2;
      const side = (sign: number): Point => ({
        x: mid.x + sign * half * 0.6 * Math.cos(perp),
        y: mid.y + sign * half * 0.6 * Math.sin(perp),
      });
      return {
        points: [{ x, y }, side(1), back(size), side(-1)],
        closed: true,
        filled: type === 'diamond',
        inset: type === 'diamond' ? 0 : size,
      };
    }

    case 'dot':
    case 'circle_outline': {
      const r = size / 2.5;
      const c = back(r);
      return {
        points: [],
        closed: true,
        filled: type === 'dot',
        circle: { cx: c.x, cy: c.y, r },
        inset: type === 'dot' ? 0 : r * 2,
      };
    }

    case 'bar': {
      // A crossbar perpendicular to the line, centred on the tip.
      const perp = angle + Math.PI / 2;
      const half = size * 0.5;
      return {
        points: [
          { x: x + half * Math.cos(perp), y: y + half * Math.sin(perp) },
          { x: x - half * Math.cos(perp), y: y - half * Math.sin(perp) },
        ],
        closed: false,
        filled: false,
        inset: 0,
      };
    }

    default:
      return null;
  }
}

/** Head length for a given stroke width, matching the old fixed look at 2px. */
export const arrowheadSize = (strokeWidth: number) =>
  Math.max(12, 6 + strokeWidth * 4);
