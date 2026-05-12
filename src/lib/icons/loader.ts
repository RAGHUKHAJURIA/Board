import type { LucideIcon } from 'lucide-react';

type IconComponent = LucideIcon;

const iconCache = new Map<string, IconComponent>();

export async function loadIconComponent(
  name: string,
  library: 'lucide' | 'tabler'
): Promise<IconComponent | null> {
  const cacheKey = `${library}:${name}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

  try {
    if (library === 'lucide') {
      const mod = await import('lucide-react');
      const component = (mod as Record<string, unknown>)[name] as IconComponent | undefined;
      if (!component) return null;
      iconCache.set(cacheKey, component);
      return component;
    }
    return null;
  } catch {
    console.error(`[IconLoader] Failed to load icon: ${name} from ${library}`);
    return null;
  }
}

// Synchronous version for already-cached icons (used in renderer)
export function getIconComponentSync(name: string, library: 'lucide' | 'tabler'): IconComponent | null {
  return iconCache.get(`${library}:${name}`) ?? null;
}

// Preload a batch of icons (call this when picker opens)
export async function preloadIconBatch(icons: Array<{ name: string; library: 'lucide' | 'tabler' }>): Promise<void> {
  await Promise.allSettled(icons.map(({ name, library }) => loadIconComponent(name, library)));
}
