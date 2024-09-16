"use client";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css"; //if using mantine date picker features
import "mantine-react-table/styles.css"; //make sure MRT styles were imported in your app root (once)
import { useMemo } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import Link from "next/link";
import { Title } from "@mantine/core";

type Person = {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
};

//nested data is ok, see accessorKeys in ColumnDef below
const data: Person[] = [
  {
    id: 1,
    name: "Zachary Davis",
    address: "261 Battle Ford",
    city: "Columbus",
    state: "Ohio",
  },
];

const Page = () => {
  //should be memoized or stable
  const columns = useMemo<MRT_ColumnDef<Person>[]>(
    () => [
      {
        accessorKey: "name", //access nested data with dot notation
        header: "名前",
        Cell: ({ row }) => (
          <Link
            href={`/patients?id=${row.original.id}`}
            passHref
            legacyBehavior
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "address", //normal accessorKey
        header: "Address",
      },
      {
        accessorKey: "city",
        header: "City",
      },
      {
        accessorKey: "state",
        header: "State",
      },
    ],
    []
  );

  const table = useMantineReactTable({
    columns,
    data, //must be memoized or stable (useState, useMemo, defined outside of this component, etc.)
  });

  return (
    <>
      <Title order={1}>患者一覧</Title>
      <MantineReactTable table={table} />
    </>
  );
};

export default Page;
