import useSWR, { useSWRConfig } from "swr";
import { API_URL } from "../../../constants/url";
import { PatientType } from "../../../../common/types/PatientType";


async function fetcher(key: string): Promise<PatientType[]> {
    return fetch(key).then((res) => res.json());
}

export const usePatientsList = () => {
    const { data, isLoading, error } = useSWR(
        `${API_URL}/doctor/patients`,
        fetcher
    );

    const { mutate } = useSWRConfig();

    const doMutate = () => {
        mutate(`${API_URL}/patients`);
    }


    return {
        data,
        isLoading,
        error,
        doMutate
    }
}
