import { stateManager } from './state.js';
import { renderHeader } from './components/Header.js';
import { renderOnboardingModal } from './components/OnboardingModal.js';
import { renderBookInputPanel } from './components/BookInputPanel.js';
import { renderChatPanel } from './components/ChatPanel.js';
import { renderReadingRecordPanel } from './components/ReadingRecordPanel.js';

let isLoading = false;
let isSummaryLoading = false;
let isReadingNoteLoading = false;
let isModalOpen = false;

// DOM 엘리먼트 캐시
const headerEl = document.getElementById('header-container');
const panelBookEl = document.getElementById('panel-book');
const panelChatEl = document.getElementById('panel-chat');
const panelRecordEl = document.getElementById('panel-record');
const modalContainerEl = document.getElementById('onboarding-modal-container');
const alertBannerEl = document.getElementById('alert-banner');

/**
 * 에러 배너 표시 헬퍼
 */
function showAlert(message) {
  if (!alertBannerEl) return;
  alertBannerEl.innerHTML = `
    <span>${message}</span>
    <button id="btn-close-alert" style="background: none; border: none; cursor: pointer; font-size: 16px; color: inherit;">✕</button>
  `;
  alertBannerEl.classList.remove('hidden');

  const closeBtn = alertBannerEl.querySelector('#btn-close-alert');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      alertBannerEl.classList.add('hidden');
    });
  }
}

/**
 * 전체 화면 리렌더링
 */
function renderApp() {
  const state = stateManager.getState();

  // 1. 헤더 렌더링
  renderHeader(headerEl, state, {
    onOpenGradeModal: () => {
      isModalOpen = true;
      renderApp();
    },
    onResetSession: () => {
      stateManager.resetSession();
      renderApp();
    },
    onTitleChange: (title) => {
      stateManager.setBookTitle(title);
    }
  });

  // 2. 패널 1: 책 내용 (텍스트 및 사진 업로드)
  renderBookInputPanel(panelBookEl, {
    onSendToChat: (text) => {
      handleSendMessage(text);
      switchMobileTab('panel-chat');
    },
    onSendImage: ({ text, image }) => {
      handleSendImageMessage({ text, image });
      switchMobileTab('panel-chat');
    }
  });

  // 3. 패널 2: AI 대화 (소크라테스 대화 + 설명 단계 버튼 + 이해 확인 버튼)
  renderChatPanel(panelChatEl, {
    state,
    isLoading,
    onSendMessage: (text) => {
      handleSendMessage(text);
    },
    onExplainLevel: (level) => {
      handleExplainLevel(level);
    },
    onCheckUnderstanding: () => {
      handleCheckUnderstanding();
    }
  });

  // 4. 패널 3: 독서 기록 및 TAO (요약 생성, 독서노트 업데이트, 이해도 지도, TAO 로그)
  renderReadingRecordPanel(panelRecordEl, {
    state,
    isSummaryLoading,
    onGenerateSummary: () => {
      handleGenerateSummary();
    },
    isReadingNoteLoading,
    onGenerateReadingNote: () => {
      handleGenerateReadingNote();
    },
    onRetryExplain: (topic) => {
      handleSendMessage(`이 부분 다시 설명해줘: ${topic}`);
      switchMobileTab('panel-chat');
    }
  });

  // 5. 온보딩 모달 (학년 미설정 또는 사용자가 직접 열었을 때)
  if (!state.student.grade || isModalOpen) {
    renderOnboardingModal(modalContainerEl, {
      currentGrade: state.student.grade,
      onSelectGrade: (grade) => {
        stateManager.setGrade(grade);
        isModalOpen = false;

        if (state.session.recentMessages.length === 0) {
          stateManager.addMessage(
            'assistant',
            `안녕! ${grade} 독서 이해 도우미야. 책 사진을 찍어 보여주거나 어려운 문장을 채팅창에 적어주면, 함께 생각하며 이해하도록 도와줄게!`
          );
        }
        renderApp();
      },
      onClose: () => {
        isModalOpen = false;
        renderApp();
      }
    });
  } else {
    modalContainerEl.innerHTML = '';
  }
}

/**
 * 일반 텍스트 메시지 전송
 */
