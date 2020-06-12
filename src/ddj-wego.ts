import { Button } from "@controls/button";
import { Deck } from "@/deck";
import { FineMidiControl } from "@controls/fineMidiControl";
import { log, toggleControl, activate, makeLedConnection } from "@/utils";
import { MidiControl } from "./controls/midiControl";
import { MidiToNameMapping } from "./midiToNameMapping";

const decks = [1, 2, 3, 4].map(channel => new Deck(channel));
let deckIndependentControls: MidiControl[];

let controls: MidiControl[] = [];

export function init(): void {

    deckIndependentControls = [
        new FineMidiControl("Crossfader", {
            onValueChanged: value => {
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

/*     // Effects
    for (const effectUnit of [1, 2]) {
        for (const effectNumber of [1, 2, 3]) {
            const group = `[EffectRack1_EffectUnit${effectUnit}_Effect${effectNumber}]`;

            deckIndependentControls.push(new FineMidiControl(0xB3 + effectUnit, 0x00 + (effectNumber * 2), 0x20 + (effectNumber * 2), {
                onValueChanged: value => {
                    engine.setParameter(group, "meta", value);
                }
            }));
            deckIndependentControls.push(new Button(0x93 + effectUnit, 0x46 + effectNumber, {
                onPressed: () => {
                    toggleControl(group, "enabled");
                }
            }));

            makeLedConnection(group, "enabled", 0x93 + effectUnit, 0x46 + effectNumber);
        }
    } */

    registerControls(deckIndependentControls);
    for (const deck of decks) {
        registerControls(deck.controls);
    }

    // "Traktor Mode": Enables 4 decks operation, jog wheel controlled effects and requests the controller to send all current positions of the controls
    midi.sendShortMsg(0x9C, 0x7B, 0x00);
}

export function midiInput(channel: number, midiNo: number, value: number, status: number, group: string): void {
    engine.log(`Channel ${channel}, MidiNo: ${midiNo}, Value: ${value}, Status: ${status}, Group: ${group}`);

    const controlName = MidiToNameMapping.mapping[status][midiNo];
    if (controlName == null) return;
    engine.log(controlName);

    for (const control of controls) {
        control.offerValue(controlName, value);
    }
}

function registerControls(this: any, newControls: MidiControl[]): void {
    controls.push(...newControls);
}
