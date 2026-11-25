import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import { createServer } from 'vite';

const TANG = '全唐诗';
const SONG = '全宋诗';
const songPath = '/全唐诗/poet.song.0.json';
const tangPath = '/全唐诗/poet.tang.0.json';
const supplementPath = '/全唐诗/唐诗补录.json';
const anthologyPath = '/全唐诗/唐诗三百首.json';
const key = (group, path) => `${group}|${path}`;

// First records of the pinned upstream snapshot (see tests/README.md).
const song = {
  id: '08e41396-2809-423d-9bbc-1e6fb24c0ca1', title: '日詩', author: '宋太祖',
  paragraphs: ['欲出未出光辣達，千山萬山如火發。', '須臾走向天上來，逐却殘星趕却月。'],
};
const tang = {
  id: '3ad6d468-7ff1-4a7b-8b24-a27d70d00ed4', title: '帝京篇十首 一', author: '太宗皇帝',
  paragraphs: ['秦川雄帝宅，函谷壯皇居。', '綺殿千尋起，離宮百雉餘。', '連甍遙接漢，飛觀迥凌虛。', '雲日隱層闕，風煙出綺疎。'],
};
const supplement = {
  title: '', author: '佚名', paragraphs: ['住在绿池边，朝朝学采莲', '水深偏责就，莲尽更移舡'],
  notes: '长沙窑“补遗”《全唐诗》',
};
const genuine = { title: '原本唐诗', author: '唐人', paragraphs: ['甲句。', '乙句。'], id: 'anthology-record' };
const ambiguous = { ...genuine, id: 'song-overlap' };
const noId = { title: '無編號', author: '宋人', paragraphs: ['戊己。'] };
const readCorpus = (name, fallback) => process.env.PAINTPOEM_CORPUS
  ? JSON.parse(readFileSync(`${process.env.PAINTPOEM_CORPUS}/${name}.json`, 'utf8'))
  : fallback;

