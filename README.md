# DBAPI Service

企业级低代码轻量级数据仓库开发工具，为数据仓库开发者提供快速创建、管理和部署数据 API 的解决方案。

## 功能特性

### 核心功能
- **数据源管理**：支持 MySQL、PostgreSQL、MSSQL、Oracle 等多种数据库
- **API 低代码开发**：通过可视化界面快速创建 RESTful API
- **SQL 模板编辑**：内置 Monaco Editor，支持 SQL 语法高亮和格式化
- **API 自动生成**：根据数据库表结构自动生成 API 接口
- **权限管理**：基于角色的访问控制（RBAC）
- **API 文档**：自动生成 API 文档，支持在线测试
- **操作日志**：完整的操作审计和访问日志
- **数据脱敏**：支持敏感数据脱敏规则配置
- **IP 白名单**：可配置 IP 访问控制
- **API 分类管理**：支持 API 分类和标签管理

### 系统特性
- **多数据库支持**：MySQL、PostgreSQL、MSSQL、Oracle
- **连接池管理**：高效的数据库连接池管理
- **请求限流**：防止 API 滥用，保护系统稳定性
- **安全防护**：Helmet 安全头、CORS 配置、JWT 认证
- **日志系统**：Winston 日志框架，支持多级别日志
- **系统配置**：可动态配置系统参数（监听地址、端口等）

## 技术栈

### 后端
- **运行时**：Node.js
- **框架**：Express.js
- **语言**：TypeScript
- **数据库**：SQLite（系统数据库）
- **ORM**：原生 SQL
- **认证**：JWT + bcrypt
- **日志**：Winston
- **其他**：
  - mysql2（MySQL 驱动）
  - pg（PostgreSQL 驱动）
  - mssql（MSSQL 驱动）
  - oracledb（Oracle 驱动）
  - express-rate-limit（请求限流）
  - helmet（安全头）
  - cors（跨域支持）

### 前端
- **框架**：React 18
- **构建工具**：Vite
- **UI 组件库**：Ant Design
- **路由**：React Router v6
- **HTTP 客户端**：Axios
- **代码编辑器**：Monaco Editor
- **SQL 格式化**：sql-formatter
- **日期处理**：Day.js

## 项目结构

```
DBAPI_Service/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   │   └── database.ts  # 数据库配置
│   │   ├── middleware/      # 中间件
│   │   │   ├── auth.ts      # 认证中间件
│   │   │   ├── errorHandler.ts
│   │   │   ├── ipWhitelist.ts
│   │   │   ├── permission.ts
│   │   │   ├── rateLimiter.ts
│   │   │   └── requestLogger.ts
│   │   ├── routes/          # 路由
│   │   │   ├── api.ts       # API 管理
│   │   │   ├── apiGenerator.ts
│   │   │   ├── auth.ts      # 认证路由
│   │   │   ├── datasource.ts
│   │   │   ├── docs.ts
│   │   │   ├── execute.ts
│   │   │   ├── log.ts
│   │   │   ├── permission.ts
│   │   │   ├── stats.ts
│   │   │   ├── systemConfig.ts
│   │   │   └── user.ts
│   │   ├── services/        # 服务层
│   │   │   ├── apiGenerator.ts
│   │   │   ├── databasePool.ts
│   │   │   ├── schemaIntrospector.ts
│   │   │   └── validationService.ts
│   │   ├── utils/           # 工具函数
│   │   │   ├── ipHelper.ts
│   │   │   ├── logger.ts
│   │   │   └── sqlParameterExtractor.ts
│   │   ├── types/           # 类型定义
│   │   └── app.ts           # 应用入口
│   ├── dist/                # 编译输出
│   ├── logs/                # 日志文件
│   ├── .env                 # 环境变量
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/                # 前端应用
    ├── src/
    │   ├── components/      # 组件
    │   │   ├── MainLayout.tsx
    │   │   └── PermissionGuard.tsx
    │   ├── contexts/        # 上下文
    │   │   └── PermissionContext.tsx
    │   ├── pages/           # 页面
    │   │   ├── ApiAccessLogs.tsx
    │   │   ├── ApiAutoGenerate.tsx
    │   │   ├── ApiCreate.tsx
    │   │   ├── ApiDocs.tsx
    │   │   ├── ApiList.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── DatasourceCreate.tsx
    │   │   ├── DatasourceEdit.tsx
    │   │   ├── DatasourceList.tsx
    │   │   ├── LogList.tsx
    │   │   ├── Login.tsx
    │   │   ├── PermissionList.tsx
    │   │   ├── SystemConfig.tsx
    │   │   └── UserList.tsx
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── dist/               # 构建输出
    ├── .env                # 环境变量
    ├── .env.example
    ├── package.json
    └── vite.config.ts
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

#### 后端

```bash
cd backend
npm install
```

#### 前端

```bash
cd frontend
npm install
```

### 配置环境变量

#### 后端配置

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp backend/.env.example backend/.env
```

