"use client";
import { doctorSortColumns } from "@repo/schema";
import usePagedQuery from "../../hooks/usePagedQuery";
import { useTRPC } from "../../../../../lib/trpc";

// 医師一覧。移植前の API と同じく ID の昇順を既定の並びにする。
const useDoctorsPage = () => {
    const trpc = useTRPC();
    return usePagedQuery({
        sortColumns: doctorSortColumns,
        defaultSorting: { id: "id", desc: false },
        createQueryOptions: (pageRequest) => trpc.doctor.doctors.page.queryOptions(pageRequest),
    });
};

export default useDoctorsPage;
