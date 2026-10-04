"use client";
import { patientSortColumns } from "@repo/schema";
import usePagedQuery from "../../hooks/usePagedQuery";
import { useTRPC } from "../../../../../lib/trpc";

// 患者一覧。移植前と同じく ID の昇順を既定の並びにする。
const usePatientsPage = () => {
    const trpc = useTRPC();
    return usePagedQuery({
        sortColumns: patientSortColumns,
        defaultSorting: { id: "id", desc: false },
        createQueryOptions: (pageRequest) => trpc.doctor.patients.page.queryOptions(pageRequest),
    });
};

export default usePatientsPage;