test('import route upgrades legacy SQLite rows, keeps links, and retries failed writes', async t => {
  const sqlite = new DatabaseSync(':memory:');
  const vite = await createServer({ server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
  let rejectTang = false;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    await vite.close();
    sqlite.close();
  });
  // Use the actual Tauri SQL JS client and app SQL, substituting only the native IPC bridge.
  globalThis.window = { __TAURI_INTERNALS__: { invoke: async (command, args) => {
    if (command === 'plugin:sql|load') return args.db;
    const params = JSON.parse(JSON.stringify(args.values));
    if (rejectTang && command === 'plugin:sql|execute' &&
      args.query.includes('INSERT INTO poems (import_identity') && params[0].includes(TANG)) {
      throw new Error('fixture: disk write failed');
    }
    const statement = sqlite.prepare(args.query);
    if (command === 'plugin:sql|select') return statement.all(...params);
    if (command === 'plugin:sql|execute') {
      const result = statement.run(...params);
      return [result.changes, result.lastInsertRowid];
    }
    throw new Error(`Unexpected IPC: ${command}`);
  } } };
  const songFile = [...readCorpus('poet.song.0', [song]), noId, noId, ambiguous];
  const tangFile = readCorpus('poet.tang.0', [tang]);
  const files = new Map([
    [songPath, songFile],
    [tangPath, tangFile],
    [supplementPath, readCorpus('唐诗补录', [supplement])],
    [anthologyPath, [...readCorpus('唐诗三百首', []), genuine]],
  ]);
  const requested = [];
  globalThis.fetch = async url => {
    const path = decodeURI(new URL(url).pathname).replace(/^\/chinese-poetry\/chinese-poetry\/refs\/heads\/master/, '');
    const data = files.get(path);
    assert.ok(data, `Unexpected source: ${path}`);
    requested.push(path);
    return Response.json(data);
  };

  const { initDb, addFavorite, addPoemCover, markSourceAsImported } = await vite.ssrLoadModule('/src/db/index.ts');
  const { importFromSource, convertPoemToSimplified } = await vite.ssrLoadModule('/src/services/import.ts');
  const { poemSource } = await vite.ssrLoadModule('/src/datas/poemSource.ts');
  const slice = await vite.ssrLoadModule('/src/store/downloadSlice.ts');
  const urls = name => poemSource.find(config => config.name === name).urls.map(item => item.url);
  assert.equal(urls(TANG).filter(path => path.includes('/poet.tang.')).length, 58);
  assert.equal(urls(SONG).filter(path => path.includes('/poet.song.')).length, 255);
  assert.deepEqual(urls(TANG).slice(-2), [supplementPath, anthologyPath]);
  // Only import a representative subset via the same grouped Redux action as the page.
  poemSource.splice(0, poemSource.length,
    { name: TANG, urls: [tangPath, supplementPath].map(url => ({ url, groups: [TANG] })) },
    { name: SONG, urls: [{ url: songPath, groups: [SONG] }] },
  );

  // Released poems table, before upgrading; all other tables are initialized by app code.
  sqlite.exec(`CREATE TABLE poems (id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT, author TEXT, paragraphs TEXT, tags TEXT, groups TEXT, cover TEXT,
    notes TEXT, rhythmic TEXT, chapter TEXT, content TEXT, comment TEXT,
    volume TEXT, biography TEXT, section TEXT, prologue TEXT, origin TEXT, source TEXT,
    translation TEXT, ai_optimized INTEGER DEFAULT 0, original_paragraphs TEXT, pinyin TEXT)`);
  const seed = sqlite.prepare(`INSERT INTO poems
    (id, title, author, paragraphs, groups, original_paragraphs, translation) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const [id, poem, paragraphs, original, translation, groups] of [
    [41, song, ['优化正文'], JSON.stringify(song.paragraphs), '原有译文', [TANG]],
    [42, convertPoemToSimplified(song), convertPoemToSimplified(song).paragraphs, null, null, [TANG]],
    [43, genuine, genuine.paragraphs, null, null, [TANG]],
    [44, song, ['未匹配正文'], null, null, [TANG]],
    [45, song, song.paragraphs, null, null, [TANG, '用户分组']],
  ]) seed.run(id, poem.title, poem.author, JSON.stringify(paragraphs), JSON.stringify(groups), original, translation);
  await initDb();
  await addFavorite(41);
  await addFavorite(42);
  await addPoemCover(41, '/fixture/cover.png');
  await markSourceAsImported(key(TANG, songPath), TANG, songPath, 2);
  const makeStore = () => configureStore({ reducer: { download: slice.default } });
  const selectTask = (store, group, path) => store.getState().download.tasks
    .find(task => task.sourceKey === key(group, path));
  let store = makeStore();
  await store.dispatch(slice.initializeImportSources()).unwrap();
  assert.equal(selectTask(store, SONG, songPath).status, 'pending');
  assert.equal(selectTask(store, TANG, tangPath).status, 'pending');
  const result = await store.dispatch(slice.startSourceBatchImport(SONG)).unwrap();
  assert.equal(result[0].failed, 0);
  assert.equal(selectTask(store, SONG, songPath).status, 'completed');
  assert.deepEqual(new Set(requested), new Set([songPath, supplementPath, anthologyPath]));
  const find = id => sqlite.prepare('SELECT * FROM poems WHERE id = ?').get(id);
  assert.equal(find(41).groups, JSON.stringify([SONG]));
  assert.equal(find(42).groups, JSON.stringify([SONG]));
  assert.equal(find(41).translation, '原有译文');
  assert.equal(find(41).paragraphs, '["优化正文"]');
  assert.equal(find(43).groups, JSON.stringify([TANG])); // exact Tang/Song overlap left alone
  assert.equal(find(44).groups, JSON.stringify([TANG])); // title and author alone are insufficient
  assert.equal(find(45).groups, JSON.stringify([TANG, '用户分组']));
  assert.deepEqual(sqlite.prepare('SELECT poem_id FROM favorites ORDER BY poem_id').all().map(row => row.poem_id), [41, 42]);
  assert.equal(sqlite.prepare('SELECT cover_path FROM poem_covers WHERE poem_id = 41').get().cover_path, '/fixture/cover.png');

  const count = () => sqlite.prepare('SELECT count(*) n FROM poems').get().n;
  const before = count();
  await store.dispatch(slice.reimportSourceBatch(SONG)).unwrap();
  assert.equal(count(), before);
  assert.equal((await importFromSource({ url: songPath, groups: [SONG] })).imported, 0);
  assert.equal(count(), before);

  rejectTang = true;
  const [failed] = await store.dispatch(slice.startSourceBatchImport(TANG)).unwrap();
  assert.ok(failed.failed > 0);
  assert.equal(selectTask(store, TANG, tangPath).status, 'failed');
  assert.equal(selectTask(store, TANG, tangPath).poemCount, 0);
  store = makeStore();
  await store.dispatch(slice.initializeImportSources()).unwrap();
  assert.equal(selectTask(store, TANG, tangPath).status, 'failed');
  rejectTang = false;
  const [retried] = await store.dispatch(slice.startSourceBatchImport(TANG)).unwrap();
  assert.equal(retried.failed, 0);
  assert.equal(retried.imported, tangFile.length + 1);
  assert.equal(selectTask(store, TANG, tangPath).status, 'completed');
  assert.equal(selectTask(store, TANG, tangPath).poemCount, tangFile.length);
  assert.equal(sqlite.prepare("SELECT groups FROM poems WHERE title = '无题'").get().groups, JSON.stringify([TANG]));
});
