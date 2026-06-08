import React, { useState } from 'react';

function describeStudyStatus(status) {
  if (!status) return '';
  switch (status.phase) {
    case 'loading-model':
      return status.progress != null
        ? `Downloading study model… ${Math.round(status.progress * 100)}%`
        : 'Loading study model…';
    case 'summarizing':
      return 'Reading transcript and writing key points…';
    case 'generating-quiz':
      return 'Writing self-test questions…';
    default:
      return 'Working…';
  }
}

const QuizCard = ({ qa }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="quiz-card">
      <p className="quiz-question">{qa.question}</p>
      {revealed ? (
        <p className="quiz-answer">{qa.answer}</p>
      ) : (
        <button type="button" className="btn" onClick={() => setRevealed(true)}>
          Show answer
        </button>
      )}
    </div>
  );
};

const StudyAidsPanel = ({
  supported,
  hasTranscript,
  summary,
  quiz,
  status,
  error,
  onSummarize,
  onGenerateQuiz,
  onClose,
}) => (
  <div className="side-panel">
    <div className="side-panel-head">
      <span>Study aids · runs a small local model in your browser (WebGPU)</span>
      <button type="button" className="btn" onClick={onClose}>
        Close
      </button>
    </div>
    <div className="side-panel-body study-aids-body">
      {!supported && (
        <p className="study-aids-note">
          Study aids need a WebGPU-capable browser (Chrome or Edge 113+). This device/browser
          doesn't expose <code>navigator.gpu</code>, so summaries and quizzes aren't available here —
          everything else in DTube still works normally.
        </p>
      )}
      {supported && !hasTranscript && (
        <p className="study-aids-note">Generate captions for this video first — summaries and quizzes are built from the transcript.</p>
      )}
      {supported && hasTranscript && (
        <>
          <div className="study-aids-actions">
            <button type="button" className="btn" onClick={onSummarize} disabled={!!status}>
              {summary ? 'Re-summarize' : 'Summarize key points'}
            </button>
            <button type="button" className="btn" onClick={onGenerateQuiz} disabled={!!status}>
              {quiz ? 'Regenerate quiz' : 'Generate quiz'}
            </button>
          </div>
          {status && <p className="study-aids-note">{describeStudyStatus(status)} (first run downloads a ~0.5GB model, cached after that)</p>}
          {error && <p className="study-aids-note study-aids-error">{error}</p>}

          {summary?.length > 0 && (
            <div className="study-aids-section">
              <h3>Key points</h3>
              <ul>
                {summary.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {quiz?.length > 0 && (
            <div className="study-aids-section">
              <h3>Self-test quiz</h3>
              {quiz.map((qa, i) => (
                <QuizCard key={i} qa={qa} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  </div>
);

export default StudyAidsPanel;
