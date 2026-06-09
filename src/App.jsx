import { useState, useRef, Component } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './App.css';

// ── ErrorBoundary ────────────────────────────────────────
class ErrorBoundary extends Component {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) return (
      <div className="error-boundary">
        <p>예기치 못한 오류가 발생했습니다.</p>
        <button className="retry-btn" onClick={() => this.setState({ crashed: false })}>
          다시 시도
        </button>
      </div>
    );
    return this.props.children;
  }
}

// ── Gemini ──────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ── 옵션 ────────────────────────────────────────────────
const OPTIONS = {
  genre:  ['라이프스타일', '자기계발', '게임', '음식', '여행', '테크', '뷰티', '기타'],
  age:    ['전체', '10대', '20대', '30대', '40대 이상'],
  tone:   ['정보전달', '유머러스', '감성적', '동기부여', '자극적'],
  format: ['롱폼 (10분 이상)', '숏폼 (60초 이하)'],
};

// ── 프롬프트 ─────────────────────────────────────────────
function buildPrompt(topic, genre, age, tone, format) {
  const isShort = format === '숏폼 (60초 이하)';
  const formatRule = isShort
    ? `숏폼(60초 이하): 제목 15자 이내 강렬한 훅. scriptStructure 3~5개 섹션(초 단위). 첫 3초 훅 멘트 구체적 대사 포함. hashtags에 #Shorts 필수.`
    : `롱폼(10분 이상): 제목 스토리텔링+검색최적화. scriptStructure 5~7개 섹션(분 단위).`;

  return `당신은 유튜브 채널 기획 전문가입니다. 아래 정보를 참고해 반드시 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

채널 장르: ${genre} | 타겟 연령: ${age} | 톤앤매너: ${tone} | 영상 포맷: ${format}
주제/키워드: ${topic}

응답 JSON 형식:
{
  "titles": ["제목1", "제목2", "제목3"],
  "thumbnail": "썸네일 컨셉 설명 (구도·색상·텍스트 요소 포함, 2~3문장)",
  "scriptStructure": ["섹션1", "섹션2", "..."],
  "videoConcept": "영상 방향성·타깃·차별화 포인트 (2~3문장)",
  "hashtags": ["#태그1", "#태그2", "..."]
}

${formatRule}
scriptStructure 각 항목 형식: [장면] 카메라 구도 | [멘트] 실제로 말할 구체적 대사 | [전환] 편집 방식.
hashtags: 한국어+영어 혼합 SEO 최적화 10~15개.`;
}

// ── 응답 파싱 ────────────────────────────────────────────
function parseResponse(raw) {
  const text = raw.trim()
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const data = JSON.parse(text);
  if (!Array.isArray(data.titles) || data.titles.length === 0)
    throw new SyntaxError('titles missing');
  if (!Array.isArray(data.scriptStructure) || data.scriptStructure.length === 0)
    throw new SyntaxError('scriptStructure missing');
  if (!Array.isArray(data.hashtags)) data.hashtags = [];
  return data;
}

// ── 에러 한국어 변환 ──────────────────────────────────────
function toKoreanError(err) {
  try {
    const msg = (err?.message ?? String(err)).toLowerCase();
    const code = err?.status ?? err?.statusCode;
    if (code === 503 || msg.includes('503') || msg.includes('overloaded'))
      return 'Gemini 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.';
    if (code === 429 || msg.includes('429') || msg.includes('quota'))
      return '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
    if (code === 401 || code === 403 || msg.includes('api key') || msg.includes('unauthorized'))
      return 'API 키가 유효하지 않습니다. 설정을 확인해주세요.';
    if (msg.includes('failed to fetch') || msg.includes('network'))
      return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
    if (err instanceof SyntaxError)
      return '응답 파싱에 실패했습니다. 다시 시도해주세요.';
    return '오류가 발생했습니다. 다시 시도해주세요.';
  } catch {
    return '오류가 발생했습니다. 다시 시도해주세요.';
  }
}