async function handleSendMessage(content) {
  if (isLoading) return;

  stateManager.addMessage('user', content);
  isLoading = true;
  renderApp();

  try {
    const state = stateManager.getState();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.session.recentMessages,
        readingState: {
          student: state.student,
          book: state.book,
          session: {
            difficultPoints: state.session.difficultPoints,
            understoodPoints: state.session.understoodPoints,
            comprehensionChecks: state.session.comprehensionChecks
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || '답변 요청에 실패했습니다.');
    }

    if (data.message) {
      const msgText = data.message;
      const isCompleteFeedback = msgText.includes('✅ 잘 이해했어요') || msgText.includes('🟡 거의 이해했어요');
      const isRetryFeedback = msgText.includes('🔄 조금 더 살펴볼까요?');
      const isQuizQuestion = Boolean(data.isQuizQuestion) || (
        (msgText.includes('물어볼게') || msgText.includes('질문 하나') || msgText.includes('가볍게 한 가지')) &&
        !isCompleteFeedback && !isRetryFeedback
      );

      const evidence = Array.isArray(data.evidence) ? data.evidence : [];

      if (isCompleteFeedback) {
        // 퀴즈 완료 -> 퀴즈 종료, 설명 버튼 복원
        stateManager.setQuizActive(false);
        stateManager.addMessage('assistant', msgText, { isExplanation: true, isQuizQuestion: false, evidence });
      } else if (isRetryFeedback || isQuizQuestion) {
        // 퀴즈 질문 또는 재시도 힌트 -> 버튼 숨김 유지
        stateManager.setQuizActive(true);
        stateManager.addMessage('assistant', msgText, { isExplanation: false, isQuizQuestion: true, evidence: [] });
      } else {
        // 일반 대화 또는 설명
        stateManager.setQuizActive(false);
        stateManager.addMessage('assistant', msgText, { isExplanation: true, isQuizQuestion: false, evidence });
      }

      if (Array.isArray(data.suggestedQuestions) && data.suggestedQuestions.length > 0) {
        stateManager.setSuggestedQuestions(data.suggestedQuestions);
      } else if (isQuizQuestion) {
        stateManager.setSuggestedQuestions([]);
      }
    }
    if (data.tao) {
      stateManager.addTaoLog(data.tao);
    }
    if (data.comprehensionCheck) {
      stateManager.addComprehensionCheck(data.comprehensionCheck);
    }
  } catch (err) {
    console.error('채팅 요청 에러:', err);
    showAlert('일시적으로 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.');
    stateManager.addMessage(
      'assistant',
      '미안해, 답변을 생성하는 중에 일시적인 오류가 발생했어. 잠시 후 다시 질문해 줄래?'
    );
  } finally {
    isLoading = false;
    renderApp();
  }
}

/**
 * 책 사진과 함께 메시지 전송 (멀티모달)
 */
async function handleSendImageMessage({ text, image }) {
  if (isLoading) return;

  // 유저 메시지에 이미지 메타데이터 첨부하여 저장
  stateManager.addMessage('user', text, { image });
  isLoading = true;
  renderApp();

  try {
    const state = stateManager.getState();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.session.recentMessages,
        readingState: {
          student: state.student,
          book: state.book,
          session: {
            difficultPoints: state.session.difficultPoints,
            understoodPoints: state.session.understoodPoints
          }
        },
        image: image // { data: base64, mimeType }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || '사진 분석 요청에 실패했습니다.');
    }

    if (data.message) {
      stateManager.setQuizActive(false);
      // 사진 등록 직후 후보 좁히기 질문은 버튼 비활성화
      const isIntroQuestion = data.message.includes('어느 부분이') || data.message.includes('이해하기 어려워');
      const evidence = !isIntroQuestion && Array.isArray(data.evidence) ? data.evidence : [];
      stateManager.addMessage('assistant', data.message, {
        isExplanation: !isIntroQuestion,
        isQuizQuestion: false,
        evidence
      });

      if (Array.isArray(data.suggestedQuestions) && data.suggestedQuestions.length > 0) {
        stateManager.setSuggestedQuestions(data.suggestedQuestions);
      }
    }
    if (data.tao) {
      stateManager.addTaoLog(data.tao);
    }
  } catch (err) {
    console.error('사진 분석 요청 에러:', err);
    showAlert('책 사진을 분석하는 중 문제가 발생했습니다. 사진이 너무 크거나 흐리지 않은지 확인해 주세요.');
    stateManager.addMessage(
      'assistant',
      '사진을 분석하는 중에 오류가 생겼어. 사진 속 글씨가 선명한지 확인하고 다시 올려줄래?'
    );
  } finally {
    isLoading = false;
    renderApp();
  }
}

/**
 * 설명 난이도 재조정 ([더 간단히] / [조금 더 자세히])
 */
async function handleExplainLevel(level) {
  if (isLoading) return;

  const promptText = level === 'simple'
    ? '방금 설명해 준 내용을 2~4문장으로 핵심만 더 간단하게 설명해줘.'
    : '방금 설명해 준 내용의 앞뒤 문맥과 인물 행동, 쉬운 예시를 덧붙여 조금 더 자세히 설명해줘.';

  stateManager.addMessage('user', promptText);
  isLoading = true;
  renderApp();

  try {
    const state = stateManager.getState();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.session.recentMessages,
        readingState: {
          student: state.student,
          book: state.book,
          session: {
            difficultPoints: state.session.difficultPoints,
            understoodPoints: state.session.understoodPoints
          }
        },
        explanationLevel: level
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || '설명 변경 요청에 실패했습니다.');
    }

    if (data.message) {
      stateManager.setQuizActive(false);
      const evidence = Array.isArray(data.evidence) ? data.evidence : [];
      stateManager.addMessage('assistant', data.message, { isExplanation: true, isQuizQuestion: false, evidence });

      if (Array.isArray(data.suggestedQuestions) && data.suggestedQuestions.length > 0) {
        stateManager.setSuggestedQuestions(data.suggestedQuestions);
      }
    }
    if (data.tao) {
      stateManager.addTaoLog(data.tao);
    }
    if (data.comprehensionCheck) {
      stateManager.addComprehensionCheck(data.comprehensionCheck);
    }
  } catch (err) {
    console.error('설명 난이도 요청 에러:', err);
    showAlert(`설명 변환 실패: ${err.message}`);
  } finally {
    isLoading = false;
    renderApp();
  }
}

