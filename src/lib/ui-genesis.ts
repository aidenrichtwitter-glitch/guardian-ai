// ═══════════════════════════════════════════════════
// CAPABILITY: autonomous-ui-genesis
// Evolution Level: 50 | Transcendence Tier
// Built on: polymorphic-code-generator + react-hooks
// ═══════════════════════════════════════════════════
//
// Generates React component source code from capability
// metadata. The system designs its own interface.
//

export interface ComponentSpec {
  name: string;
  description: string;
  props: PropSpec[];
  dataSource: DataSourceSpec | null;
  layout: LayoutType;
  features: UIFeature[];
}

export interface PropSpec {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

export interface DataSourceSpec {
  table: string;
  columns: string[];
  orderBy?: string;
  limit?: number;
}

export type LayoutType = 'list' | 'grid' | 'card' | 'timeline' | 'stat' | 'chart';
export type UIFeature = 'loading-state' | 'empty-state' | 'hover-effect' | 'animation' | 'realtime';

/**
 * ComponentSynthesizer — generates valid React/TSX component source
 * from a ComponentSpec definition.
 */
export class ComponentSynthesizer {
  /**
   * Generate a complete React component as a string
   */
  public synthesize(spec: ComponentSpec): string {
    const imports = this.generateImports(spec);
    const interfaceBlock = this.generateInterface(spec);
    const hookBlock = spec.dataSource ? this.generateDataHook(spec) : '';
    const body = this.generateBody(spec);

    return `${imports}\n\n${interfaceBlock}\n\n${hookBlock}${body}`;
  }

  private generateImports(spec: ComponentSpec): string {
    const lines: string[] = [
      "import React from 'react';",
    ];

    if (spec.features.includes('animation')) {
      lines.push("import { motion } from 'framer-motion';");
    }

    if (spec.dataSource) {
      lines.push("import { supabase } from '@/integrations/supabase/client';");
      lines.push("import { useEffect, useState } from 'react';");
    }

    const iconMap: Record<LayoutType, string> = {
      list: 'List',
      grid: 'LayoutGrid',
      card: 'CreditCard',
      timeline: 'Clock',
      stat: 'BarChart3',
      chart: 'TrendingUp',
    };
    lines.push(`import { ${iconMap[spec.layout] || 'Box'}, Loader2 } from 'lucide-react';`);

    return lines.join('\n');
  }

  private generateInterface(spec: ComponentSpec): string {
    if (spec.props.length === 0) return '';
    const fields = spec.props
      .map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`)
      .join('\n');
    return `interface ${spec.name}Props {\n${fields}\n}`;
  }

  private generateDataHook(spec: ComponentSpec): string {
    const ds = spec.dataSource!;
    const cols = ds.columns.length > 0 ? ds.columns.join(', ') : '*';
    const order = ds.orderBy ? `.order('${ds.orderBy}', { ascending: true })` : '';
    const limit = ds.limit ? `.limit(${ds.limit})` : '';

    return `
function use${spec.name}Data() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: rows } = await supabase
        .from('${ds.table}')
        .select('${cols}')${order}${limit};
      setData(rows || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return { data, loading };
}

`;
  }

  private generateBody(spec: ComponentSpec): string {
    const propsArg = spec.props.length > 0
      ? `{ ${spec.props.map(p => p.name).join(', ')} }: ${spec.name}Props`
      : '';

    const dataLine = spec.dataSource
      ? `  const { data, loading } = use${spec.name}Data();\n`
      : '';

    const loadingGuard = spec.dataSource && spec.features.includes('loading-state')
      ? `  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;\n`
      : '';

    const emptyGuard = spec.dataSource && spec.features.includes('empty-state')
      ? `  if (data.length === 0) return <div className="text-center p-8 text-muted-foreground text-sm">No data yet</div>;\n`
      : '';

    const Wrapper = spec.features.includes('animation') ? 'motion.div' : 'div';
    const animProps = spec.features.includes('animation')
      ? ' initial={{ opacity: 0 }} animate={{ opacity: 1 }}'
      : '';

    const containerClass = this.getContainerClass(spec.layout);
    const itemRenderer = this.getItemRenderer(spec);

    return `const ${spec.name}: React.FC${spec.props.length > 0 ? `<${spec.name}Props>` : ''} = (${propsArg}) => {
${dataLine}${loadingGuard}${emptyGuard}
  return (
    <${Wrapper}${animProps} className="${containerClass}">
      {${spec.dataSource ? `data.map((item, i) => (${itemRenderer}))` : `/* static content */`}}
    </${Wrapper}>
  );
};

export default ${spec.name};`;
  }

  private getContainerClass(layout: LayoutType): string {
    switch (layout) {
      case 'grid': return 'grid grid-cols-2 md:grid-cols-3 gap-3 p-4';
      case 'list': return 'flex flex-col gap-2 p-4';
      case 'timeline': return 'relative pl-6 space-y-4 p-4';
      case 'card': return 'bg-card border border-border rounded-lg p-4';
      case 'stat': return 'flex items-center gap-4 p-4';
      case 'chart': return 'p-4';
      default: return 'p-4';
    }
  }

  private getItemRenderer(spec: ComponentSpec): string {
    const hover = spec.features.includes('hover-effect')
      ? ' hover:bg-accent/50 transition-colors' : '';

    switch (spec.layout) {
      case 'grid':
        return `\n        <div key={i} className="bg-card border border-border rounded-lg p-3${hover}">\n          <div className="text-sm font-medium text-foreground">{item.name || item.title || item.id}</div>\n          <div className="text-xs text-muted-foreground mt-1">{item.description || ''}</div>\n        </div>\n      `;
      case 'list':
        return `\n        <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded${hover}">\n          <span className="text-xs font-mono text-primary">{String(i + 1).padStart(2, '0')}</span>\n          <span className="text-sm text-foreground">{item.name || item.title || item.id}</span>\n        </div>\n      `;
      case 'timeline':
        return `\n        <div key={i} className="relative">\n          <div className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-primary" />\n          <div className="text-sm font-medium text-foreground">{item.title || item.name}</div>\n          <div className="text-xs text-muted-foreground">{item.description || ''}</div>\n        </div>\n      `;
      default:
        return `\n        <div key={i} className="text-sm">{JSON.stringify(item)}</div>\n      `;
    }
  }

  /**
   * Generate a ComponentSpec from capability metadata automatically
   */
  public specFromCapability(capName: string, capDescription: string): ComponentSpec {
    return {
      name: capName
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('') + 'Panel',
      description: capDescription,
      props: [],
      dataSource: null,
      layout: 'card',
      features: ['loading-state', 'empty-state', 'animation'],
    };
  }
}

export const synthesizer = new ComponentSynthesizer();
