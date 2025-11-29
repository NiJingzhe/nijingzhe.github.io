# 在线人数统计和访问量统计功能实现计划

## 功能概述

1. **在线人数统计**: 实时显示当前在线用户数量
2. **访问量统计**: 显示总访问量和今日访问量
3. **用户识别**: 通过 localStorage 存储 UUID 来区分用户
4. **setuname 命令**: 允许用户设置自定义名称

## 实现步骤

### 阶段 1: 用户识别和初始化

#### 1.1 创建用户管理工具 (`src/utils/user.ts`)

**功能**:
- 从 localStorage 获取或生成 UUID
- 初始化访问者记录
- 创建会话并开始心跳
- 记录访问

**主要函数**:
```typescript
// 获取或创建用户 UUID
getOrCreateUserId(): string

// 初始化用户（创建访问者、会话、记录访问）
initializeUser(): Promise<{ uid: string; sessionId: string }>

// 更新会话心跳
updateSessionHeartbeat(sessionId: string): Promise<void>
```

#### 1.2 在 App.tsx 中初始化用户

**位置**: `src/App.tsx` 的 `useEffect`

**步骤**:
1. 应用启动时调用 `initializeUser()`
2. 启动心跳定时器（每 30 秒更新一次）
3. 页面卸载时清理会话

### 阶段 2: Realtime 订阅和在线人数统计

#### 2.1 创建 Realtime 管理工具 (`src/utils/realtime.ts`)

**功能**:
- 订阅 sessions 表变化
- 实时更新在线人数
- 处理订阅生命周期

**主要函数**:
```typescript
// 订阅在线人数变化
subscribeOnlineCount(
  callback: (count: number) => void
): () => void

// 获取当前在线人数
getCurrentOnlineCount(): Promise<number>
```

#### 2.2 在 App.tsx 中集成 Realtime

**步骤**:
1. 使用 `subscribeOnlineCount` 订阅在线人数变化
2. 更新状态显示在线人数
3. 组件卸载时取消订阅

### 阶段 3: 访问量统计

#### 3.1 在 App.tsx 中加载访问量

**步骤**:
1. 应用启动时调用 `getTotalVisits()` 和 `getTodayVisits()`
2. 定期刷新访问量（可选，每 5 分钟）
3. 在 StatusBar 中显示访问量

### 阶段 4: setuname 命令实现

#### 4.1 扩展命令处理 (`src/App.tsx`)

**在 `executeCommand` 函数中添加**:
```typescript
// 处理 setuname 命令
if (trimmed.startsWith('setuname')) {
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2) {
    const uname = parts[1];
    await handleSetUname(uname);
  } else {
    // 显示错误提示
  }
}
```

#### 4.2 实现 setuname 处理函数

**功能**:
1. 验证 uname 格式（长度、字符限制等）
2. 调用 `updateVisitorName(uid, uname)`
3. 显示成功/失败提示

### 阶段 5: UI 更新

#### 5.1 更新 StatusBar 组件

**添加显示项**:
- 在线人数: `ONLINE: 3`
- 总访问量: `VISITS: 1234`
- 今日访问量: `TODAY: 56`

**位置**: StatusBar 的右侧状态信息区域

#### 5.2 添加用户信息显示（可选）

**功能**:
- 显示当前用户的 uname（如果有）
- 在 StatusBar 或 Header 中显示

## 详细代码结构

### 文件清单

```
src/
├── utils/
│   ├── user.ts          # 用户管理（新建）
│   ├── realtime.ts       # Realtime 订阅管理（新建）
│   ├── db.ts            # 数据库操作（已存在，已更新）
│   └── cleanup.ts       # 清理工具（已存在）
├── components/
│   └── StatusBar.tsx    # 状态栏（需要更新）
└── App.tsx              # 主应用（需要更新）
```

### 数据流

