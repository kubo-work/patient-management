import useSWR, { useSWRConfig } from "swr";
import { API_URL } from "../../../constants/url";
import { PatientType } from "../../../../common/types/PatientType";
import { useState } from "react";

async function fetcher(key: string): Promise<PatientType[]> {
    return fetch(key).then((res) => res.json());
}

export const usePatientsList = () => {
    const [patients, setPatients] = useState<PatientType[] | null>([]);

    const fetchUrl: string = `${API_URL}/doctor/patients`
    const { data, isLoading, error } = useSWR(
        fetchUrl,
        fetcher
    );

    const { mutate } = useSWRConfig();

    const doMutate = () => {
        mutate(fetchUrl);
    }

    return {
        data,
        isLoading,
        error,
        doMutate,
        patients,
        setPatients
    }
}
