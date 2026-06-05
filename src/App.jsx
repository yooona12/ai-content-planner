import { useState, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './App.css';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const SYSTEM_PROMPT = `당신은 유튜브 채널 기획 전문가입니다.
사용자가 입력한 주제/키워드를 바탕으로 반드시 아래 JSON 형식으로만 응답하세요.
JSON 외의 다른 텍스트는 절대 포함하지 마세요.

{
  "titles": ["제목1", "제목2", "제목3"],
  "thumbnail": "썸네일 컨셉 설명 (구도, 색상, 텍스트 요소 포함)",
  "scriptStructure": [
    "인트로 (0~30s): ...",
    "본론 1 (30s~2m): ...",
    "본론 2 (2m~4m): ...",
    "본론 3 (4m~6m): ...",
    "아웃트로 (6m~7m): ..."
  ],
  "videoConcept": "전체 영상의 방향성, 톤, 타깃 시청자, 차별화 포인트를 2~3문장으로 설명"
}`;

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(
      Array.isArray(text) ? text.join('\n') : text
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} type="button">
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          복사됨
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          복사
        </>
      )}
    </button>
  );
}

async function handlePdfDownload(pdfRef, topic) {
  const el = pdfRef.current;
  el.style.display = 'block';
  await new Promise(r => setTimeout(r, 50));

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  el.style.display = 'none';

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const imgH = (canvas.height * contentW) / canvas.width;

  let y = margin;
  let remaining = imgH;

  while (remaining > 0) {
    const sliceH = Math.min(remaining, pageH - margin * 2);
    const srcY = (imgH - remaining) * (canvas.height / imgH);
    const srcH = sliceH * (canvas.height / imgH);

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = srcH;
    sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, y, contentW, sliceH);
    remaining -= sliceH;
    if (remaining > 0) { pdf.addPage(); y = margin; }
  }

  pdf.save(`${topic.trim().slice(0, 30)}_기획안.pdf`);
}

const OPTIONS = {
  genre: ['라이프스타일', '자기계발', '게임', '음식', '여행', '테크', '뷰티', '기타'],
  age:   ['전체', '10대', '20대', '30대', '40대 이상'],
  tone:  ['정보전달', '유머러스', '감성적', '동기부여', '자극적'],
};