```
应用启动
  ↓
初始化用户 (user.ts)
  ├─ 获取/创建 UUID (localStorage)
  ├─ 创建/更新访问者记录 (db.ts)
  ├─ 创建会话 (db.ts)
  └─ 记录访问 (db.ts)
  ↓
启动心跳定时器 (每 30 秒)
  ↓
订阅 Realtime (realtime.ts)
  ├─ 监听 sessions 表变化
  └─ 更新在线人数状态
  ↓
显示统计信息 (StatusBar)
  ├─ 在线人数
  ├─ 总访问量
  └─ 今日访问量
```

### 状态管理

在 `App.tsx` 中添加状态：

```typescript
// 用户相关
const [userId, setUserId] = useState<string | null>(null);
const [sessionId, setSessionId] = useState<string | null>(null);
const [userName, setUserName] = useState<string | null>(null);

// 统计信息
const [onlineCount, setOnlineCount] = useState<number>(0);
const [totalVisits, setTotalVisits] = useState<number>(0);
const [todayVisits, setTodayVisits] = useState<number>(0);
```

### 定时器管理

```typescript
// 心跳定时器
const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// 访问量刷新定时器（可选）
const visitsRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

## 实现细节

### 1. 用户初始化流程

```typescript
// 1. 获取或创建 UUID
const uid = getOrCreateUserId();

// 2. 创建/更新访问者
const visitor = await upsertVisitor(uid);

// 3. 创建会话
const sessionId = await upsertSession(uid);

// 4. 记录访问
await recordVisit(uid, sessionId, navigator.userAgent, document.referrer);

// 5. 启动心跳
startHeartbeat(sessionId);
```

### 2. 心跳机制

```typescript
// 每 30 秒更新一次心跳
const startHeartbeat = (sessionId: string) => {
  heartbeatIntervalRef.current = setInterval(async () => {
    try {
      await upsertSession(userId);
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, 30 * 1000);
};
```

### 3. Realtime 订阅

```typescript
// 订阅 sessions 表变化
const unsubscribe = subscribeOnlineCount((count) => {
  setOnlineCount(count);
});

// 组件卸载时取消订阅
useEffect(() => {
  return () => {
    unsubscribe();
  };
}, []);
```

### 4. setuname 命令处理

```typescript
const handleSetUname = async (uname: string) => {
  // 验证 uname
  if (!uname || uname.length > 20) {
    // 显示错误提示
    return;
  }

  try {
    await updateVisitorName(userId, uname);
    setUserName(uname);
    // 显示成功提示
  } catch (error) {
    // 显示错误提示
  }
};
```

## 错误处理

### 1. 网络错误

- 心跳失败时重试（指数退避）
- Realtime 连接断开时自动重连
- 访问量加载失败时显示缓存值

### 2. 数据验证

- UUID 格式验证
- uname 长度和字符限制
- 会话 ID 有效性检查

### 3. 用户提示

- 使用 StatusBar 或临时提示显示错误/成功消息
- 网络错误时显示离线状态

## 测试计划

### 1. 单元测试

- 用户 UUID 生成和存储
- 访问者记录创建和更新
- 会话心跳更新
- setuname 命令处理

### 2. 集成测试

- 用户初始化流程
- Realtime 订阅和更新
- 多用户同时在线场景
- 心跳和清理机制

### 3. 手动测试

- 打开多个标签页，验证在线人数
- 测试 setuname 命令
- 验证访问量统计准确性
- 测试页面刷新和关闭后的会话清理

## 性能优化

### 1. 心跳频率

- 默认 30 秒，可根据需要调整
- 页面隐藏时降低频率或暂停

### 2. Realtime 订阅

- 只订阅必要的数据
- 使用过滤器减少数据传输
- 及时清理订阅

### 3. 访问量统计

- 使用缓存减少数据库查询
- 定期刷新而非实时查询

## 后续优化

### 1. 用户列表显示

- 显示所有在线用户的 uname
- 显示用户活动状态

### 2. 访问历史

- 显示访问时间线
- 访问来源分析

### 3. 用户设置

- 更多用户信息设置
- 用户偏好保存

