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
    <section className="timeline panel" aria-label="Snapshot replay timeline">
      <div className="timeline-copy">
        <span className="eyebrow">Snapshot replay</span>
        <h2>{stages[currentIndex].title}</h2>
        <p>{stages[currentIndex].description}</p>
      </div>
      <button className="play-button" onClick={onTogglePlay} aria-label={playing ? 'Pause replay' : 'Play replay'}>
        {playing ? 'Ⅱ' : '▶'}
      </button>
      <div className="timeline-track">
        <div className="track-line" />
        {stages.map((stage, index) => (
          <button
            className={`stage ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'passed' : ''}`}
            key={stage.id}
            onClick={() => onSelect(index)}
            aria-label={`Show ${stage.title}`}
          >
            <span className="stage-dot" />
            <strong>{stage.time}</strong>
            <small>{stage.title}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