export default function App() {
  const [topic, setTopic] = useState('');
  const [genre, setGenre] = useState('라이프스타일');
  const [age,   setAge]   = useState('전체');
  const [tone,  setTone]  = useState('정보전달');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const pdfRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setResult(null);
    setError('');

    const contextLine = `채널 장르: ${genre} | 타겟 연령: ${age} | 톤앤매너: ${tone}`;

    try {
      const response = await model.generateContent(
        `${SYSTEM_PROMPT}\n\n${contextLine}\n주제/키워드: ${topic}`
      );
      const text = response.response.text().trim()
        .replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      const parsed = JSON.parse(text);
      setResult(parsed);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('응답 파싱에 실패했습니다. 다시 시도해주세요.');
      } else {
        setError(err.message || '오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="badge">Powered by Gemini 2.5 Flash</div>
        <h1>AI 유튜브 기획 자동화</h1>
        <p>주제 또는 키워드를 입력하면 제목·썸네일·대본 구조를 자동으로 생성합니다.</p>
      </header>

      <form onSubmit={handleSubmit} className="input-form">
        <div className="dropdowns">
          <label className="dropdown-label">
            <span>채널 장르</span>
            <select value={genre} onChange={e => setGenre(e.target.value)} disabled={loading}>
              {OPTIONS.genre.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="dropdown-label">
            <span>타겟 연령</span>
            <select value={age} onChange={e => setAge(e.target.value)} disabled={loading}>
              {OPTIONS.age.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="dropdown-label">
            <span>톤앤매너</span>
            <select value={tone} onChange={e => setTone(e.target.value)} disabled={loading}>
              {OPTIONS.tone.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
        </div>
        <div className="textarea-wrap">
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="예: 직장인을 위한 아침 루틴, 코딩 독학 6개월 후기, 제주도 한달살기 솔직 후기…"
            rows={4}
            disabled={loading}
          />
        </div>
        <button type="submit" disabled={loading || !topic.trim()} className="submit-btn">
          {loading
            ? <><span className="btn-spinner" />기획안 생성 중…</>
            : <>기획안 생성 →</>
          }
        </button>
      </form>

      {error && <div className="error-box">{error}</div>}

      {loading && (
        <div className="loading-card">
          <div className="dot-pulse">
            <span /><span /><span />
          </div>
          <p>Gemini가 기획안을 작성하고 있습니다…</p>
        </div>
      )}

      {result && (
        <div className="result">
          <ResultCard
            icon="01"
            label="제목 후보 3안"
            copyText={result.titles}
          >
            <ol className="title-list">
              {result.titles.map((t, i) => (
                <li key={i}>
                  <span className="title-num">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </ResultCard>

          <ResultCard
            icon="02"
            label="썸네일 컨셉"
            copyText={result.thumbnail}
          >
            <p className="body-text">{result.thumbnail}</p>
          </ResultCard>

          <ResultCard
            icon="03"
            label="대본 구조"
            copyText={result.scriptStructure}
          >
            <ol className="script-list">
              {result.scriptStructure.map((s, i) => (
                <li key={i}>
                  <span className="script-dot" />
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </ResultCard>

          <ResultCard
            icon="04"
            label="영상 컨셉"
            copyText={result.videoConcept}
          >
            <p className="body-text">{result.videoConcept}</p>
          </ResultCard>

          <button
            className="download-btn"
            disabled={pdfLoading}
            onClick={async () => {
              setPdfLoading(true);
              await handlePdfDownload(pdfRef, topic);
              setPdfLoading(false);
            }}
          >
            {pdfLoading ? (
              <><span className="btn-spinner dark" />PDF 생성 중…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                PDF로 저장
              </>
            )}
          </button>

          {/* PDF 렌더링용 숨김 템플릿 */}
          <div ref={pdfRef} style={{ display: 'none' }}>
            <PdfTemplate result={result} topic={topic} genre={genre} age={age} tone={tone} />
          </div>
        </div>
      )}
    </div>
  );
}

function PdfTemplate({ result, topic, genre, age, tone }) {
  const s = {
    wrap:    { width: '680px', padding: '48px 52px', background: '#fff', fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", color: '#1a1a2e' },
    topBar:  { background: '#1a1a2e', borderRadius: '8px', padding: '18px 24px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    appName: { color: '#fff', fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px' },
    meta:    { color: 'rgba(255,255,255,0.55)', fontSize: '12px' },
    chips:   { display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' },
    chip:    { fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '100px', background: '#f0f0f6', color: '#555' },
    topic:   { fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px solid #f0f0f6' },
    section: { marginBottom: '28px' },
    secHead: { fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' },
    secBody: { fontSize: '14px', color: '#333', lineHeight: '1.75' },
    titleLi: { display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' },
    num:     { minWidth: '22px', height: '22px', background: '#1a1a2e', color: '#fff', borderRadius: '5px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0', marginTop: '2px' },
    scriptLi:{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f4f4f8', fontSize: '13px', color: '#444', lineHeight: '1.6' },
    dot:     { width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', flexShrink: '0', marginTop: '6px' },
    footer:  { marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #f0f0f6', fontSize: '11px', color: '#ccc', textAlign: 'right' },
  };

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <span style={s.appName}>AI 유튜브 기획 자동화</span>
        <span style={s.meta}>{new Date().toLocaleDateString('ko-KR')}</span>
      </div>

      <div style={s.chips}>
        {[['채널 장르', genre], ['타겟 연령', age], ['톤앤매너', tone]].map(([k, v]) => (
          <span key={k} style={s.chip}>{k}: {v}</span>
        ))}
      </div>

      <div style={s.topic}>📌 {topic}</div>

      <div style={s.section}>
        <div style={s.secHead}>제목 후보 3안</div>
        {result.titles.map((t, i) => (
          <div key={i} style={s.titleLi}>
            <div style={s.num}>{i + 1}</div>
            <div style={{ ...s.secBody, marginBottom: 0 }}>{t}</div>
          </div>
        ))}
      </div>

      <div style={s.section}>
        <div style={s.secHead}>썸네일 컨셉</div>
        <div style={s.secBody}>{result.thumbnail}</div>
      </div>

      <div style={s.section}>
        <div style={s.secHead}>대본 구조</div>
        {result.scriptStructure.map((s2, i) => (
          <div key={i} style={s.scriptLi}>
            <div style={s.dot} />
            <div>{s2}</div>
          </div>
        ))}
      </div>

      <div style={s.section}>
        <div style={s.secHead}>영상 컨셉</div>
        <div style={s.secBody}>{result.videoConcept}</div>
      </div>

      <div style={s.footer}>Generated by AI 유튜브 기획 자동화</div>
    </div>
  );
}

function ResultCard({ icon, label, copyText, children }) {
  return (
    <section className="card">
      <div className="card-header">
        <div className="card-label">
          <span className="card-icon">{icon}</span>
          <h2>{label}</h2>
        </div>
        <CopyButton text={copyText} />
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}
