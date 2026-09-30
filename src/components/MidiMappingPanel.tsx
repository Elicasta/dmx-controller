import type { MidiAssignableControl, MidiMapping } from '../lib/midi';
import { midiBindingLabel } from '../lib/midi';

type Props = {
  mappings: MidiMapping[];
  controls: MidiAssignableControl[];
  groups: Array<[string, MidiAssignableControl[]]>;
  newTarget: string;
  learningId: string | null;
  compact?: boolean;
  onNewTarget: (target: string) => void;
  onAdd: () => void;
  onLearn: (id: string | null) => void;
  onRemove: (id: string) => void;
  onTarget: (id: string, target: string) => void;
  onOpenManager?: () => void;
};

function TargetSelect({ value, groups, label, onChange }: {
  value: string;
  groups: Props['groups'];
  label: string;
  onChange: (value: string) => void;
}) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
    {groups.map(([group, controls]) => <optgroup key={group} label={group}>{controls.map((control) => <option key={control.id} value={control.id}>{control.label}</option>)}</optgroup>)}
  </select>;
}

export function MidiMappingPanel(props: Props) {
  return <section className={`midi-manager-content ${props.compact ? 'is-compact' : ''}`}>
    <div className="midi-manager-intro">
      <span>COMMON MAP · CH 1</span>
      <strong>CC1 GO · CC2 BACK · CC3 BLACKOUT · CC7 MASTER</strong>
      <small>Button controls fire at value 100 by default. Each CC threshold can be changed below.</small>
    </div>
    <div className="midi-add-row">
      <TargetSelect value={props.newTarget} groups={props.groups} label="New MIDI target" onChange={props.onNewTarget} />
      <button className="console-primary" onClick={props.onAdd}>Add + Learn</button>
      {props.onOpenManager && <button onClick={props.onOpenManager}>Open Mapper</button>}
    </div>
    <div className="midi-map-list">
      {props.mappings.map((mapping) => {
        const control = props.controls.find((item) => item.id === mapping.target);
        const learning = props.learningId === mapping.id;
        return <article className={`midi-map-row ${learning ? 'is-learning' : ''}`} key={mapping.id}>
          <TargetSelect value={mapping.target} groups={props.groups} label={`Target for ${control?.label ?? 'MIDI mapping'}`} onChange={(target) => props.onTarget(mapping.id, target)} />
          <span>{learning ? 'Move or press a control…' : midiBindingLabel(mapping)}</span>
          <button onClick={() => props.onLearn(learning ? null : mapping.id)}>{learning ? 'Cancel' : 'Learn'}</button>
          <button className="danger-button" onClick={() => props.onRemove(mapping.id)}>Remove</button>
        </article>;
      })}
      {!props.mappings.length && <div className="midi-map-empty">No mappings yet. Add a target and move the MIDI control you want to learn.</div>}
    </div>
  </section>;
}
