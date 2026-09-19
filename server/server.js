import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { buildSystemPrompt, buildSummaryPrompt, buildReadingNotePrompt } from './prompts.js';
import { createRecommendationService, createGeminiRecommendationClient, parseBookSearchXml } from './bookRecommendations.js';

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || process.env.PORT || 3002;

// API 키 로드 (기존 .env의 GEMINI_API 또는 표준 GEMINI_API_KEY 지원)
const rawApiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API || '';
const apiKey = rawApiKey.trim();

// 정보나루 (data4library) API 설정
const DATA4LIBRARY_AUTH_KEY = process.env.DATA4LIBRARY_AUTH_KEY || '';
const DATA4LIBRARY_LIB_CODE = process.env.DATA4LIBRARY_LIB_CODE || '';
const DATA4LIBRARY_BASE_URL = process.env.DATA4LIBRARY_BASE_URL || 'https://data4library.kr/api';

// 미들웨어 설정 (이미지 Base64 처리를 위해 20MB로 넉넉하게 설정)
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: Boolean(apiKey),
    targetModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    data4library: {
      hasAuthKey: Boolean(DATA4LIBRARY_AUTH_KEY),
      libCode: DATA4LIBRARY_LIB_CODE,
      baseUrl: DATA4LIBRARY_BASE_URL
    }
  });
});

/**
 * data4library XML 파싱 헬퍼 함수 (외부 라이브러리 없이 안전한 정규식 추출)
 */
function parseLibraryXml(xmlString) {
  const docs = [];
  const docRegex = /<doc>([\s\S]*?)<\/doc>/g;
  let match;

  while ((match = docRegex.exec(xmlString)) !== null) {
    const docXml = match[1];

    const getTagValue = (tagName) => {
      const regex = new RegExp(`<${tagName}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tagName}>`, 'i');
      const tagMatch = docXml.match(regex);
      if (!tagMatch) return '';
      return (tagMatch[1] !== undefined ? tagMatch[1] : tagMatch[2] || '').trim();
    };

    docs.push({
      title: getTagValue('bookname'),
      authors: getTagValue('authors'),
      publisher: getTagValue('publisher'),
      publicationYear: getTagValue('publication_year'),
      isbn13: getTagValue('isbn13'),
      bookImageURL: getTagValue('bookImageURL'),
      classNm: getTagValue('class_nm')
    });
  }

  return docs;
}

/**
 * data4library itemSrch API 호출 헬퍼
 */
async function fetchCandidateBooks({ kdc = '', pageSize = 30, pageNo = 1, keyword = '', startDt = '2023-01-01', endDt = '2024-12-31' } = {}) {
  if (!DATA4LIBRARY_AUTH_KEY || !DATA4LIBRARY_LIB_CODE) {
    throw new Error('DATA4LIBRARY_AUTH_KEY 또는 DATA4LIBRARY_LIB_CODE 환경변수가 설정되지 않았습니다.');
  }

  let apiUrl = `${DATA4LIBRARY_BASE_URL}/itemSrch?authKey=${DATA4LIBRARY_AUTH_KEY}&libCode=${DATA4LIBRARY_LIB_CODE}&startDt=${startDt}&endDt=${endDt}&pageSize=${pageSize}&pageNo=${pageNo}`;
  if (kdc) {
    apiUrl += `&kdc=${encodeURIComponent(kdc)}`;
  }
  if (keyword) {
    apiUrl += `&keyword=${encodeURIComponent(keyword)}`;
  }

  const response = await fetch(apiUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`도서관 API HTTP ${response.status}`);
  const xmlText = await response.text();

  if (xmlText.includes('<error>')) {
    throw new Error(`도서관 정보나루 API 오류: ${xmlText}`);
  }

  return parseLibraryXml(xmlText);
}

/**
 * GET /api/library/items
 * data4library itemSrch API 호출 및 XML -> JSON 변환
 */
