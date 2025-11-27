/**
 * 轨迹滤波工具
 * 用于平滑轨迹并减少点的数量，同时保持曲率自适应
 */

type Point = { x: number; y: number };

/**
 * 计算两点之间的距离
 */
const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
};

/**
 * 计算点到线段的距离
 */
const pointToLineDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return distance(point, lineStart);
  
  const param = Math.max(0, Math.min(1, dot / lenSq));
  const xx = lineStart.x + param * C;
  const yy = lineStart.y + param * D;
  
  return distance(point, { x: xx, y: yy });
};

/**
 * 计算曲率（通过计算相邻线段的角度变化）
 */
const calculateCurvature = (p1: Point, p2: Point, p3: Point): number => {
  const v1x = p2.x - p1.x;
  const v1y = p2.y - p1.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;
  
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
  
  if (len1 === 0 || len2 === 0) return 0;
  
  // 归一化向量
  const n1x = v1x / len1;
  const n1y = v1y / len1;
  const n2x = v2x / len2;
  const n2y = v2y / len2;
  
  // 计算角度差（使用点积）
  const dot = n1x * n2x + n1y * n2y;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  
  // 曲率越大，角度变化越大
  return angle;
};

/**
 * 移动平均滤波，减少抖动
 */
const smoothPath = (points: Point[], windowSize: number = 3): Point[] => {
  if (points.length <= 2) return points;
  
  const smoothed: Point[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < points.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    // 计算窗口内的平均值
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(points.length - 1, i + halfWindow); j++) {
      sumX += points[j].x;
      sumY += points[j].y;
      count++;
    }
    
    smoothed.push({
      x: sumX / count,
      y: sumY / count
    });
  }
  
  return smoothed;
};

/**
 * 自适应 Douglas-Peucker 简化算法
 * 根据曲率调整简化阈值：曲率大的地方保留更多点，曲率小的地方简化更多
 */
const adaptiveSimplify = (points: Point[], baseTolerance: number = 2.0): Point[] => {
  if (points.length <= 2) return points;
  
  // 计算每个点的曲率
  const curvatures: number[] = new Array(points.length).fill(0);
  for (let i = 1; i < points.length - 1; i++) {
    curvatures[i] = calculateCurvature(points[i - 1], points[i], points[i + 1]);
  }
  
  // 归一化曲率到 [0, 1] 范围
  const maxCurvature = Math.max(...curvatures);
  const normalizedCurvatures = maxCurvature > 0 
    ? curvatures.map(c => c / maxCurvature)
    : curvatures;
  
  // 递归简化函数
  const simplifyRecursive = (start: number, end: number): number[] => {
    if (end - start <= 1) {
      return [start, end];
    }
    
    let maxDist = 0;
    let maxIndex = start;
    
    // 找到距离起点和终点连线最远的点
    for (let i = start + 1; i < end; i++) {
      const dist = pointToLineDistance(points[i], points[start], points[end]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    
    // 根据最远点的曲率调整阈值：曲率大的地方使用更小的阈值（保留更多点）
    const curvatureFactor = 1 - normalizedCurvatures[maxIndex] * 0.7; // 曲率越大，factor越小，阈值越小
    const adaptiveTolerance = baseTolerance * curvatureFactor;
    
    // 如果最大距离超过自适应阈值，或者曲率很大，需要保留这个点
    if (maxDist > adaptiveTolerance || normalizedCurvatures[maxIndex] > 0.3) {
      // 递归处理左右两段
      const left = simplifyRecursive(start, maxIndex);
      const right = simplifyRecursive(maxIndex, end);
      return [...left.slice(0, -1), ...right];
    } else {
      // 可以简化，只保留起点和终点
      return [start, end];
    }
  };
  
  const indices = simplifyRecursive(0, points.length - 1);
  // 去重并排序
  const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
  
  return uniqueIndices.map(i => points[i]);
};

/**
 * 主滤波函数：先平滑，再自适应简化
 */
export const filterPath = (points: Point[]): Point[] => {
  if (points.length <= 2) return points;
  
  // 第一步：移动平均滤波，减少抖动
  const smoothed = smoothPath(points, 3);
  
  // 第二步：自适应简化，根据曲率保留关键点
  const simplified = adaptiveSimplify(smoothed, 2.0);
  
  // 确保至少保留起点和终点
  if (simplified.length < 2) {
    return [points[0], points[points.length - 1]];
  }
  
  return simplified;
};

