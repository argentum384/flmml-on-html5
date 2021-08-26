import { Messenger } from "./messenger/Messenger";

declare global {
    var msgr: Messenger;
}
globalThis.msgr = new Messenger();