app.get('/api/library/items', async (req, res) => {
  try {
    if (!DATA4LIBRARY_AUTH_KEY || !DATA4LIBRARY_LIB_CODE) {
      return res.status(500).json({
        error: 'DATA4LIBRARY_AUTH_KEY 또는 DATA4LIBRARY_LIB_CODE 환경변수가 설정되지 않았습니다.'
      });
    }

    const {
      startDt = '2023-01-01',
      endDt = '2024-12-31',
      pageSize = 30,
      pageNo = 1,
      keyword = '',
      kdc = ''
    } = req.query;

    const books = await fetchCandidateBooks({
      kdc,
      pageSize: parseInt(pageSize, 10) || 30,
      pageNo: parseInt(pageNo, 10) || 1,
      keyword,
      startDt,
      endDt
    });

    return res.json({
      success: true,
      count: books.length,
      kdc: kdc || '전체',
      books
    });
  } catch (error) {
    console.error('[API /api/library/items 에러]:', error.message);
    return res.status(500).json({
      error: '도서관 소장도서 목록을 가져오는 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * Gemini API 호출 헬퍼 (호환 모델 및 재시도 지원)
 */
async function callGemini(contents, systemInstruction, preferredModel = 'gemini-flash-latest') {
  if (!apiKey) {
    throw new Error('Gemini API 키가 서버 .env에 설정되어 있지 않습니다.');
  }

  const candidateModels = [
    preferredModel,
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.5-flash'
  ];
  const modelsToTry = [...new Set(candidateModels)];

  let lastError = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature: 0.7,
            topP: 0.95
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          const errMsg = data.error?.message || response.statusText || 'API 오류';

          if (response.status === 404 && (errMsg.includes('no longer available') || errMsg.includes('not found') || errMsg.includes('not supported'))) {
            console.warn(`[Gemini Model Fallback] ${model} 사용 불가 -> 다음 모델로 전환합니다.`);
            lastError = new Error(errMsg);
            break;
          }

          if (response.status === 503 || response.status === 429 || errMsg.includes('high demand') || errMsg.includes('Quota exceeded')) {
            console.warn(`[Gemini Retry/Fallback] ${model} 일시적 부하 또는 쿼터 제한 발생 (시도 ${attempt + 1}/2): ${errMsg}`);
            lastError = new Error(errMsg);
            if (attempt === 1) break; // 2번 실패 시 다음 모델로 전환
            await new Promise(r => setTimeout(r, 800));
            continue;
          }

          throw new Error(errMsg || `API 요청 실패 (${response.status})`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('Gemini로부터 유효한 응답 텍스트를 받지 못했습니다.');
        }

        return { text, modelUsed: model };
      } catch (err) {
        lastError = err;
        if (err.message && (err.message.includes('no longer available') || err.message.includes('high demand'))) {
          break;
        }
        throw err;
      }
    }
  }

  throw lastError || new Error('사용 가능한 Gemini 모델을 찾을 수 없습니다.');
}

/**
 * 응답 텍스트에서 JSON 및 TAO 구조 파싱
 */
function parseGeminiResponse(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  let message = rawText;
  let summary = null;
  let comprehensionCheck = null;
  let tao = {
    thoughtSummary: '사용자의 입력을 분석하여 질문 의도를 파악함.',
    action: 'askUser',
    observation: '사용자에게 응답 메시지를 전송함.'
  };

  let evidence = [];
  let suggestedQuestions = [];

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      message = parsed.message || parsed.summary || rawText;
      summary = parsed.summary || null;
      if (Array.isArray(parsed.evidence)) {
        evidence = parsed.evidence
          .map(e => typeof e === 'string' ? e.trim() : '')
          .filter(e => e.length > 0);
      }
      if (Array.isArray(parsed.suggestedQuestions)) {
        suggestedQuestions = parsed.suggestedQuestions
          .map(q => typeof q === 'string' ? q.trim() : '')
          .filter(q => q.length > 0)
          .slice(0, 3);
      }
      if (parsed.comprehensionCheck) {
        comprehensionCheck = {
          topic: parsed.comprehensionCheck.topic || '핵심 내용',
          result: parsed.comprehensionCheck.result || null,
          difficultPart: parsed.comprehensionCheck.difficultPart || null
        };
        if (!comprehensionCheck.result) {
          if (message.includes('✅') || message.includes('잘 이해')) {
            comprehensionCheck.result = '✅ 잘 이해했어요';
          } else if (message.includes('🟡') || message.includes('거의 이해')) {
            comprehensionCheck.result = '🟡 거의 이해했어요';
          } else {
            comprehensionCheck.result = '🔄 조금 더 살펴볼까요?';
          }
        }
      }
      if (parsed.tao) {
        tao = {
          thoughtSummary: parsed.tao.thoughtSummary || tao.thoughtSummary,
          action: parsed.tao.action || tao.action,
          observation: parsed.tao.observation || tao.observation
        };
      }
    }
  } catch (e) {
    // JSON 파싱 실패 시 텍스트 기반 폴백
  }

  // 메시지 텍스트 내 평가 태그 감지 및 보완
  if (!comprehensionCheck) {
    if (message.includes('✅ 잘 이해했어요')) {
      comprehensionCheck = { topic: '핵심 내용', result: '✅ 잘 이해했어요', difficultPart: null };
    } else if (message.includes('🟡 거의 이해했어요')) {
      comprehensionCheck = { topic: '핵심 내용', result: '🟡 거의 이해했어요', difficultPart: '세부 맥락 보완 필요' };
    } else if (message.includes('🔄 조금 더 살펴볼까요?')) {
      comprehensionCheck = { topic: '핵심 내용', result: '🔄 조금 더 살펴볼까요?', difficultPart: '개념 재확인 필요' };
    }
  }

  return {
    message,
    evidence,
    suggestedQuestions,
    summary,
    comprehensionCheck,
    tao
  };
}