// ── PDF 내보내기 ──────────────────────────────────────────
async function exportPdf(ref, topic) {
  const el = ref.current;
  if (!el) return;
  el.style.display = 'block';
  await new Promise(r => setTimeout(r, 50));

  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  el.style.display = 'none';

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pW = pdf.internal.pageSize.getWidth();
  const pH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const cW = pW - margin * 2;
  const totalH = (canvas.height * cW) / canvas.width;

  let y = margin;
  let remaining = totalH;
  while (remaining > 0) {
    const sliceH = Math.min(remaining, pH - margin * 2);
    const srcY   = (totalH - remaining) * (canvas.height / totalH);
    const srcH   = sliceH * (canvas.height / totalH);
    const slice  = document.createElement('canvas');
    slice.width  = canvas.width;
    slice.height = srcH;
    slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, y, cW, sliceH);
    remaining -= sliceH;
    if (remaining > 0) { pdf.addPage(); y = margin; }
  }
  pdf.save(`${topic.trim().slice(0, 30)}_기획안.pdf`);
}

// ── CopyButton ───────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const str = Array.isArray(text) ? text.join('\n') : (text ?? '');
      await navigator.clipboard.writeText(str);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy} type="button">
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          복사됨
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          복사
        </>
      )}
    </button>
  );
}

