import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRecommendationService, createGeminiRecommendationClient, selectLibraryBooks, getGroundedEvidence, selectWebBooks, matchesRequestedTitle, parseBookSearchXml, NO_MATCH_MESSAGE } from '../server/bookRecommendations.js';

const request = { topic: '물리학', difficulty: '높음', grade: '중1', searchMode: 'topic', kdc: '4', keywords: ['물리학'] };
const candidates = [
  { title: '심화 물리학', authors: '홍길동', isbn13: '9780000000001', description: '심화 물리학을 다루는 책' },
  { title: '재미있는 수학', authors: '김철수', isbn13: '9780000000002' }
];
const goodRating = { candidateId: 0, relevanceScore: 90, topicMatch: true, difficultyMatch: true, evidence: '심화 물리학', reason: '심화 물리학을 다뤄 깊이 있는 내용을 찾는 요청에 맞아요.' };
const identity = '제목은 심화 물리학, 저자는 홍길동이다. 깊이 있는 물리학 개념을 설명한다.';
const source = 'https://example.org/books/physics';
const grounded = { text: identity, groundingMetadata: { webSearchQueries: ['심화 물리학 책'], groundingChunks: [{ web: { uri: source } }], groundingSupports: [{ segment: { text: identity }, groundingChunkIndices: [0] }] } };
const webRecord = { title: '심화 물리학', author: '홍길동', identityEvidenceId: 0, detailEvidenceIds: [], description: '깊이 있는 물리학 개념을 설명한다.', relevanceScore: 90, topicMatch: true, difficultyMatch: true, reason: '깊이 있는 물리학 개념을 설명해 요청한 분야와 수준에 맞아요.' };
const json = data => ({ text: JSON.stringify(data) });

test('1권 적합하면 보충하지 않고 1권만 반환; 후보 메타데이터만 사용', () => {
  const books = selectLibraryBooks(candidates, { ratings: [goodRating, { ...goodRating, candidateId: 1, relevanceScore: 74 }] }, request);
  assert.equal(books.length, 1); assert.equal(books[0].title, candidates[0].title); assert.equal(books[0].sourceType, 'library');
});

test('75 미만/누락/가짜 후보 ID/분야 또는 난이도 불일치는 제외', () => {
  for (const override of [{ relevanceScore: 74 }, { relevanceScore: '95' }, { relevanceScore: 101 }, { relevanceScore: null }, { candidateId: 99 }, { topicMatch: false }, { difficultyMatch: false }, { evidence: '없는 소개' }]) {
    assert.deepEqual(selectLibraryBooks(candidates, { ratings: [{ ...goodRating, ...override }] }, request), []);
  }
});

test('ISBN 부분 일치나 비슷한 다른 제목으로 특정 책 대체 불가', () => {
  const exact = { ...request, searchMode: 'exact', specificTitle: '코스모스' };
  assert(matchesRequestedTitle('코스모스 (보급판)', exact));
  assert(!matchesRequestedTitle('코스모스의 비밀', exact));
  assert(!matchesRequestedTitle('청소년을 위한 코스모스', exact));
  assert.deepEqual(selectLibraryBooks(candidates, { ratings: [goodRating] }, exact), []);
});

test('웹 검색 실행 기록/실제 연결된 인용 없으면 모델이 책을 말해도 제외', () => {
  assert.deepEqual(getGroundedEvidence({ text: identity }), []);
  assert.deepEqual(getGroundedEvidence({ ...grounded, groundingMetadata: { ...grounded.groundingMetadata, webSearchQueries: [] } }), []);
  assert.deepEqual(getGroundedEvidence({ ...grounded, text: '근거 없음' }), []);
  const metadata = structuredClone(grounded.groundingMetadata);
  metadata.groundingChunks[0].web.uri = 'javascript:alert(1)';
  assert.deepEqual(getGroundedEvidence({ ...grounded, groundingMetadata: metadata }), []);
});

test('제목·저자 같은 인용에 필수, 만들어낸 출판사/ISBN/표지 제거', () => {
  const evidence = getGroundedEvidence(grounded);
  const books = selectWebBooks({ books: [{ ...webRecord, publisher: '가짜 출판사', isbn13: '9781111111111', cover: 'https://fake.example/cover.jpg' }] }, evidence, request);
  assert.equal(books.length, 1); assert.equal(books[0].sourceUrl, source);
  assert.equal(books[0].publisher, null); assert.equal(books[0].isbn13, null); assert.equal(books[0].cover, null);
  for (const override of [{ title: 'ABCXYZ' }, { author: '만든 저자' }, { identityEvidenceId: 99 }, { description: '근거 없는 책 내용' }, { difficultyMatch: false }]) {
    assert.deepEqual(selectWebBooks({ books: [{ ...webRecord, ...override }] }, evidence, request), []);
  }
});

test('적합한 library 책이 있으면 Google Search 미호출', async () => {
  const stages = [];
  const recommend = createRecommendationService({ fetchCandidates: async () => candidates,
    searchTitle: async () => { throw Error('unexpected'); },
    generate: async ({ stage }) => { stages.push(stage); return stage === 'analyze' ? json(request) : json({ ratings: [goodRating] }); } });
  const result = await recommend({ userMessage: '심화 물리학' });
  assert.equal(result.books.length, 1); assert.equal(result.search.fallbackUsed, false);
  assert.deepEqual(stages, ['analyze', 'evaluate_library']);
});