/**
 * POST /api/chat
 * 사용자 메시지 수신 (텍스트 + 책 사진 멀티모달 + 설명 난이도 조절 지원)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], readingState = {}, image = null, explanationLevel = null } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '대화 메시지(messages) 목록이 필요합니다.' });
    }

    const systemPrompt = buildSystemPrompt(readingState, explanationLevel);

    // Gemini API 포맷으로 메시지 변환 (role: user / model)
    const contents = messages.map((msg, idx) => {
      const parts = [];

      // 마지막 사용자 메시지에 이미지가 첨부된 경우 멀티모달 파트 주입
      if (idx === messages.length - 1 && image && image.data) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType || 'image/jpeg',
            data: image.data
          }
        });
      }

      parts.push({ text: msg.content });

      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });

    // Gemini API는 마지막 턴이 model이면 에러가 발생하므로 마지막이 model인 경우 적절한 user 턴 추가
    if (contents.length > 0 && contents[contents.length - 1].role === 'model') {
      let promptText = '방금 설명한 내용을 더 쉽게 설명해줘.';
      if (explanationLevel === 'quiz_request') {
        promptText = '방금 설명한 내용을 바탕으로 내가 잘 이해했는지 확인할 수 있는 질문이나 퀴즈를 하나 내줘.';
      } else if (explanationLevel === 'more_easy') {
        promptText = '방금 설명한 내용을 더 쉬운 비유와 일상적인 예시로 다시 설명해줘.';
      } else if (explanationLevel === 'deep') {
        promptText = '방금 설명한 내용의 배경과 더 깊은 의미를 자세히 설명해줘.';
      }
      contents.push({
        role: 'user',
        parts: [{ text: promptText }]
      });
    }

    const preferredModel = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const { text, modelUsed } = await callGemini(contents, systemPrompt, preferredModel);
    const { message, evidence = [], suggestedQuestions = [], tao, comprehensionCheck } = parseGeminiResponse(text);

    const featureName = image ? '책 사진 분석' : (explanationLevel ? `설명 전환(${explanationLevel})` : '대화 응답');
    console.log(`[Gemini 호출 성공] 기능: ${featureName} | 사용 모델: ${modelUsed}`);

    const isQuizQuestion = explanationLevel === 'quiz_request' || (
      (message.includes('가볍게 한 가지') || message.includes('물어볼게') || message.includes('질문 하나') || message.includes('질문할게')) &&
      !message.includes('✅') && !message.includes('🟡') && !message.includes('🔄')
    );

    return res.json({
      message,
      evidence: isQuizQuestion ? [] : evidence,
      suggestedQuestions: isQuizQuestion ? [] : suggestedQuestions,
      tao,
      comprehensionCheck,
      isQuizQuestion,
      modelUsed,
      statePatch: {}
    });
  } catch (error) {
    console.error('[API /api/chat 에러]:', error.message);
    return res.status(500).json({
      error: 'AI 응답을 생성하는 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      details: error.message
    });
  }
});

/**
 * POST /api/summary
 * 대화 내용 기반 지금까지 읽은 내용 요약 생성
 */
