import { SexTypes } from "./SexTypes";

export type SexListData = {
    value: keyof SexTypes;
    label: SexTypes[keyof SexTypes]["label"];
}
