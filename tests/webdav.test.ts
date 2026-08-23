import { describe, it, expect } from 'vitest';
import { webdavKeyForFolder } from '../src/webdav';

// ---------------------------------------------------------------------------
// webdavKeyForFolder：同名目录防覆盖键计算
// ---------------------------------------------------------------------------
describe('webdavKeyForFolder', () => {
    it('无冲突：basename 直接作键', () => {
        const owners: Record<string, string> = {};
        expect(webdavKeyForFolder(owners, '/华语/精选')).toBe('精选');
        owners['精选'] = '华语/精选';
        expect(webdavKeyForFolder(owners, '/欧美/经典')).toBe('经典');
    });

    it('同名冲突（不同父目录）：父目录/basename 消歧', () => {
        const owners: Record<string, string> = {};
        expect(webdavKeyForFolder(owners, '/华语/精选')).toBe('精选');
        owners['精选'] = '华语/精选';
        expect(webdavKeyForFolder(owners, '/欧美/精选')).toBe('欧美/精选');
    });

    it('根级与父级同名：完整相对路径兜底 + 序号保证唯一', () => {
        const owners: Record<string, string> = {};
        // /华语/精选 先处理 → 键 '精选'
        expect(webdavKeyForFolder(owners, '/华语/精选')).toBe('精选');
        owners['精选'] = '华语/精选';
        // /精选（根级）→ '精选' 被不同目录占用，altKey='精选' 仍占用 → '精选 (2)'
        expect(webdavKeyForFolder(owners, '/精选')).toBe('精选 (2)');
    });

    it('三个目录同名均唯一', () => {
        const owners: Record<string, string> = {};
        // 模拟 runScanTask 的调用方式：每次算键后把 键→相对路径 记入 owners
        const add = (path: string) => {
            const key = webdavKeyForFolder(owners, path);
            owners[key] = path === '/' ? '' : path.replace(/^\/+/, '');
            return key;
        };
        const keys = [add('/华语/精选'), add('/欧美/精选'), add('/精选')];
        expect(new Set(keys).size).toBe(3);
    });

    it('根目录 → 根目录', () => {
        const owners: Record<string, string> = {};
        expect(webdavKeyForFolder(owners, '/')).toBe('根目录');
    });

    it('同名目录自身重复扫描返回同一键（不误判）', () => {
        const owners: Record<string, string> = {};
        const rel = '华语/精选';
        expect(webdavKeyForFolder(owners, '/华语/精选')).toBe('精选');
        owners['精选'] = rel;
        // 同一目录再算一次：owner 相同 → 仍返回 basename
        expect(webdavKeyForFolder(owners, '/华语/精选')).toBe('精选');
    });
});
