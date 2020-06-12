import { Button, ButtonCallback } from "@controls/button";

export class DeckButton extends Button {
    constructor(deckIndex: number, name: string, callback: ButtonCallback) {
        super(deckIndex + name, callback);
    }
}