app.post('/api/summary', async (req, res) => {
  try {
    const { messages = [], readingState = {} } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '요약할 대화 기록이 없습니다.' });
    }

    const summaryPrompt = buildSummaryPrompt(readingState);

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: '지금까지 우리가 대화에서 확인한 책 내용을 바탕으로 독서 요약을 작성해줘.' }]
    });

    const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const { text, modelUsed } = await callGemini(contents, summaryPrompt, preferredModel);
    const { summary, tao } = parseGeminiResponse(text);

    console.log(`[Gemini 호출 성공] 기능: 독서 요약 생성 | 사용 모델: ${modelUsed}`);

    return res.json({
      summary: summary || text,
      tao: tao || {
        thoughtSummary: '대화 기반 독서 요약 완료',
        action: 'makeReadingSummary',
        observation: '요약 내용 생성 완료'
      },
      modelUsed
    });
  } catch (error) {
    console.error('[API /api/summary 에러]:', error.message);
    return res.status(500).json({
      error: '독서 요약을 생성하는 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      details: error.message
    });
  }
});

/**
 * POST /api/reading-note
 * 대화 내용 및 ReadingState 기반 오늘의 독서노트 생성
 */
app.post('/api/reading-note', async (req, res) => {
  try {
    const { messages = [], readingState = {} } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '독서노트를 작성할 대화 기록이 없습니다.' });
    }

    const notePrompt = buildReadingNotePrompt(readingState);

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: '지금까지 대화에서 다룬 내용과 독서 상태를 바탕으로 주어진 형식에 맞추어 오늘의 독서노트를 작성해줘.' }]
    });

    const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const { text, modelUsed } = await callGemini(contents, notePrompt, preferredModel);

    let readingNote = text;
    let tao = {
      thoughtSummary: '대화와 독서상태를 바탕으로 사실에 근거하여 오늘의 독서노트 작성',
      action: 'makeReadingNote',
      observation: '오늘의 독서노트 작성 완료'
    };

    try {
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      const json = JSON.parse(cleaned.trim());
      if (json.readingNote) {
        readingNote = json.readingNote;
      }
      if (json.tao) {
        tao = json.tao;
      }
    } catch (e) {
      // 텍스트 폴백
    }

    console.log(`[Gemini 호출 성공] 기능: 오늘의 독서노트 생성 | 사용 모델: ${modelUsed}`);

    return res.json({
      readingNote,
      tao,
      modelUsed
    });
  } catch (error) {
    console.error('[API /api/reading-note 에러]:', error.message);
    return res.status(500).json({
      error: '독서노트를 생성하는 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      details: error.message
    });
  }
});

// Separate recommendation gateway keeps reading/photo/summary model behavior unchanged.
const recommendationEvent = event => console.log('[Book recommendation]', JSON.stringify(event));
const recommendBooks = createRecommendationService({
  generate: createGeminiRecommendationClient({
    apiKey,
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    searchModel: process.env.GEMINI_SEARCH_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    onEvent: recommendationEvent
  }),
  fetchCandidates: fetchCandidateBooks,
  searchTitle: async title => {
    if (!DATA4LIBRARY_AUTH_KEY) throw new Error('Library search is not configured');
    // srchBooks is the actual title/keyword search API; itemSrch is a holdings list.
    const url = new URL(`${DATA4LIBRARY_BASE_URL}/srchBooks`);
    url.search = new URLSearchParams({ authKey: DATA4LIBRARY_AUTH_KEY, title, pageNo: '1', pageSize: '30' });
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Library title search HTTP ${response.status}`);
    const xml = await response.text();
    if (xml.includes('<error>')) throw new Error('Library title search error');
    return parseBookSearchXml(xml);
  },
  onEvent: recommendationEvent
});

app.post('/api/recommend-books', async (req, res) => {
  const { userMessage, userGrade, userInterests, chatHistory } = req.body;
  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: '사용자 메시지가 필요합니다.' });
  }
  const result = await recommendBooks({
    userMessage: userMessage.trim(),
    userGrade: typeof userGrade === 'string' ? userGrade : '중1',
    userInterests: Array.isArray(userInterests) ? userInterests : [],
    chatHistory: Array.isArray(chatHistory) ? chatHistory : []
  });
  console.log('[Book recommendation result]', JSON.stringify({
    count: result.books.length, sourceTypes: result.books.map(b => b.sourceType), search: result.search
  }));
  return res.json(result);
});

app.listen(PORT, () => {
  console.log(`[Reading Agent Server] 포트 ${PORT}에서 서버가 실행 중입니다.`);
  console.log(`[API Key 상태]: ${apiKey ? '정상 등록됨' : '미등록 (확인 필요)'}`);
});