/**
 * 이해했는지 확인 질문 요청
 */
async function handleCheckUnderstanding() {
  if (isLoading) return;

  const promptText = '방금 설명해 준 내용을 내가 잘 이해했는지 확인해 볼 수 있게 짧은 질문 하나만 내줘.';
  stateManager.addMessage('user', promptText);
  stateManager.setQuizActive(true);
  stateManager.setSuggestedQuestions([]);
  isLoading = true;
  renderApp();

  try {
    const state = stateManager.getState();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.session.recentMessages,
        readingState: {
          student: state.student,
          book: state.book,
          session: {
            difficultPoints: state.session.difficultPoints,
            understoodPoints: state.session.understoodPoints,
            comprehensionChecks: state.session.comprehensionChecks
          }
        },
        explanationLevel: 'quiz_request'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || '이해 확인 질문 요청에 실패했습니다.');
    }

    if (data.message) {
      stateManager.setQuizActive(true);
      stateManager.addMessage('assistant', data.message, {
        isExplanation: false,
        isQuizQuestion: true
      });
    }
    if (data.tao) {
      stateManager.addTaoLog(data.tao);
    }
    if (data.comprehensionCheck) {
      stateManager.addComprehensionCheck(data.comprehensionCheck);
    }
  } catch (err) {
    console.error('이해 확인 질문 에러:', err);
    showAlert('이해 확인 질문을 생성하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    isLoading = false;
    renderApp();
  }
}

/**
 * 지금까지 읽은 내용 요약 생성
 */
async function handleGenerateSummary() {
  if (isSummaryLoading) return;

  const state = stateManager.getState();
  if (state.session.recentMessages.length === 0) {
    alert('먼저 책 내용에 대해 대화를 나눈 뒤 요약을 생성해 주세요.');
    return;
  }

  isSummaryLoading = true;
  renderApp();

  try {
    const response = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.session.recentMessages,
        readingState: {
          student: state.student,
          book: state.book
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || '요약 생성 요청에 실패했습니다.');
    }

    if (data.summary) {
      stateManager.setSummary(data.summary);
    }
    if (data.tao) {
      stateManager.addTaoLog(data.tao);
    }
  } catch (err) {
    console.error('요약 생성 에러:', err);
    showAlert('독서 요약을 생성하는 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    isSummaryLoading = false;
    renderApp();
  }
}

/**
 * 대화 내용 및 ReadingState 기반 오늘의 독서노트 생성
 */
async function handleGenerateReadingNote() {
  if (isReadingNoteLoading) return;

  const state = stateManager.getState();
  if (!state.session.recentMessages || state.session.recentMessages.length === 0) {
    showAlert('먼저 책 내용에 대해 질문하거나 대화를 나눈 뒤 독서노트를 업데이트해 주세요.');
    return;
  }

  isReadingNoteLoading = true;
  renderApp();

  try {
    const response = await fetch('/api/reading-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.session.recentMessages,
        readingState: {
          student: state.student,
          book: state.book,
          session: {
            difficultPoints: state.session.difficultPoints,
            understoodPoints: state.session.understoodPoints,
            comprehensionChecks: state.session.comprehensionChecks
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || '독서노트 생성 요청에 실패했습니다.');
    }

    if (data.readingNote) {
      stateManager.setReadingNote(data.readingNote);
    }
    if (data.tao) {
      stateManager.addTaoLog(data.tao);
    }
  } catch (err) {
    console.error('독서노트 생성 에러:', err);
    showAlert(`독서노트 생성 중 오류: ${err.message}`);
  } finally {
    isReadingNoteLoading = false;
    renderApp();
  }
}

/**
 * 모바일 탭 전환
 */
function switchMobileTab(targetId) {
  const tabs = document.querySelectorAll('.mobile-tab-btn');
  const panels = document.querySelectorAll('.panel-section');

  tabs.forEach(tab => {
    if (tab.getAttribute('data-target') === targetId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  panels.forEach(panel => {
    if (panel.id === targetId) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });
}

function initMobileNav() {
  const nav = document.getElementById('mobile-nav');
  if (!nav) return;
  nav.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      switchMobileTab(target);
    });
  });
}

// 앱 시작
window.addEventListener('DOMContentLoaded', () => {
  // [이 책 읽기] 연동: URL 파라미터로 전달된 책 제목이 있는 경우 즉시 반영
  const urlParams = new URLSearchParams(window.location.search);
  const titleParam = urlParams.get('title');
  if (titleParam) {
    stateManager.setBookTitle(decodeURIComponent(titleParam));
  }
  initMobileNav();
  renderApp();
});

// 상태 변경 시 리렌더링
stateManager.subscribe(() => {
  renderApp();
});