test('관련 없는 API 후보는 Google Search fallback → 출처 검증 후 반환', async () => {
  const stages = [];
  const recommend = createRecommendationService({ fetchCandidates: async () => candidates, searchTitle: async () => [],
    generate: async ({ stage, search }) => {
      stages.push(stage);
      if (stage === 'analyze') return json(request);
      if (stage === 'evaluate_library') return json({ ratings: [{ ...goodRating, relevanceScore: 30 }] });
      if (stage === 'google_search') { assert.equal(search, true); return grounded; }
      return json({ books: [webRecord] });
    } });
  const result = await recommend({ userMessage: '심화 물리학' });
  assert.equal(result.books[0].sourceType, 'web'); assert(result.search.googleSearchExecuted);
  assert.deepEqual(stages, ['analyze', 'evaluate_library', 'google_search', 'extract_grounded_books']);
});

test('정확한 제목 검색은 srchBooks 경로만 조회, 다른 책 반환해도 제외', async () => {
  let titleSearched;
  const exact = { ...request, searchMode: 'exact', specificTitle: 'ABCXYZ' };
  const recommend = createRecommendationService({ fetchCandidates: async () => { throw Error('must not use broad candidates'); },
    searchTitle: async title => { titleSearched = title; return candidates; },
    generate: async ({ stage }) => stage === 'analyze' ? json(exact) : stage === 'google_search' ? grounded : json({ books: [webRecord] }) });
  const result = await recommend({ userMessage: 'ABCXYZ 찾아줘' });
  assert.equal(titleSearched, 'ABCXYZ'); assert.equal(result.books.length, 0); assert.equal(result.response, NO_MATCH_MESSAGE);
});

test('API 오류/모델 오류/비grounded 답변에서 내장 책을 생성하지 않음', async () => {
  for (const mode of ['library_failure', 'search_failure', 'ungrounded']) {
    const recommend = createRecommendationService({ fetchCandidates: async () => { if (mode === 'library_failure') throw Error('offline'); return []; }, searchTitle: async () => [],
      generate: async ({ stage }) => { if (stage === 'analyze') return json(request); if (mode === 'search_failure') throw Error('quota'); return { text: '내가 아는 추천 도서' }; } });
    const result = await recommend({ userMessage: '물리학' });
    assert.deepEqual(result.books, []); assert.equal(result.response, NO_MATCH_MESSAGE); assert(result.search.fallbackUsed);
  }
});

test('Gemini REST 호출에 실제 google_search 도구 포함, 키는 URL에 없음', async () => {
  let sent;
  const generate = createGeminiRecommendationClient({ apiKey: 'test-key', fetchImpl: async (url, options) => {
    sent = { url, ...options }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: identity }] }, groundingMetadata: grounded.groundingMetadata }] }) };
  } });
  const result = await generate({ prompt: '물리학', system: 'search', search: true, json: true, stage: 'google_search' });
  assert.deepEqual(JSON.parse(sent.body).tools, [{ google_search: {} }]);
  assert.equal(JSON.parse(sent.body).generationConfig.responseMimeType, undefined);
  assert(!sent.url.includes('test-key')); assert(result.groundingMetadata.webSearchQueries.length);
});

test('srchBooks XML의 실제 제목/저자/엔티티 파싱', () => {
  const books = parseBookSearchXml('<response><docs><doc><bookname><![CDATA[코스모스]]></bookname><authors>칼 세이건</authors><publisher>A&amp;B</publisher></doc></docs></response>');
  assert.equal(books[0].title, '코스모스'); assert.equal(books[0].authors, '칼 세이건'); assert.equal(books[0].publisher, 'A&B');
});

test('브라우저는 빈 결과와 서버 실패를 내장 책으로 바꾸지 않음', async () => {
  const source = fs.readFileSync(new URL('../curator/app.js', import.meta.url), 'utf8');
  const turn = source.slice(source.indexOf('async function runAgentTurn'), source.indexOf('\nfunction initApp'));
  for (const offline of [false, true]) {
    const shown = [];
    const state = { turnCount: 0, chatHistory: [], recommendedBooks: [] };
    const context = { AgentState: state, SafetyGuardrail: { check: () => ({ isSafe: true }) }, extractInterests() {},
      callRecommendBooksApi: async () => { if (offline) throw Error('offline'); return { success: true, books: [], response: NO_MATCH_MESSAGE }; },
      renderHud() {}, renderTaoTurn() {}, appendLibrarianMessage: (text, books) => shown.push({ text, books }) };
    vm.createContext(context); vm.runInContext(turn, context);
    await vm.runInContext("runAgentTurn('세상에 없는 가짜책 ABCXYZ 찾아줘')", context);
    assert.equal(shown.length, 1); assert(!shown[0].books?.length); assert.equal(state.recommendedBooks.length, 0);
  }
});

test('[이 책 읽기]는 기존 세션 보존 + 제목 전달로 동작', () => {
  const source = fs.readFileSync(new URL('../curator/app.js', import.meta.url), 'utf8');
  const pick = source.slice(source.indexOf('function readThisBook'), source.indexOf('function appendLibrarianMessage'));
  let saved;
  const context = { localStorage: { getItem: () => JSON.stringify({ recentMessages: ['기존 대화'] }), setItem: (_, value) => saved = JSON.parse(value) }, window: { location: {} }, console };
  vm.createContext(context); vm.runInContext(pick, context); vm.runInContext("readThisBook('코스모스', '칼 세이건')", context);
  assert.equal(saved.bookTitle, '코스모스 (칼 세이건)'); assert.deepEqual(saved.recentMessages, ['기존 대화']);
  assert.equal(context.window.location.href, '/?title=' + encodeURIComponent(saved.bookTitle));
});
