interface AnalysisLoaderProps {
  title?: string;
  steps: string[];
  activeIndex: number;
}

export default function AnalysisLoader({
  title = 'Analyzing retail data',
  steps,
  activeIndex,
}: AnalysisLoaderProps) {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
        {title}
      </div>
      <div className="step-list" style={{ marginTop: 8 }}>
        {steps.map((step, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          return (
            <div key={step} className={`step-item ${state}`}>
              <span className="step-icon">{i < activeIndex ? '✓' : i === activeIndex ? '●' : '○'}</span>
              {step}
            </div>
          );
        })}
      </div>
    </div>
  );
}
