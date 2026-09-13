// Tauri 桌面版静态导出构建：
// 1. 临时把 app/api 移出项目（静态导出不支持服务端路由）
// 2. BUILD_MODE=static next build
// 3. 无论成败都恢复 app/api
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';

const apiDir = 'app/api';
const backupDir = '.api-backup-tmp';
const moved = existsSync(apiDir);

if (moved) {
  rmSync(backupDir, { recursive: true, force: true });
  renameSync(apiDir, backupDir);
}
try {
  execSync('npx next build', {
    stdio: 'inherit',
    env: { ...process.env, BUILD_MODE: 'static' },
  });
} finally {
  if (moved && existsSync(backupDir)) {
    mkdirSync('app', { recursive: true });
    renameSync(backupDir, apiDir);
  }
}
