import { ICON_REGISTRY } from './registry';
import type { IconMeta } from './types';

export function searchIcons(query: string, category: string = 'All', limit = 120): IconMeta[] {
  const q = query.toLowerCase().trim();

  const pool = category === 'All'
    ? ICON_REGISTRY
    : ICON_REGISTRY.filter(icon => icon.category === category);

  if (!q) return pool.slice(0, limit);

  return pool
    .filter(icon =>
      icon.slug.includes(q) ||
      icon.name.toLowerCase().includes(q) ||
      icon.tags.some(tag => tag.includes(q)) ||
      icon.category.toLowerCase().includes(q)
    )
    .slice(0, limit);
}
