import { SexTypes } from "./SexTypes";

export type PatientType = {
  id: number;
  name: string;
  address: string;
  sex: keyof SexTypes;
  email: string;
  birth: string;
}
