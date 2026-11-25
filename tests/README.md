# 诗库导入回归测试

Node.js 22.13+：安装依赖后运行 `node --test tests/collectionImport.test.mjs`。

测试调用导入页面所用的 Redux 操作和实际的 SQL 模块，使用真实 SQLite 内存库；网络和 Tauri 原生 IPC 边界由测试替代。只用合成数据，不打开用户的诗库。

内置样例来自 [chinese-poetry 固定快照 b8594f8](https://github.com/chinese-poetry/chinese-poetry/tree/b8594f81a89752241442f2ce267d6f66f96704ee/全唐诗) 的宋诗、唐诗首卷和唐诗补录，并包含人为构造的重合及异常记录。也可将同一快照的 `poet.song.0.json`、`poet.tang.0.json`、`唐诗补录.json` 和 `唐诗三百首.json` 下载到一个目录，以 `PAINTPOEM_CORPUS=/目录 node --test tests/collectionImport.test.mjs` 用完整首卷再测一遍。
