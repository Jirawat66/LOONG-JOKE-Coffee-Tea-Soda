import type * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = brick with sticker shadow (one per screen); secondary = butter pill; quiet = text only */
  variant?: 'primary' | 'secondary' | 'quiet';
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Renders aria-pressed; the caller keeps which chip in a group is selected. */
  selected?: boolean;
}
export declare function Chip(props: ChipProps): React.ReactElement;

export interface StepperProps {
  value: number;
  /** Default 1 */
  min?: number;
  /** Default 20 */
  max?: number;
  onChange: (next: number) => void;
  /** Accessible name of the group. Default "จำนวน" */
  label?: string;
}
export declare function Stepper(props: StepperProps): React.ReactElement;

export interface MenuCardProps {
  /** Main name, e.g. "Caramel Latte" */
  name: string;
  /** Thai name, shown as a second line when it differs from name */
  nameTh?: string;
  /** Price in baht */
  price: number;
  /** Photo URL; empty shows an apricot placeholder with the name's first letter */
  image?: string;
  /** false shows a "หมด" badge and ignores clicks. Default true */
  available?: boolean;
  onSelect?: () => void;
  className?: string;
}
export declare function MenuCard(props: MenuCardProps): React.ReactElement;

export interface StatusBadgeProps {
  status?: 'new' | 'making' | 'done' | 'out';
  /** Overrides the default Thai label */
  children?: React.ReactNode;
}
export declare function StatusBadge(props: StatusBadgeProps): React.ReactElement;

declare global {
  interface Window {
    LoongJoke: {
      Button: typeof Button;
      Chip: typeof Chip;
      Stepper: typeof Stepper;
      MenuCard: typeof MenuCard;
      StatusBadge: typeof StatusBadge;
    };
  }
}
