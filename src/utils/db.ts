import supabase from './supabase';
import type { CanvasItemData, DrawPath } from '../types';
import type { GitHubCardData } from '../components/GitHubCard';
import { FileText, Github, Image as ImageIcon } from 'lucide-react';

// 检查数据库中是否存在任何卡片
export const hasAnyCards = async (): Promise<boolean> => {
  try {
    const { count, error } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error checking cards:', error);
      return false;
    }

    return (count ?? 0) > 0;
  } catch (error) {
    console.error('Error checking cards:', error);
    return false;
  }
};

// 从 markdown 内容中提取第一个 H1 作为 title
const extractH1Title = (content: string): string => {
  const h1Match = content.match(/^#\s+(.+)$/m);
  return h1Match ? h1Match[1].trim() : '';
};

// 将点数组转换为 SVG path 字符串
const pointsToPath = (points: Array<{ x: number; y: number }>): string => {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  }
  return `M ${points[0].x} ${points[0].y} ${points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`;
};

// 将 SVG path 字符串转换为点数组
const pathToPoints = (pathSvg: string): Array<{ x: number; y: number }> => {
  const points: Array<{ x: number; y: number }> = [];
  
  // 移除所有空格和换行，然后按命令分割
  const normalized = pathSvg.trim().replace(/\s+/g, ' ');
  
  // 匹配 M (MoveTo) 和 L (LineTo) 命令
  const commands = normalized.match(/[ML]\s+[\d.\-]+\s+[\d.\-]+/g);
  
  if (!commands) {
    return points;
  }
  
  for (const command of commands) {
    const parts = command.trim().split(/\s+/);
    if (parts.length >= 3) {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y });
      }
    }
  }
  
  return points;
};

// 加载所有卡片
export const loadCards = async (): Promise<CanvasItemData[]> => {
  try {
    const { data: cardsData, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error loading cards:', cardsError);
      return [];
    }

    if (!cardsData || cardsData.length === 0) {
      return [];
    }

    // 转换为 CanvasItemData 格式
    const items: CanvasItemData[] = cardsData.map(card => {
      const data = card.data || {};
      let content: string | GitHubCardData;
      let title = (data.title as string) || '';

      if (card.type === 'article') {
        // article 类型：从 data 字段获取内容
        content = (data.content as string) || '';
        title = title || extractH1Title(content);
      } else if (card.type === 'github') {
        // github 类型：从 data 字段获取
        content = (data as GitHubCardData) || {
          repo: '',
          url: '',
          language: '',
          stars: 0,
          forks: 0,
          description: ''
        };
        title = title || (content.repo ? content.repo.split('/').pop() || '' : 'GIT_REPO');
      } else if (card.type === 'image') {
        // image 类型：从 data 字段获取 URL
        content = (data.url as string) || '';
        title = title || 'IMAGE_VIEW';
      } else {
        content = '';
      }

      return {
        id: card.id,
        type: card.type as 'article' | 'image' | 'github',
        title,
        icon: card.type === 'github' ? Github : card.type === 'image' ? ImageIcon : FileText,
        x: card.position_x || 0,
        y: card.position_y || 0,
        width: card.width || 600,
        height: card.height || 400,
        content,
        visible: data.visible !== false // 默认可见，除非明确设置为 false
      };
    });

    return items;
  } catch (error) {
    console.error('Error loading cards:', error);
    return [];
  }
};

// 保存卡片
export const saveCard = async (card: CanvasItemData): Promise<void> => {
  try {
    // 准备 data jsonb 字段
    let data: Record<string, unknown> = {
      title: card.title,
      visible: card.visible !== false
    };
    
    if (card.type === 'article') {
      // article 类型：在 data 中存储内容
      data.content = card.content as string;
    } else if (card.type === 'github') {
      // github 类型：存储完整的 GitHubCardData
      data = {
        ...data,
        ...(card.content as GitHubCardData)
      };
    } else if (card.type === 'image') {
      // image 类型：存储 URL
      data.url = card.content as string;
    }

    // 保存卡片
    const { error: cardError } = await supabase
      .from('cards')
      .upsert({
        id: card.id,
        type: card.type,
        position_x: card.x,
        position_y: card.y,
        width: card.width,
        height: card.height,
        data,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (cardError) {
      console.error('Error saving card:', cardError);
      throw cardError;
    }
  } catch (error) {
    console.error('Error saving card:', error);
    throw error;
  }
};

// 删除卡片（软删除）
export const deleteCard = async (id: string): Promise<void> => {
  try {
    // 获取当前卡片数据
    const { data: cardData, error: fetchError } = await supabase
      .from('cards')
      .select('data')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching card:', fetchError);
      throw fetchError;
    }

    // 更新 data 字段，设置 visible 为 false
    const updatedData = {
      ...(cardData?.data || {}),
      visible: false
    };

    const { error } = await supabase
      .from('cards')
      .update({
        data: updatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting card:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting card:', error);
    throw error;
  }
};

// 加载所有涂鸦
export const loadDrawings = async (): Promise<DrawPath[]> => {
  try {
    const { data, error } = await supabase
      .from('drawings')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading drawings:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 转换数据格式：将 SVG 路径字符串转换为 points 数组
    const drawings: DrawPath[] = data.map(drawing => {
      const points = pathToPoints(drawing.path_svg || '');
      return {
        id: drawing.id,
        points,
        color: drawing.color || '#00ffff',
        width: drawing.stroke_width || 3
      };
    });

    return drawings;
  } catch (error) {
    console.error('Error loading drawings:', error);
    return [];
  }
};

// 保存单个涂鸦，返回数据库生成的 id
export const saveDrawing = async (drawing: DrawPath): Promise<string | null> => {
  try {
    // 将 points 数组转换为 SVG 路径字符串
    const pathSvg = pointsToPath(drawing.points);

    const { data, error } = await supabase
      .from('drawings')
      .insert({
        path_svg: pathSvg,
        color: drawing.color,
        stroke_width: drawing.width
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving drawing:', error);
      throw error;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error('Error saving drawing:', error);
    throw error;
  }
};

// 删除涂鸦
export const deleteDrawing = async (id: string | number): Promise<void> => {
  try {
    // drawings 表的 id 是 uuid (string)
    if (typeof id !== 'string') {
      // 如果不是 string，说明可能是旧的 number id，直接返回
      return;
    }

    const { error } = await supabase
      .from('drawings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting drawing:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting drawing:', error);
    throw error;
  }
};
