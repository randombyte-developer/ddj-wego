import { MidiControl, MidiControlCallback } from "@controls/midiControl";

export class DeckMidiControl extends MidiControl {
    constructor(deckIndex: number, name: string, callback: MidiControlCallback) {
        super(deckIndex + name, callback);
    }
}
