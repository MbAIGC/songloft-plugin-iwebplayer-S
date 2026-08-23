// 本地类型声明补充：宿主真实返回但 SDK 类型陈旧的字段（见 docs/修复计划-基于GPT5.6审阅记录.md #16）
import type {} from '@songloft/plugin-sdk';

declare module '@songloft/plugin-sdk' {
    interface Playlist {
        /** 歌单标签：auto_created / built_in 等（宿主返回） */
        labels?: string[];
    }
    interface Song {
        /** 歌曲加入时间戳（宿主返回） */
        added_at?: number;
    }
}
