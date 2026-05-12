export interface IconMeta {
  name: string;          // PascalCase component name: 'Home', 'ArrowRight'
  slug: string;          // kebab-case for search: 'home', 'arrow-right'
  library: 'lucide' | 'tabler';
  tags: string[];        // search keywords
  category: string;      // e.g. 'Arrows', 'UI', 'Files', 'Communication'
}
