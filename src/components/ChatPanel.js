import { formatText } from '../formatText.js';

export function renderChatPanel(container, { state, onSendMessage, onExplainLevel, onCheckUnderstanding, isLoading }) {
  const messages = state.session.recentMessages;

  container.innerHTML = `
    <div class="chat-container">
      <div class="panel-header">
        <div class="panel-title">
          <span>함께 읽기</span>
        </div>
      </div>

      <div class="chat-messages" id="chat-messages-box" role="log" aria-live="polite">
        ${messages.length === 0 ? `
          <div style="color: var(--text-muted); font-size: 14px;">
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">어떤 부분이 궁금한가요?</div>
            <p>책 사진이나 어려운 문장을 보내주세요.<br/>함께 읽으며 하나씩 알아갈게요.</p>
          </div>
        ` : ''}

        ${messages.map((msg, idx) => {
          const showButtons = shouldShowActionButtons(msg, idx, messages, isLoading, state);
          return `
            <div class="chat-bubble ${msg.role}">
              <div class="chat-content">
                ${msg.image?.data ? `
                  <div style="margin-bottom: 8px;">
                    <img
                      src="data:${msg.image.mimeType || 'image/jpeg'};base64,${msg.image.data}"
                      alt="첨부된 책 사진"
                      style="max-width: 220px; max-height: 180px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); display: block;"
                    />
                  </div>
                ` : ''}
                <div class="markdown-content">${formatText(msg.content)}</div>

                ${msg.role === 'assistant' && Array.isArray(msg.evidence) && msg.evidence.length > 0 ? `
                  <div class="evidence-box">
                    <div class="evidence-header">
                      <span>책에서 본 근거</span>
                    </div>
                    <div class="evidence-list">
                      ${msg.evidence.map(item => `
                        <div class="evidence-item">&ldquo;${escapeHtml(item.replace(/^["'“”]+|["'“”]+$/g, '').trim())}&rdquo;</div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

                ${showButtons ? `
                  <div class="explanation-btn-group" style="display: flex; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-color); flex-wrap: wrap;">
                    <button class="btn-explain-level btn-level-simple" data-level="simple" title="핵심만 2~4문장으로 간단히 설명">
                      더 쉽게
                    </button>
                    <button class="btn-explain-level btn-level-detailed" data-level="detailed" title="앞뒤 문맥과 예시를 덧붙여 자세히 설명">
                      더 자세히
                    </button>
                    <button class="btn-explain-level btn-level-quiz" title="내가 제대로 이해했는지 확인 질문 받기">
                      이해 확인
                    </button>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}

        ${isLoading ? `
          <div class="chat-bubble assistant">
            <div class="chat-content">
              <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- AI 추천 질문 및 빠른 응답 칩 영역 (채팅창 맨 아래) -->
      ${state?.session?.suggestedQuestions && state.session.suggestedQuestions.length > 0 ? `
        <div class="suggested-questions-area">
          <div class="suggested-header">
            <span>이런 것도 물어볼 수 있어요</span>
          </div>
          <div class="suggested-chips-list">
            ${state.session.suggestedQuestions.map(q => `
              <button class="suggested-question-btn" data-text="${escapeHtml(q)}" ${isLoading ? 'disabled' : ''}>
                ${escapeHtml(q)}
              </button>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="quick-chips-area">
          <button class="quick-chip-btn" data-text="그냥 바로 설명해줘." ${isLoading ? 'disabled' : ''}>
            바로 설명해줘
          </button>
          <button class="quick-chip-btn" data-text="단어 뜻이 잘 이해가 안 돼." ${isLoading ? 'disabled' : ''}>
            단어 뜻이 궁금해
          </button>
          <button class="quick-chip-btn" data-text="인물이 왜 이렇게 행동했는지 모르겠어." ${isLoading ? 'disabled' : ''}>
            인물은 왜 그랬을까?
          </button>
        </div>
      `}

      <form id="chat-form" class="chat-input-area">
        <input
          type="text"
          id="chat-input-text"
          aria-label="궁금한 점 입력"
          class="chat-input"
          placeholder="${isLoading ? '답변을 준비하고 있어요…' : '궁금한 점을 적어주세요'}"
          autocomplete="off"
          ${isLoading ? 'disabled' : ''}
        />
        <button type="submit" class="btn-chat-send" ${isLoading ? 'disabled' : ''}>
          보내기
        </button>
      </form>
    </div>
  `;

  // 스크롤 맨 아래로 이동
  const msgBox = container.querySelector('#chat-messages-box');
  if (msgBox) {
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  // 메시지 전송 처리
  const form = container.querySelector('#chat-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = container.querySelector('#chat-input-text');
    const text = input.value.trim();
    if (!text || isLoading) return;
    input.value = '';
    onSendMessage(text);
  });

  // AI 추천 질문 클릭
  container.querySelectorAll('.suggested-question-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-text');
      if (text && !isLoading) {
        onSendMessage(text);
      }
    });
  });

  // 빠른 응답 칩 클릭
  container.querySelectorAll('.quick-chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.getAttribute('data-text');
      if (text && !isLoading) {
        onSendMessage(text);
      }
    });
  });

  // [더 간단히] / [조금 더 자세히] 버튼 클릭
  container.querySelectorAll('.btn-explain-level[data-level]').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.getAttribute('data-level');
      if (level && !isLoading) {
        onExplainLevel(level);
      }
    });
  });

  // [이해 확인] 버튼 클릭
  container.querySelectorAll('.btn-level-quiz').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isLoading && onCheckUnderstanding) {
        onCheckUnderstanding();
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 퀴즈 출제 중에는 3개 버튼([더 간단히], [조금 더 자세히], [이해 확인])을 숨기고,
 * 퀴즈가 끝나거나 일반 설명일 때만 표시하는 판단 함수
 */
function shouldShowActionButtons(msg, idx, messages, isLoading, state = null) {
  if (msg.role !== 'assistant' || isLoading) return false;

  // 1. 가장 최신의 assistant 메시지에만 액션 버튼 표시 (대화 기록 전반에 중복 노출 방지)
  const lastAssistantIdx = messages.reduce((last, m, i) => m.role === 'assistant' ? i : last, -1);
  if (idx !== lastAssistantIdx) return false;

  // 2. 초기 인사말인 경우 숨김
  if (msg.content.startsWith('안녕!') && msg.content.includes('도우미야')) {
    return false;
  }

  // 3. 사진 업로드 후 질문 좁히기 단계 ("어느 부분이 가장 이해하기 어려워?") 숨김
  if (msg.content.includes('어느 부분이 가장 이해하기 어려워') || msg.content.includes('후보를 좁혀')) {
    return false;
  }

  // 4. 퀴즈 평가 완료 메시지 (✅ 잘 이해했어요 / 🟡 거의 이해했어요)인 경우 버튼 복원 표시
  const isQuizFinished = (
    msg.content.includes('✅ 잘 이해했어요') ||
    msg.content.includes('🟡 거의 이해했어요')
  );
  if (isQuizFinished) {
    return true;
  }

  // 5. 퀴즈 재시도 힌트(🔄)가 포함되어 아직 퀴즈 진행 중인 경우 숨김
  if (msg.content.includes('🔄 조금 더 살펴볼까요?') || msg.content.includes('🔄')) {
    return false;
  }

  // 6. 명시적으로 퀴즈 진행 중(state.session.isQuizActive)이거나 퀴즈 질문(msg.isQuizQuestion)인 경우 숨김
  if (state?.session?.isQuizActive || msg.isQuizQuestion) {
    return false;
  }

  // 7. 퀴즈 출제 멘트가 포함된 질문 메시지인 경우 숨김
  const isQuizQuestionText = (
    msg.content.includes('물어볼게') ||
    msg.content.includes('가볍게 한 가지만') ||
    msg.content.includes('질문 하나') ||
    msg.content.includes('질문할게') ||
    msg.content.includes('생각해볼까?') ||
    msg.content.includes('처지 때문이었을까?') ||
    msg.content.includes('부담 때문이었을까?') ||
    msg.content.includes('이유는 무엇일까?')
  );
  if (isQuizQuestionText) {
    return false;
  }

  // 8. 직전 유저 메시지가 퀴즈 출제 요청인 경우 숨김
  const prevMsg = idx > 0 ? messages[idx - 1] : null;
  if (prevMsg && prevMsg.role === 'user' && (
    prevMsg.content.includes('확인해 볼 수 있게 짧은 질문') ||
    prevMsg.content.includes('이해했는지 확인') ||
    prevMsg.content.includes('질문 하나만 내줘') ||
    prevMsg.content.includes('퀴즈')
  )) {
    return false;
  }

  // 9. 설명이 아닌 것으로 명시된 경우(isExplanation: false) 숨김
  if (msg.isExplanation === false) {
    return false;
  }

  return true;
}
