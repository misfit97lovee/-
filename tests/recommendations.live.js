import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.TEST_API_BASE || 'http://127.0.0.1:3012';
const cases = [
  '중1인데 쉬운 우주 책 추천해줘',
  '난이도가 높고 깊이 있는 물리학 책 추천해줘',
  '코스모스 찾아줘',
  '세상에 없는 가짜책 ABCXYZ 찾아줘'
];
const results = [];
let next = 0;
async function worker() {
  while (next < cases.length) {
    const index = next++;
    const input = cases[index];
    console.log(`START TEST ${index + 1}: ${input}`);
    const start = Date.now();
    try {
      const response = await fetch(`${base}/api/recommend-books`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: input, userGrade: '중1' }), signal: AbortSignal.timeout(300000) });
      assert(response.ok, `HTTP ${response.status}`);
      const data = await response.json();
      assert(data.success);
      assert(data.books.length <= 3);
      for (const book of data.books) {
        assert(book.title && book.author && book.relevanceScore >= 75);
        assert(['library', 'web'].includes(book.sourceType));
        if (book.sourceType === 'web') {
          assert(data.search.googleSearchRequested && data.search.googleSearchExecuted);
          assert(book.sourceUrl && book.verification.identityEvidence);
        }
      }
      if (index === 2) assert(data.books.every(b => b.title.replace(/\([^)]*\)/g, '').split(/[:：]/)[0].replace(/\s/g, '') === '코스모스'));
      if (index === 3) { assert.equal(data.books.length, 0); assert(data.response.includes('조건에 딱 맞는 책을 확인하지 못했어')); }
      results[index] = { test: index + 1, input, elapsedMs: Date.now() - start, data };
      console.log(JSON.stringify(results[index], null, 2));
    } catch (error) {
      results[index] = { test: index + 1, input, error: error.message };
      console.error(JSON.stringify(results[index]));
    }
  }
}
await Promise.all([worker(), worker()]);
await fs.writeFile('/tmp/ku-recommendation-live-results.json', JSON.stringify(results, null, 2));
if (results.some(result => result.error)) process.exitCode = 1;