// ── ResultCard ───────────────────────────────────────────
function ResultCard({ num, label, copyText, children }) {
  return (
    <section className="card">
      <div className="card-header">
        <div className="card-label">
          <span className="card-icon">{num}</span>
          <h2>{label}</h2>
        </div>
        <CopyButton text={copyText} />
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

// ── PdfTemplate (숨김 렌더링용) ────────────────────────────
function PdfTemplate({ result, topic, genre, age, tone, format }) {
  const s = {
    wrap:     { width: '680px', padding: '48px 52px', background: '#fff', fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", color: '#1a1a2e' },
    topBar:   { background: '#1a1a2e', borderRadius: '8px', padding: '18px 24px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    appName:  { color: '#fff', fontSize: '14px', fontWeight: 700 },
    meta:     { color: 'rgba(255,255,255,0.5)', fontSize: '12px' },
    chips:    { display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' },
    chip:     { fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '100px', background: '#f0f0f6', color: '#555' },
    topicRow: { fontSize: '22px', fontWeight: 700, marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px solid #f0f0f6' },
    section:  { marginBottom: '28px' },
    secHead:  { fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' },
    body:     { fontSize: '14px', color: '#333', lineHeight: 1.75 },
    titleRow: { display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' },
    num:      { minWidth: '22px', height: '22px', background: '#1a1a2e', color: '#fff', borderRadius: '5px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' },
    scriptRow:{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f4f4f8', fontSize: '13px', color: '#444', lineHeight: 1.6 },
    dot:      { width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: '6px' },
    tagWrap:  { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    tag:      { fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '100px', background: '#f0f0f6', color: '#555' },
    footer:   { marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #f0f0f6', fontSize: '11px', color: '#ccc', textAlign: 'right' },
  };

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <span style={s.appName}>AI 유튜브 기획 자동화</span>
        <span style={s.meta}>{new Date().toLocaleDateString('ko-KR')}</span>
      </div>

      <div style={s.chips}>
        {[['채널 장르', genre], ['타겟 연령', age], ['톤앤매너', tone], ['영상 포맷', format]].map(([k, v]) => (
          <span key={k} style={s.chip}>{k}: {v}</span>
        ))}
      </div>

      <div style={s.topicRow}>📌 {topic}</div>

      <div style={s.section}>
        <div style={s.secHead}>제목 후보 3안</div>
        {result.titles.map((t, i) => (
          <div key={i} style={s.titleRow}>
            <div style={s.num}>{i + 1}</div>
            <div style={{ ...s.body, marginBottom: 0 }}>{t}</div>
          </div>
        ))}
      </div>

      <div style={s.section}>
        <div style={s.secHead}>썸네일 컨셉</div>
        <div style={s.body}>{result.thumbnail}</div>
      </div>

      <div style={s.section}>
        <div style={s.secHead}>대본 구조</div>
        {result.scriptStructure.map((item, i) => (
          <div key={i} style={s.scriptRow}>
            <div style={s.dot} />
            <div>{item}</div>
          </div>
        ))}
      </div>

      <div style={s.section}>
        <div style={s.secHead}>영상 컨셉</div>
        <div style={s.body}>{result.videoConcept}</div>
      </div>

      {result.hashtags.length > 0 && (
        <div style={s.section}>
          <div style={s.secHead}>해시태그</div>
          <div style={s.tagWrap}>
            {result.hashtags.map((tag, i) => (
              <span key={i} style={s.tag}>{tag}</span>
            ))}
          </div>
        </div>
      )}

      <div style={s.footer}>Generated by AI 유튜브 기획 자동화</div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────
export default function App() {
  const [topic,      setTopic]      = useState('');
  const [genre,      setGenre]      = useState('라이프스타일');
  const [age,        setAge]        = useState('전체');
  const [tone,       setTone]       = useState('정보전달');
  const [format,     setFormat]     = useState('롱폼 (10분 이상)');
  const [loading,    setLoading]    = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState('');
  const pdfRef = useRef(null);

  async function generate() {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await model.generateContent(buildPrompt(topic, genre, age, tone, format));
      setResult(parseResponse(res.response.text()));
    } catch (err) {
      setError(toKoreanError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!topic.trim()) return;
    await generate();
  }

  async function handlePdf() {
    setPdfLoading(true);
    try {
      await exportPdf(pdfRef, topic);
    } catch {
      // PDF 저장 실패는 조용히 처리
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <ErrorBoundary>
    <div className="app">
      <header className="app-header">
        <div className="badge">Powered by Gemini 2.5 Flash</div>
        <h1>AI 유튜브 기획 자동화</h1>
        <p>주제 또는 키워드를 입력하면 제목·썸네일·대본 구조를 자동으로 생성합니다.</p>
      </header>

      <form onSubmit={handleSubmit} className="input-form">
        <div className="dropdowns">
          {[
            { label: '채널 장르', key: 'genre', value: genre, set: setGenre },
            { label: '타겟 연령', key: 'age',   value: age,   set: setAge   },
            { label: '톤앤매너', key: 'tone',  value: tone,  set: setTone  },
            { label: '영상 포맷', key: 'format',value: format,set: setFormat},
          ].map(({ label, key, value, set }) => (
            <label key={key} className="dropdown-label">
              <span>{label}</span>
              <select value={value} onChange={e => set(e.target.value)} disabled={loading}>
                {OPTIONS[key].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          ))}
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

        <button type="submit" className="submit-btn" disabled={loading || !topic.trim()}>
          {loading ? <><span className="btn-spinner" />기획안 생성 중…</> : '기획안 생성 →'}
        </button>
      </form>

      {error && (
        <div className="error-box">
          <span>{error}</span>
          <button className="retry-btn" type="button" onClick={generate} disabled={loading}>
            다시 시도
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-card">
          <div className="dot-pulse"><span /><span /><span /></div>
          <p>Gemini가 기획안을 작성하고 있습니다…</p>
        </div>
      )}

      {result && (
        <div className="result">
          <ResultCard num="01" label="제목 후보 3안" copyText={result.titles}>
            <ol className="title-list">
              {result.titles.map((t, i) => (
                <li key={i}>
                  <span className="title-num">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </ResultCard>

          <ResultCard num="02" label="썸네일 컨셉" copyText={result.thumbnail}>
            <p className="body-text">{result.thumbnail}</p>
          </ResultCard>

          <ResultCard num="03" label="대본 구조" copyText={result.scriptStructure}>
            <ul className="script-list">
              {result.scriptStructure.map((item, i) => (
                <li key={i}>
                  <span className="script-dot" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </ResultCard>

          <ResultCard num="04" label="영상 컨셉" copyText={result.videoConcept}>
            <p className="body-text">{result.videoConcept}</p>
          </ResultCard>

          {result.hashtags.length > 0 && (
            <ResultCard num="05" label="해시태그" copyText={result.hashtags.join(' ')}>
              <div className="hashtag-list">
                {result.hashtags.map((tag, i) => (
                  <span key={i} className="hashtag-chip">{tag}</span>
                ))}
              </div>
            </ResultCard>
          )}

          <button className="download-btn" onClick={handlePdf} disabled={pdfLoading}>
            {pdfLoading ? (
              <><span className="btn-spinner dark" />PDF 생성 중…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                PDF로 저장
              </>
            )}
          </button>

          <div ref={pdfRef} style={{ display: 'none' }}>
            <PdfTemplate result={result} topic={topic} genre={genre} age={age} tone={tone} format={format} />
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
