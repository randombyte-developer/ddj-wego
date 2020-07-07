import { Button } from "@controls/button";
import { Deck } from "@/deck";
import { FineMidiControl } from "@controls/fineMidiControl";
import { log, toggleControl, activate, makeLedConnection } from "@/utils";
import { MidiControl } from "./controls/midiControl";
import { MidiMapping } from "./midiMapping";
import { DeckButton } from "./controls/deckButton";

let decks: Deck[];
let deckIndependentControls: MidiControl[];

let controls: MidiControl[] = [];

export function init(): void {
    
    MidiMapping.initReversedMapping();

    decks = [1, 2, 3, 4].map(channel => new Deck(channel));

    let ignoreCrossfader = true;

    deckIndependentControls = [
        new FineMidiControl("Crossfader", {
            onValueChanged: value => {
                if (ignoreCrossfader) return;
                engine.setParameter("[Master]", "crossfader", value);
            }
        }),
        new Button("TraxButton", {
            onPressed: () => {
                activate("[Library]", "MoveFocusForward");
            }
        }),
        new FineMidiControl("Master", {
            onValueChanged: value => {
                engine.setParameter("[Master]", "gain", value * 0.5); // it is a gain, it shouldn't be over 0.5 to avoid clipping
            }
        }),
        new FineMidiControl("Headphone", {
            onValueChanged: value => {
                engine.setParameter("[Master]", "headGain", value * 0.5);
            }
        }),
        new FineMidiControl("HeadphoneMix", {
            onValueChanged: value => {
                engine.setParameter("[Master]", "headMix", value);
            }
        }),
        // Center and ignore crossfader
        new DeckButton(0, "SyncShifted", {
            onPressed: () => {
                engine.setParameter("[Master]", "crossfader", 0.5);
                ignoreCrossfader = !ignoreCrossfader;
            }
        })
    ];

    function traxControl(name: string, factor: number): MidiControl {
        return new MidiControl(name, {
            onNewValue: value => {
                if (value > 0x3F) value = value - 0x80;
                engine.setValue("[Library]", "MoveVertical", value * factor);
            }
        });
    }
    deckIndependentControls.push(traxControl("TraxEncoder", 1));
    deckIndependentControls.push(traxControl("TraxEncoderShifted", 5));

    registerControls(deckIndependentControls);
    for (const deck of decks) {
        registerControls(deck.controls);
    }

    // "Traktor Mode": Enables 4 decks operation, jog wheel controlled effects and requests the controller to send all current positions of the controls
    midi.sendShortMsg(0x9C, 0x7B, 0x00);
}

export function midiInput(channel: number, midiNo: number, value: number, status: number, group: string): void {
    //engine.log(`Channel ${channel}, MidiNo: ${midiNo}, Value: ${value}, Status: ${status}, Group: ${group}`);

    const controlName = MidiMapping.mapping[status][midiNo];
    if (controlName == null) return;

    for (const control of controls) {
        control.offerValue(controlName, value);
    }
}

function registerControls(this: any, newControls: MidiControl[]): void {
    controls.push(...newControls);
}