主要配置项：

```env
PORT=3000                              # 后端服务端口
NODE_ENV=development                    # 运行环境

JWT_SECRET=your-secret-key-change-in-production  # JWT 密钥
JWT_EXPIRES_IN=7d                      # Token 过期时间

LOG_LEVEL=info                         # 日志级别
LOG_DIR=./logs                         # 日志目录

RATE_LIMIT_WINDOW_MS=900000            # 限流时间窗口（毫秒）
RATE_LIMIT_MAX_REQUESTS=10000           # 时间窗口内最大请求数
```

#### 前端配置

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp frontend/.env.example frontend/.env
```

主要配置项：

```env
VITE_FRONTEND_HOST=0.0.0.0             # 前端监听地址
VITE_FRONTEND_PORT=3001                # 前端端口
VITE_BACKEND_PROTOCOL=http             # 后端协议
VITE_BACKEND_HOST=localhost            # 后端地址
VITE_BACKEND_PORT=3000                 # 后端端口
```

### 启动服务

#### 开发模式

**后端服务**：

```bash
cd backend
npm run dev
```

服务将运行在 `http://localhost:3000`

**前端服务**：

```bash
cd frontend
npm run dev
```

服务将运行在 `http://localhost:3001`

#### 生产模式

**构建后端**：

```bash
cd backend
npm run build
npm start
```

**构建前端**：

```bash
cd frontend
npm run build
npm run preview
```

### 默认账号

系统初始化时会创建默认管理员账号：

- 用户名：`admin`
- 密码：`admin123`

**首次登录后请立即修改密码！**

## 使用指南

### 1. 数据源管理

登录系统后，进入"数据源管理"页面，可以：

- 创建新的数据源连接
- 测试数据源连接
- 编辑和删除数据源
- 查看数据源状态

支持的数据源类型：
- MySQL
- PostgreSQL
- MSSQL
- Oracle

### 2. API 创建

进入"API管理"页面，点击"创建API"：

1. 选择数据源
2. 填写 API 基本信息（名称、路径、方法、描述）
3. 编写 SQL 模板（支持参数化查询）
4. 配置请求参数
5. 设置 API 权限和分类
6. 保存并发布 API

### 3. API 自动生成

使用"API自动生成"功能：

1. 选择数据源
2. 选择数据库表
3. 系统自动生成增删改查 API
4. 可根据需要调整生成的 API

### 4. API 测试

在 API 列表页面：

- 点击"测试"按钮打开测试面板
- 填写请求参数
- 执行测试并查看结果
- 查看请求日志和性能指标

### 5. 权限管理

进入"权限管理"页面：

- 查看和管理系统权限
- 配置角色权限
- 设置 API 访问权限

### 6. 用户管理

进入"用户管理"页面：

- 创建新用户
- 分配角色
- 重置用户密码
- 启用/禁用用户

### 7. 系统配置

进入"系统配置"页面：

- 配置服务器监听地址和端口
- 启用/禁用 IP 白名单
- 管理系统参数

### 8. 操作日志

进入"操作日志"页面：

- 查看所有操作记录
- 筛选和搜索日志
- 查看详细操作信息

## API 文档

### 认证接口

#### 登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

