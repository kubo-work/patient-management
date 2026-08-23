import { SexTypes } from "./SexTypes.js";

export type SexListData = {
    value: keyof SexTypes;
    label: SexTypes[keyof SexTypes]["label"];
}
