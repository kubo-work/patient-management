import { SexTypes } from "./SexTypes.js";

export type PatientType = {
  id: number;
  name: string;
  sex: keyof SexTypes;
  tel: string;
  address: string;
  email: string;
  birth: Date;
  password?: string
}
