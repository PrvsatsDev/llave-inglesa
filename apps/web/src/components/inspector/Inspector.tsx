import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { ArtifactInspector } from './ArtifactInspector.tsx';
import { DeviceInspector } from './DeviceInspector.tsx';
import { KeyInspector } from './KeyInspector.tsx';
import { LocationInspector } from './LocationInspector.tsx';
import { PersonInspector } from './PersonInspector.tsx';

/** Ficha editable de la entidad seleccionada, o null si no hay (o ya no existe). */
export function Inspector() {
  const model = useDocument((s) => s.model);
  const selected = useSelection((s) => s.selected);
  if (!selected) return null;

  switch (selected.kind) {
    case 'location': {
      const location = model.locations.find((e) => e.id === selected.id);
      return location ? <LocationInspector key={location.id} model={model} location={location} /> : null;
    }
    case 'person': {
      const person = model.people.find((e) => e.id === selected.id);
      return person ? <PersonInspector key={person.id} model={model} person={person} /> : null;
    }
    case 'device': {
      const device = model.devices.find((e) => e.id === selected.id);
      return device ? <DeviceInspector key={device.id} model={model} device={device} /> : null;
    }
    case 'artifact': {
      const artifact = model.artifacts.find((e) => e.id === selected.id);
      return artifact ? <ArtifactInspector key={artifact.id} model={model} artifact={artifact} /> : null;
    }
    case 'key': {
      const key = model.keys.find((e) => e.id === selected.id);
      return key ? <KeyInspector key={key.id} model={model} keyEntity={key} /> : null;
    }
  }
}
