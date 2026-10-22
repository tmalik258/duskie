"use client";

// Part of ui: Row, toRow.

import type { SelectOption } from "./switch";

export interface Row {
  value: string;
  label: string;
  sub?: string;
  title?: string;
  icon?: string;
  image?: string;
  color?: string;
  sepBefore?: boolean;
  alwaysVisible?: boolean;
}

export const toRow = (o: SelectOption): Row => (Array.isArray(o) ? { value: o[0], label: o[1] } : o);