响应：

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@dbapi.com",
    "role": "admin"
  }
}
```

#### 获取当前用户信息

```http
GET /api/auth/me
Authorization: Bearer {token}
```

### 数据源接口

#### 创建数据源

```http
POST /api/datasources
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "MySQL 数据库",
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "database_name": "test_db",
  "username": "root",
  "password": "password"
}
```

#### 获取数据源列表

```http
GET /api/datasources
Authorization: Bearer {token}
```

### API 接口

#### 创建 API

```http
POST /api/apis
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "用户列表",
  "path": "/users",
  "method": "GET",
  "description": "获取用户列表",
  "datasource_id": 1,
  "sql_template": "SELECT * FROM users WHERE status = :status",
  "require_auth": true,
  "category": "user"
}
```

#### 执行 API

```http
GET /users?status=active
Authorization: Bearer {token}
```

## 数据库表结构

### users（用户表）
- `id`: 用户 ID
- `username`: 用户名
- `password`: 密码（加密）
- `email`: 邮箱
- `role`: 角色（admin/developer/viewer）
- `status`: 状态（active/inactive）
- `api_token`: API Token
- `token_expires_at`: Token 过期时间
- `token_permissions`: Token 权限配置
- `created_at`: 创建时间
- `updated_at`: 更新时间

### datasources（数据源表）
- `id`: 数据源 ID
- `name`: 名称
- `type`: 类型（mysql/postgresql/mssql/oracle）
- `host`: 主机地址
- `port`: 端口
- `database_name`: 数据库名
- `username`: 用户名
- `password`: 密码（加密）
- `status`: 状态
- `created_by`: 创建人
- `created_at`: 创建时间
- `updated_at`: 更新时间

### apis（API 表）
- `id`: API ID
- `name`: 名称
- `path`: 路径
- `method`: 方法（GET/POST/PUT/DELETE）
- `description`: 描述
- `datasource_id`: 数据源 ID
- `sql_template`: SQL 模板
- `status`: 状态（draft/published/deprecated）
- `require_auth`: 是否需要认证
- `category`: 分类
- `created_by`: 创建人
- `created_at`: 创建时间
- `updated_at`: 更新时间

### api_access_logs（API 访问日志表）
- `id`: 日志 ID
- `api_id`: API ID
- `user_id`: 用户 ID
- `ip_address`: IP 地址
- `user_agent`: 用户代理
- `request_params`: 请求参数
- `response_status`: 响应状态
- `execution_time`: 执行时间
- `status`: 状态（success/failure）
- `error_message`: 错误信息
- `created_at`: 创建时间

### operation_logs（操作日志表）
- `id`: 日志 ID
- `user_id`: 用户 ID
- `action`: 操作类型
- `resource_type`: 资源类型
- `resource_id`: 资源 ID
- `details`: 详细信息
- `ip_address`: IP 地址
- `user_agent`: 用户代理
- `status`: 状态
- `error_message`: 错误信息
- `created_at`: 创建时间

### system_settings（系统设置表）
- `id`: 设置 ID
- `key`: 键
- `value`: 值
- `description`: 描述
- `created_at`: 创建时间
- `updated_at`: 更新时间

## 部署说明

### Docker 部署

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    volumes:
      - ./backend/logs:/app/logs
      - ./backend/dbapi_service.db:/app/dbapi_service.db
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

启动服务：

```bash
docker-compose up -d
```

### Nginx 反向代理

配置 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 安全建议

1. **修改默认密码**：首次登录后立即修改 admin 密码
2. **使用强密码**：所有用户使用复杂密码
3. **配置 JWT_SECRET**：生产环境使用强随机密钥
4. **启用 HTTPS**：生产环境使用 SSL/TLS
5. **配置 IP 白名单**：限制访问来源
6. **定期备份数据**：定期备份 SQLite 数据库
7. **更新依赖**：定期更新依赖包修复安全漏洞
8. **日志监控**：监控操作日志，及时发现异常

## 常见问题

### 1. 后端服务无法启动

检查端口是否被占用：

```bash
lsof -i :3000
```

检查环境变量配置是否正确。

### 2. 前端无法连接后端

检查 `.env` 文件中的 `VITE_BACKEND_HOST` 和 `VITE_BACKEND_PORT` 配置。

### 3. 数据源连接失败

- 检查数据库地址、端口、用户名、密码是否正确
- 检查数据库是否允许远程连接
- 检查防火墙设置

### 4. API 执行报错

- 检查 SQL 语法是否正确
- 检查参数名称是否匹配
- 查看操作日志获取详细错误信息

## 开发指南

### 添加新的数据源类型

1. 在 `backend/src/services/databasePool.ts` 中添加新的连接池创建方法
2. 在 `backend/src/routes/datasource.ts` 中添加类型验证
3. 在前端数据源创建页面添加新的类型选项

### 添加新的权限

1. 在 `backend/src/config/database.ts` 的 `initDefaultPermissions` 函数中添加新权限
2. 在前端权限管理页面中配置权限

### 自定义日志格式

修改 `backend/src/utils/logger.ts` 中的日志格式配置。

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue。

---

**注意**：本项目仅供学习和开发使用，生产环境请做好安全加固。
