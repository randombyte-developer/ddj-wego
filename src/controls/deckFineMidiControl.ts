import { FineMidiControl } from "@controls/fineMidiControl";
import { MidiControlCallback } from "@controls/midiControl";

export class DeckFineMidiControl extends FineMidiControl {
    constructor(deckIndex: number, name: string, callback: MidiControlCallback) {
        super(deckIndex + name, callback);
    }
}
