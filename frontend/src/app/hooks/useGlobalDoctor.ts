import { useContext } from "react";
import { GlobalDoctorContext, GlobalDoctorContextType } from "../providers/GlobalDoctorContext";

export const useGlobalDoctor = (): GlobalDoctorContextType => useContext(GlobalDoctorContext)
