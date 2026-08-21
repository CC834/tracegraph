import type { JourneyStage } from './demoJourney'

type TimelineProps = {
  stages: JourneyStage[]
  currentIndex: number
  playing: boolean
  onSelect: (index: number) => void
  onTogglePlay: () => void
}

export function Timeline({ stages, currentIndex, playing, onSelect, onTogglePlay }: TimelineProps) {
  return (
    <section className="history-panel panel" aria-label="Snapshot replay timeline">
      <div className="history-header">
        <div>
          <h2>Trace history</h2>
          <span>Synthetic snapshot replay</span>
        </div>
        <button className="tool-button replay-button" onClick={onTogglePlay} aria-label={playing ? 'Pause replay' : 'Play replay'}>
          {playing ? 'Pause replay' : 'Play replay'}
        </button>
      </div>
      <div className="history-current">
        <strong>{stages[currentIndex].title}</strong>
        <p>{stages[currentIndex].description}</p>
      </div>
      <ol className="history-list" aria-label="Trace snapshots">
        {stages.map((stage, index) => (
          <li key={stage.id}>
            <button
              className={`history-row ${index === currentIndex ? 'active' : ''}`}
              onClick={() => onSelect(index)}
              aria-label={`Show ${stage.title}`}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <time>{stage.time}</time>
              <strong>{stage.title}</strong>
              <i>{index === currentIndex ? 'CURRENT' : 'SNAPSHOT'}</i>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
