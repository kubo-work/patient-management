import { Box, Button, Flex } from "@mantine/core";
import Link from "next/link";
import React, { FC } from "react";

type Props = {
  url: string;
  textLabel: string;
};

const TableHeader: FC<Props> = ({ url, textLabel }) => {
  return (
    <Box pt={10} pb={40}>
      <Flex justify="center" gap={50}>
        <Link href={url} passHref legacyBehavior>
          <Button component="a">{textLabel}</Button>
        </Link>
      </Flex>
    </Box>
  );
};

export default TableHeader;
