import { formatText } from '../formatText.js';

let currentRecordTab = 'summary';

export function renderReadingRecordPanel(container, {
  state,
  onGenerateSummary,
  isSummaryLoading,
  onGenerateReadingNote,
  isReadingNoteLoading,
  onRetryExplain
}) {
  let activeTab = currentRecordTab;

  function update() {
    container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">
          <span>독서 기록</span>
        </div>
      </div>

      <div class="panel-body">
        <div class="record-tabs">
          <button class="record-tab-btn ${activeTab === 'summary' ? 'active' : ''}" data-tab="summary">
            요약
          </button>
          <button class="record-tab-btn ${activeTab === 'reading-note' ? 'active' : ''}" data-tab="reading-note">
            독서노트
          </button>
          <button class="record-tab-btn ${activeTab === 'map' ? 'active' : ''}" data-tab="map">
            이해도
          </button>
        </div>

        ${activeTab === 'summary' ? renderSummaryTab(state.session.summary, isSummaryLoading) : ''}
        ${activeTab === 'reading-note' ? renderReadingNoteTab(state.session.readingNote, isReadingNoteLoading) : ''}
        ${activeTab === 'map' ? renderUnderstandingMapTab(state.session) : ''}
      </div>
    `;

    // 탭 전환 이벤트
    container.querySelectorAll('.record-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentRecordTab = btn.getAttribute('data-tab');
        activeTab = currentRecordTab;
        update();
      });
    });

    // 요약 버튼 이벤트
    const summaryBtn = container.querySelector('#btn-generate-summary');
    if (summaryBtn) {
      summaryBtn.addEventListener('click', () => {
        if (!isSummaryLoading && onGenerateSummary) {
          onGenerateSummary();
        }
      });
    }

    // 독서노트 업데이트 버튼 이벤트
    const noteBtn = container.querySelector('#btn-update-reading-note');
    if (noteBtn) {
      noteBtn.addEventListener('click', () => {
        if (!isReadingNoteLoading && onGenerateReadingNote) {
          onGenerateReadingNote();
        }
      });
    }

    // 이해도 지도: 다시 설명받기 버튼 이벤트
    container.querySelectorAll('.btn-retry-explain').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const topic = btn.getAttribute('data-topic');
        if (topic && onRetryExplain) {
          onRetryExplain(topic);
        }
      });
    });

    // 이해도 지도: 카드 클릭 시 다시 설명받기 버튼 토글/활성화
    container.querySelectorAll('.map-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const isSelected = card.classList.contains('selected');
        container.querySelectorAll('.map-item-card').forEach(c => c.classList.remove('selected'));
        if (!isSelected) {
          card.classList.add('selected');
        }
      });
    });
  }

  update();
}

function renderSummaryTab(summary, isSummaryLoading) {
  return `
    <div style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
      <button
        id="btn-generate-summary"
        class="btn-send-book"
        ${isSummaryLoading ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}

      >
        ${isSummaryLoading ? '요약하는 중…' : '요약 만들기'}
      </button>

      ${isSummaryLoading ? `
        <div class="phase-placeholder" style="margin-top: 10px;">
          <div style="font-weight: 600; color: var(--text-primary); margin-top: 4px;">대화에서 확인된 내용을 정리하고 있어요</div>
          <p style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">
            함께 읽고 이야기한 내용을 모으고 있어요.
          </p>
        </div>
      ` : summary ? `
        <div class="summary-result-card markdown-content" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); line-height: 1.7; font-size: 13.5px; white-space: pre-wrap; color: var(--text-primary);">
${formatText(summary)}
        </div>
        <div style="font-size: 11px; color: var(--text-muted); text-align: right;">
          이 브라우저에 자동으로 저장돼요.
        </div>
      ` : `
        <div class="phase-placeholder" style="margin-top: 10px;">
          <div style="font-weight: 600; color: var(--text-primary);">함께 읽은 내용을 한눈에</div>
          <p style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">
            책에 대해 대화를 나눈 뒤 요약을 만들어 보세요.
          </p>
        </div>
      `}
    </div>
  `;
}

function renderReadingNoteTab(note, isReadingNoteLoading) {
  return `
    <div style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
      <button
        id="btn-update-reading-note"
        class="btn-send-book"
        ${isReadingNoteLoading ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
        style="background: var(--primary);"
      >
        ${isReadingNoteLoading ? '독서노트 작성 중…' : '독서노트 업데이트'}
      </button>

      ${isReadingNoteLoading ? `
        <div class="phase-placeholder" style="margin-top: 10px;">
          <div style="font-weight: 600; color: var(--text-primary); margin-top: 4px;">오늘의 독서노트를 정리하고 있어요</div>
          <p style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">
            나눈 이야기와 이해한 내용을 기록하고 있어요.
          </p>
        </div>
      ` : note ? `
        ${renderFormattedReadingNote(note)}
        <div style="font-size: 11px; color: var(--text-muted); text-align: right;">
          이 브라우저에 자동으로 저장돼요.
        </div>
      ` : `
        <div class="phase-placeholder" style="margin-top: 10px;">
          <div style="font-weight: 600; color: var(--text-primary);">오늘의 생각을 남겨보세요</div>
          <p style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">
            대화를 나누고 독서노트를 업데이트해 보세요.
          </p>
        </div>
      `}
    </div>
  `;
}

function renderFormattedReadingNote(note) {
  if (!note) return '';

  const lines = note.split('\n');
  let title = '오늘의 독서노트';
  const sections = [];
  let currentSec = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('📖')) {
      title = trimmed;
    } else if (trimmed.startsWith('### ')) {
      if (currentSec) sections.push(currentSec);
      currentSec = {
        title: trimmed.replace(/^###\s*/, ''),
        content: []
      };
    } else if (currentSec) {
      if (trimmed) currentSec.content.push(trimmed);
    }
  }
  if (currentSec) sections.push(currentSec);

  if (sections.length === 0) {
    return `
      <div class="summary-result-card markdown-content" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); line-height: 1.7; font-size: 13.5px; white-space: pre-wrap; color: var(--text-primary);">
${formatText(note)}
      </div>
    `;
  }


  return `
    <div class="reading-note-card" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 12px;">
      <div style="font-weight: 600; font-size: 15px; color: var(--text-primary); border-bottom: 2px solid var(--primary); padding-bottom: 8px;">
        ${formatText(title)}
      </div>
      ${sections.map(sec => {
        const bodyText = sec.content.join('\n');
        const isNotDiscussed = bodyText.includes('아직 이야기하지 않았어요') || bodyText.includes('현재 대화에서는 확인되지 않았어요');
        return `
          <div class="note-section-block" style="background: var(--bg-subtle); border-radius: var(--radius-sm); padding: 10px 12px; border: 1px solid rgba(0,0,0,0.05);">
            <div style="font-weight: 600; font-size: 12.5px; color: var(--primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <div class="markdown-content">${formatText(sec.title)}</div>
            </div>
            <div class="markdown-content" style="font-size: 13px; color: ${isNotDiscussed ? 'var(--text-muted)' : 'var(--text-primary)'}; line-height: 1.6; white-space: pre-wrap;">
${formatText(bodyText || '아직 이야기하지 않았어요')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderUnderstandingMapTab(session) {
  const { difficult, almost, understood } = getUnderstandingData(session);
  const totalCount = difficult.length + almost.length + understood.length;

  if (totalCount === 0) {
    return `
      <div class="phase-placeholder" style="margin-top: 20px;">
        <div style="font-weight: 600; color: var(--text-primary); margin-top: 8px; font-size: 14px;">
          아직 확인한 내용이 없어요
        </div>
        <p style="color: var(--text-secondary); font-size: 12px; margin-top: 6px; line-height: 1.6;">
          대화 아래 ‘이해 확인’을 눌러보세요.<br>
          이해한 내용과 더 살펴볼 내용을 정리해 드려요.
        </p>
      </div>
    `;
  }

  return `
    <div class="understanding-map-container">
      <div class="map-header">
        <div class="map-board-title">
          <span>나의 이해도</span>
        </div>
        <div class="map-board-desc">
          더 살펴보고 싶은 내용을 다시 물어보세요.
        </div>
      </div>

      <!-- 1. 아직 어려워요 (RED) -->
      <div class="map-section section-difficult">
        <div class="map-section-header">
          <div class="map-badge-title">
            <span class="status-dot dot-difficult"></span>
            <span class="status-label label-difficult">어려움</span>
          </div>
          <span class="status-count count-difficult">${difficult.length}</span>
        </div>
        ${difficult.length === 0 ? `
          <div class="map-empty-sub">아직 기록된 내용이 없어요</div>
        ` : `
          <div class="map-item-list">
            ${difficult.map(item => renderUnderstandingItemCard(item, 'difficult')).join('')}
          </div>
        `}
      </div>

      <!-- 2. 거의 이해했어요 (AMBER) -->
      <div class="map-section section-almost">
        <div class="map-section-header">
          <div class="map-badge-title">
            <span class="status-dot dot-almost"></span>
            <span class="status-label label-almost">조금 더 보기</span>
          </div>
          <span class="status-count count-almost">${almost.length}</span>
        </div>
        ${almost.length === 0 ? `
          <div class="map-empty-sub">이 단계에 머무른 내용이 없어요</div>
        ` : `
          <div class="map-item-list">
            ${almost.map(item => renderUnderstandingItemCard(item, 'almost')).join('')}
          </div>
        `}
      </div>

      <!-- 3. 이해했어요 (GREEN) -->
      <div class="map-section section-understood">
        <div class="map-section-header">
          <div class="map-badge-title">
            <span class="status-dot dot-understood"></span>
            <span class="status-label label-understood">이해함</span>
          </div>
          <span class="status-count count-understood">${understood.length}</span>
        </div>
        ${understood.length === 0 ? `
          <div class="map-empty-sub">퀴즈를 풀고 완전히 이해한 항목이 여기에 표시됩니다</div>
        ` : `
          <div class="map-item-list">
            ${understood.map(item => renderUnderstandingItemCard(item, 'understood')).join('')}
          </div>
        `}
      </div>

      <div class="map-footer">
        이 브라우저에 자동으로 저장돼요.
      </div>
    </div>
  `;
}

function renderUnderstandingItemCard(topic, statusType) {
  return `
    <div class="map-item-card card-${statusType}" data-topic="${escapeHtml(topic)}">
      <div class="map-card-main">
        <span class="item-dot dot-${statusType}"></span>
        <span class="item-text">${escapeHtml(topic)}</span>
      </div>
      <div class="map-card-actions">
        <button class="btn-retry-explain btn-retry-${statusType}" data-topic="${escapeHtml(topic)}">
          <span>다시 설명받기</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Single Source of Truth 방식으로 최종 이해도 상태 확정
 * 
 * 규칙:
 * 1. 각 주제는 반드시 difficult / almost / understood 중 단 하나의 최종 상태만 가진다.
 * 2. comprehensionChecks의 가장 최근 결과가 최우선 기준이다.
 * 3. difficult -> understood 가 되면 이전 상태(difficult)에서는 완전히 제거된다.
 * 4. 세 상태 영역 간 중복 노출을 100% 원천 차단한다.
 */
function getUnderstandingData(session) {
  if (!session) return { difficult: [], almost: [], understood: [] };

  const comprehensionChecks = Array.isArray(session.comprehensionChecks) ? session.comprehensionChecks : [];
  const difficultPoints = Array.isArray(session.difficultPoints) ? session.difficultPoints : [];
  const understoodPoints = Array.isArray(session.understoodPoints) ? session.understoodPoints : [];

  function normalizeTopicKey(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/['"“”‘’`]/g, '')
      .replace(/[.,?!~:;]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // canonicalMap: canonicalKey -> { id, topic, status, updatedAt }
  const canonicalMap = new Map();

  function findExistingKey(normKey) {
    if (canonicalMap.has(normKey)) return normKey;
    for (const [key] of canonicalMap.entries()) {
      if (key.length >= 3 && normKey.length >= 3) {
        if (key.includes(normKey) || normKey.includes(key)) {
          return key;
        }
      }
    }
    return null;
  }

  // 1. 초기 상태 등록: difficultPoints (체크 전 초기 질문 사항)
  difficultPoints.forEach((point, idx) => {
    if (!point || typeof point !== 'string') return;
    const norm = normalizeTopicKey(point);
    if (!norm) return;

    const existingKey = findExistingKey(norm);
    if (!existingKey) {
      canonicalMap.set(norm, {
        id: norm,
        topic: point.trim(),
        status: 'difficult',
        updatedAt: idx
      });
    }
  });

  // 2. 초기 상태 등록: understoodPoints (체크 전 이해한 내용)
  understoodPoints.forEach((point, idx) => {
    if (!point || typeof point !== 'string') return;
    const norm = normalizeTopicKey(point);
    if (!norm) return;

    const existingKey = findExistingKey(norm);
    if (!existingKey) {
      canonicalMap.set(norm, {
        id: norm,
        topic: point.trim(),
        status: 'understood',
        updatedAt: 100 + idx
      });
    }
  });

  // 3. comprehensionChecks를 시간순으로 적용 (가장 최근 결과가 최종 상태!)
  // comprehensionChecks의 결과가 있으면 무조건 기존 상태를 덮어쓰며 이전 상태에서는 제거됨
  comprehensionChecks.forEach((check, idx) => {
    const rawTopic = check.topic || check.difficultPart;
    if (!rawTopic || typeof rawTopic !== 'string') return;
    const norm = normalizeTopicKey(rawTopic);
    if (!norm) return;

    let finalStatus = 'difficult';
    const res = check.result || '';
    if (res.includes('잘 이해') || res.includes('✅')) {
      finalStatus = 'understood';
    } else if (res.includes('거의 이해') || res.includes('🟡')) {
      finalStatus = 'almost';
    } else if (res.includes('조금 더') || res.includes('🔄')) {
      finalStatus = 'difficult';
    }

    const matchedKey = findExistingKey(norm);
    if (matchedKey) {
      // 기존 항목의 상태를 최신 상태로 100% 덮어씀 (이전 상태에서 자동 이탈!)
      const item = canonicalMap.get(matchedKey);
      item.status = finalStatus;
      item.updatedAt = 1000 + idx;
      if (rawTopic.trim().length > item.topic.length) {
        item.topic = rawTopic.trim();
      }
    } else {
      canonicalMap.set(norm, {
        id: norm,
        topic: rawTopic.trim(),
        status: finalStatus,
        updatedAt: 1000 + idx
      });
    }
  });

  // 4. 단 하나의 상태로만 분배 (Single State Guarantee)
  const difficult = [];
  const almost = [];
  const understood = [];

  canonicalMap.forEach(item => {
    if (item.status === 'difficult') {
      difficult.push(item.topic);
    } else if (item.status === 'almost') {
      almost.push(item.topic);
    } else if (item.status === 'understood') {
      understood.push(item.topic);
    }
  });

  return { difficult, almost, understood };
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

